package com.frauddetection;

import com.frauddetection.model.Transaction;
import com.frauddetection.serialization.TransactionDeserializationSchema;
import org.apache.flink.api.common.eventtime.SerializableTimestampAssigner;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.configuration.ExternalizedCheckpointRetention;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.CheckpointConfig;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Objects;


public final class FraudDetectionJob{
    private static final Logger LOG = LoggerFactory.getLogger(FraudDetectionJob.class);


    private FraudDetectionJob(){
        // no-op
    }

    public static void main(String[] args) throws Exception {
        final String bootstrapServers  = requireEnv("KAFKA_BOOTSTRAP_SERVERS");
        final String transactionsTopic = requireEnv("TRANSACTIONS_TOPIC");
        final String consumerGroup     = requireEnv("KAFKA_CONSUMER_GROUP");

        final long checkpointIntervalMs =
                parseLongEnv("FLINK_CHECKPOINT_INTERVAL_MS");
        final int parallelism =
                parseIntEnv("FLINK_DEFAULT_PARALLELISM");

        LOG.info(
                "Starting FraudDetectionJob with bootstrapServers={}, topic={}, group={}, " + "parallelism={}, checkpointIntervalMs={}",
                bootstrapServers, transactionsTopic, consumerGroup, parallelism, checkpointIntervalMs
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
            LOG.info(
                    "Received transaction eventId={} accountId={} amount={} schema={}",
                        tx.getEventId(),
                        tx.getAccountId(),
                        tx.getAmount(),
                        tx.getSchema()
                    );
            return tx;
        })
                .name("log-transactions")
                .uid("log-transactions");

        env.execute("FraudDetectionJob");
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

    private static int parseIntEnv(String key) {
        try {
            return Integer.parseInt(requireEnv(key));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("Env " + key + " must be an int", e);
        }
    }
}