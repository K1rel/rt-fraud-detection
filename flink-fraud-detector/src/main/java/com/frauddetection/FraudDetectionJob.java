package com.frauddetection;

import co.elastic.clients.elasticsearch.core.bulk.BulkOperationVariant;
import co.elastic.clients.elasticsearch.core.bulk.IndexOperation;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.frauddetection.config.RuleConfig;
import com.frauddetection.domain.alert.FraudAlert;
import com.frauddetection.functions.FraudDetectionFunction;
import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;
import com.frauddetection.functions.HighConfidenceAlertFilter;
import com.frauddetection.functions.RuleBasedDetectionFunction;
import com.frauddetection.serialization.FraudAlertSerializationSchema;
import com.frauddetection.serialization.TransactionDeserializationSchema;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.java.functions.KeySelector;
import org.apache.flink.configuration.ExternalizedCheckpointRetention;
import org.apache.flink.connector.base.DeliveryGuarantee;
import org.apache.flink.connector.base.sink.writer.ElementConverter;
import org.apache.flink.connector.elasticsearch.sink.Elasticsearch8AsyncSink;
import org.apache.flink.connector.elasticsearch.sink.Elasticsearch8AsyncSinkBuilder;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.CheckpointConfig;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.http.HttpHost;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.List;
import java.util.Objects;


public final class FraudDetectionJob{
    private static final Logger LOG = LoggerFactory.getLogger(FraudDetectionJob.class);
    private static final ObjectMapper ALERT_MAPPER = new ObjectMapper();


    private FraudDetectionJob(){
        // no-op
    }

    public static void main(String[] args) throws Exception {
        final String bootstrapServers  = requireEnv("KAFKA_BOOTSTRAP_SERVERS");
        final String transactionsTopic = requireEnv("TRANSACTIONS_TOPIC");
        final String consumerGroup     = requireEnv("KAFKA_CONSUMER_GROUP");
        final String alertsTopic = requireEnv("ALERTS_TOPIC");

        final long checkpointIntervalMs =
                parseLongEnv("FLINK_CHECKPOINT_INTERVAL_MS");
        final int parallelism =
                parseIntEnv("FLINK_DEFAULT_PARALLELISM");

        final double mlFraudThreshold = parseDoubleEnv("ML_FRAUD_THRESHOLD");

        final double alertScoreThreshold = parseDoubleEnv("ALERT_SCORE_THRESHOLD");

        LOG.info(
                "Starting FraudDetectionJob with bootstrapServers={}, topic={}, group={}, parallelism={}, checkpointIntervalMs={}, alertScoreThreshold={}",
                bootstrapServers, transactionsTopic, consumerGroup, parallelism, checkpointIntervalMs, alertScoreThreshold
        );

        // --- StreamExecutionEnv ---
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // --- Checkpointing: EXACTLY_ONCE every 60s ---
        env.enableCheckpointing(checkpointIntervalMs);
        env.setParallelism(parallelism);

        final CheckpointConfig checkpointConfig = env.getCheckpointConfig();

        checkpointConfig.setMinPauseBetweenCheckpoints(checkpointIntervalMs / 2);
        checkpointConfig.setCheckpointTimeout(10 * 60 * 1000L);
        checkpointConfig.setTolerableCheckpointFailureNumber(3);
        checkpointConfig.setExternalizedCheckpointRetention(
                ExternalizedCheckpointRetention.RETAIN_ON_CANCELLATION
        );


        KafkaSource<Transaction> kafkaSource = KafkaSource.<Transaction>builder()
                .setBootstrapServers(bootstrapServers)
                .setTopics(transactionsTopic)
                .setGroupId(consumerGroup)
                .setStartingOffsets(OffsetsInitializer.earliest())
                .setValueOnlyDeserializer(new TransactionDeserializationSchema())
                .setProperty("enable.auto.commit", "false")
                .build();

        WatermarkStrategy<Transaction> wmStrategy = WatermarkStrategy.<Transaction>forBoundedOutOfOrderness(Duration.ofSeconds(5))
                .withTimestampAssigner(
                        (tx, recordTs) -> {
                            if (tx == null){
                                return recordTs;
                            }

                            String s = tx.getEventTime();
                            if(s == null || s.isBlank()){
                                s = tx.getTimestamp();
                            }
                            if(s == null || s.isBlank()){
                                return recordTs;
                            }

                            try{
                                return Instant.parse(s).toEpochMilli();
                            } catch (DateTimeParseException e){
                                LOG.warn(
                                        "Bad event_time/timestamp '{}', using record timestamp {}",
                                        s, recordTs
                                );
                                return recordTs;
                            }
                        }
                );

        DataStream<Transaction> transactions =
                env.fromSource(kafkaSource, wmStrategy, "transactions-source")
                        .filter(Objects::nonNull)
                        .name("filter-valid-transactions")
                        .uid("filter-valid-transactions");

        transactions.map(tx -> {
            if(LOG.isDebugEnabled()){
                LOG.info(
                        "Received transaction eventId={} accountId={} amount={} schema={}",
                        tx.getEventId(),
                        tx.getAccountId(),
                        tx.getAmount(),
                        tx.getSchema()
                );
            }

            return tx;
        })
                .name("log-transactions")
                .uid("log-transactions");

        DataStream<ScoredTransaction> scoredTransactions =
                transactions
                        .map(new FraudDetectionFunction(mlFraudThreshold))
                        .name("scored-transactions")
                        .uid("scored-transactions");

        scoredTransactions
                .map(st -> {
                    if(LOG.isDebugEnabled()){
                        LOG.info(
                                "Scored transaction eventId={} label={} fraudScore={} modelVersion={}",
                                st.getTransaction().getEventId(),
                                st.getTransaction().getFraudLabel(),
                                st.getFraudScore(),
                                st.getModelVersion()
                        );
                    }

                    return st;
                })
                        .name("log-scored-transactions")
                        .uid("log-scored-transactions");

        RuleConfig ruleConfig = RuleConfig.fromEnv();
        LOG.info("Using rule config: {}", ruleConfig);

        DataStream<FraudAlert> alerts =
                scoredTransactions
                        .keyBy((KeySelector<ScoredTransaction, String>) st ->
                                st.getTransaction().getAccountId())
                                .process(new RuleBasedDetectionFunction(ruleConfig))
                                .name("rule-based-detection")
                                .uid("rule-based-detection")
                        .map(a -> {
                            LOG.info("PRE_FILTER alert score={} reasons={}", a.getFraudScore(), a.getReasons());
                            return a;
                        }).name("debug-pre-filter")
                                .disableChaining();

        DataStream<FraudAlert> highConfidenceAlerts =
                alerts
                        .filter(new HighConfidenceAlertFilter(alertScoreThreshold))
                        .name("filter-high-confidence-alerts")
                        .uid("filter-high-confidence-alerts")
                        .disableChaining();

       DataStream<FraudAlert> loggedAlerts = highConfidenceAlerts
                .map(alert -> {

                        LOG.info(
                                "ALERT alertId={} eventId={} accountId={} amount={} score={} severity={} method={} reasons={}",
                                alert.getAlertId(),
                                alert.getEventId(),
                                alert.getAccountId(),
                                alert.getAmount(),
                                alert.getFraudScore(),
                                alert.getSeverity(),
                                alert.getDetectionMethod(),
                                alert.getReasons()
                        );
                        return alert;
                    })
                .name("log-alerts")
                .uid("log-alerts");

        KafkaSink<FraudAlert> kafkaAlertSink =
                KafkaSink.<FraudAlert>builder()
                                .setBootstrapServers(bootstrapServers)
                                        .setRecordSerializer(
                                                KafkaRecordSerializationSchema.builder()
                                                        .setTopic(alertsTopic)
                                                        .setValueSerializationSchema(new FraudAlertSerializationSchema())
                                                        .build()
                                        )
                                                .setDeliveryGuarantee(DeliveryGuarantee.AT_LEAST_ONCE)
                                                .build();


        loggedAlerts
                .sinkTo(kafkaAlertSink)
                .name("kafka-fraud-alerts-sink")
                .uid("kafka-fraud-alerts-sink");

        String esHost = envOrDefault("ELASTICSEARCH_HOST", "elasticsearch");
        int esPort = parseIntEnv("ELASTICSEARCH_PORT");
        String esScheme = envOrDefault("ELASTICSEARCH_SCHEME", "http");
        String esIndexPrefix = envOrDefault("ELASTICSEARCH_ALERT_INDEX_PREFIX", "fraud-alerts");

        ElementConverter<FraudAlert, BulkOperationVariant> esConverter =

                (alert, ctx) -> {

                        if (alert == null) {
                            return null;
                        }

                        String index = resolveAlertIndex(esIndexPrefix,  alert);

                        return new IndexOperation.Builder<FraudAlert>()
                                .index(index)
                                .id(alert.getAlertId())
                                .document(alert)
                                .build();


                };

        Elasticsearch8AsyncSink<FraudAlert> esSink =
                Elasticsearch8AsyncSinkBuilder.<FraudAlert>builder()
                                .setHosts(new HttpHost(esHost, esPort, esScheme))
                                .setElementConverter(esConverter)
                                .setMaxBatchSize(500)
                                .setMaxBufferedRequests(1000)
                                .setMaxTimeInBufferMS(1000)
                                .setMaxInFlightRequests(2)
                                .build();

        loggedAlerts
            .sinkTo(esSink)
            .name("elasticsearch-fraud-alerts-sink")
            .uid("elasticsearch-fraud-alerts-sink");

        env.execute("FraudDetectionJob");
    }

    private static String resolveAlertIndex(String prefix, FraudAlert alert){
        String ts = alert.getCreatedAt();
        LocalDate date;
        try{
            if(ts != null && !ts.isBlank()){
                date = Instant.parse(ts).atOffset(ZoneOffset.UTC).toLocalDate();
            } else {
                date = LocalDate.now(ZoneOffset.UTC);
            }
        } catch (DateTimeParseException e){
            date = LocalDate.now(ZoneOffset.UTC);
        }

        return String.format(
                "%s-%04d-%02d-%02d",
                prefix,
                date.getYear(),
                date.getMonthValue(),
                date.getDayOfMonth()
        );
    }

    private static String requireEnv(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing required env var: " + key);
        }
        return value;
    }

    private static long parseLongEnv(String key) {
        try {
            return Long.parseLong(requireEnv(key));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("Env " + key + " must be a long", e);
        }
    }

    private static double parseDoubleEnv(String key) {
        try {
            return Double.parseDouble(requireEnv(key));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("Env " + key + " must be a double", e);
        }
    }

    private static String envOrDefault(String key,  String defaultValue) {
        String v = System.getenv(key);
        if (v == null || v.isBlank()) {
            return defaultValue;
        }
        return v;
    }

    private static int parseIntEnv(String key) {
        try {
            return Integer.parseInt(requireEnv(key));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("Env " + key + " must be an int", e);
        }
    }
}