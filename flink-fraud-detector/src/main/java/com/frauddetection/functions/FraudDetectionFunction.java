package com.frauddetection.functions;

import com.frauddetection.ml.FeatureVectorizer;
import com.frauddetection.ml.ModelLoader;
import com.frauddetection.model.OnnxScorer;
import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;
import org.apache.flink.api.common.functions.OpenContext;
import org.apache.flink.api.common.functions.RichMapFunction;
import org.apache.flink.api.common.functions.RuntimeContext;
import org.apache.flink.metrics.Counter;
import org.apache.flink.metrics.Meter;
import org.apache.flink.metrics.MeterView;
import org.apache.flink.metrics.MetricGroup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

public class FraudDetectionFunction extends RichMapFunction<Transaction, ScoredTransaction> {

    private static final Logger LOG = LoggerFactory.getLogger(FraudDetectionFunction.class);

    private static final double DEFAULT_FRAUD_THRESHOLD = 0.5;

    private transient OnnxScorer scorer;
    private transient Counter inferenceCounter;
    private transient Counter errorCounter;
    private transient Meter inferenceRate;

    private String modelVersion;

    private long totalLatencyNanos = 0L;
    private long totalInferences = 0L;

    @Override
    public void open(OpenContext parameters) throws Exception {
        super.open(parameters);

        String src = envOrDefault("ONNX_MODEL_SRC", "resource");
        String modelId;

        if("path".equalsIgnoreCase(src)){
            modelId = envOrDefault("ONNX_MODEL_PATH", "UNKNOWN_MODEL_PATH");
        } else {
            modelId = envOrDefault("ONNX_MODEL_RESOURCE", "/model/best_model.onnx");
        }

        String explisitVersion = System.getenv("MODEL_VERSION");
        this.modelVersion = (explisitVersion != null && !explisitVersion.isBlank()) ? explisitVersion : modelId;
//        this.modelVersion = envOrDefault("MODEL_VERSION", "best_model.onnx");
//
//        LOG.info("Initializing FraudDetectionFunction with modelVersion={}", modelVersion);
        this.scorer = ModelLoader.loadDefaultScorer();
        LOG.info("Loaded ONNX model; featureCount={}", scorer.getFeatureCount());

        final RuntimeContext ctx;
        try {
            ctx = getRuntimeContext();
        } catch (IllegalStateException e) {
            // Happens when used outside a Flink runtime (plain unit tests)
            LOG.warn("RuntimeContext not initialized - metrics disabled (likely unit test).");
            return; // skip metrics registration, keep scoring alive
        }
        if(ctx != null){
            MetricGroup group = ctx.getMetricGroup().addGroup("fraud_model");

            this.inferenceCounter = group.counter("inferences_total");
            this.errorCounter = group.counter("inference_errors_total");
            this.inferenceRate = group.meter("inference_rate", new MeterView(this.inferenceCounter, 60));

            group.gauge("inference_avg_latency_ms", () -> {
                if(totalInferences == 0){
                    return 0.0;
                }
                double avgNs = (double) totalLatencyNanos / (double) totalInferences;
                return avgNs / 1_000_000.0;
            });

            LOG.info("FraudDetection function metrics registered.");
        } else {
            LOG.warn("RuntimeContext is null - metrics disabled (ikely unit test).");
        }

    }

    @Override
    public ScoredTransaction map(Transaction tx) throws Exception {
        if(tx == null){
            return null;
        }

        try{
            float[] features = FeatureVectorizer.toFeatureVector(tx, scorer.getFeatureCount());

            long t0 = System.nanoTime();
            float score = scorer.score(features);
            long t1 = System.nanoTime();

            long latencyNs = t1 - t0;
            totalLatencyNanos += latencyNs;
            totalInferences++;

            if(inferenceCounter != null) {
                inferenceCounter.inc();
            }

            double scoreDouble = (double) score;
            boolean isFraud = scoreDouble >= DEFAULT_FRAUD_THRESHOLD;
            double latencyMs = latencyNs / 1_000_000.0;

            return new ScoredTransaction(
                    tx,
                    scoreDouble,
                    isFraud,
                    modelVersion,
                    Instant.now().toString(),
                    latencyMs
            );
        } catch (Exception e) {
            if(errorCounter != null) {
                errorCounter.inc();
            }
            LOG.warn(
                    "Error scoring transaction eventId={} : {}",
                    tx.getEventId(),
                    e.getMessage(),
                    e
            );

            return new ScoredTransaction(
                    tx,
                    0.0,
                    false,
                    modelVersion,
                    Instant.now().toString(),
                    0.0
            );
        }
    }

    public void close() throws Exception{
        super.close();
        if(scorer != null) {
            LOG.info("Closing ONNX scorer.");
            scorer.close();
        }
    }

    private static String envOrDefault(String key, String defaultValue) {
        String v = System.getenv(key);
        return v == null ? defaultValue : v;
    }
}
