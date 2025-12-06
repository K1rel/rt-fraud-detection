package com.frauddetection.functions;

import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;
import org.apache.flink.api.common.functions.DefaultOpenContext;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FraudDetectionFunctionTest {


    @Test
    void scoringProducesReasonableScoreAndLatency() throws Exception{
        FraudDetectionFunction fn = new FraudDetectionFunction();
        fn.open(DefaultOpenContext.INSTANCE);
        try{
            Transaction tx = sampleTransaction();
            ScoredTransaction scored = fn.map(tx);

            assertNotNull(scored, "ScoredTransaction should not be null");
            assertNotNull(scored.getTransaction(), "Nested Transaction should not be null");

            double score = scored.getFraudScore();
            assertTrue(score >= 0.0 && score <= 1.0, "Fraud score must be in [0,1]");

            double latencyMs = scored.getInferenceLatencyMs();
            assertTrue(latencyMs >= 0.0, "Inference latency must be >= 0.0");

            assertTrue(latencyMs <= 10.0, "Inference latency must be <= 10.0, was " + latencyMs + "ms");
        } finally {
            fn.close();
        }

    }

    private static Transaction sampleTransaction() {
        Transaction tx = new Transaction();
        tx.setSchema("transaction_v1");
        tx.setEventId("test-event-1");
        String now = Instant.now().toString();
        tx.setTimestamp(now);
        tx.setEventTime(now);
        tx.setAccountId("C-000001");
        tx.setAmount(123.45);
        tx.setFraudLabel(0);
        tx.setMerchantId("M-001");
        tx.setAmountMinor(12345L);
        tx.setCurrency("EUR");
        tx.setFraudPattern(null);
        tx.setCorrelationId("corr-1");

        Map<String, Double> features = new LinkedHashMap<>();
        for (int i = 0; i < 10; i++) {
            features.put("f" + i, (double) i);
        }
        tx.setFeatures(features);

        return tx;
    }
}
