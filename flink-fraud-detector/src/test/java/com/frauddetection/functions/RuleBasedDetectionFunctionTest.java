package com.frauddetection.functions;

import com.frauddetection.config.RuleConfig;
import com.frauddetection.domain.alert.AlertReason;
import com.frauddetection.domain.alert.FraudAlert;
import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;
import org.apache.flink.api.common.typeinfo.Types;
import org.apache.flink.streaming.api.operators.KeyedProcessOperator;
import org.apache.flink.streaming.runtime.streamrecord.StreamRecord;
import org.apache.flink.streaming.util.KeyedOneInputStreamOperatorTestHarness;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuleBasedDetectionFunctionTest {
    private KeyedOneInputStreamOperatorTestHarness<String, ScoredTransaction, FraudAlert> harness;

    @BeforeEach
    void setUp() throws Exception {
        RuleConfig config = new RuleConfig(
                5,
                60_000L,
                1_000.0,
                10_000L,
                60_000L
        );

        RuleBasedDetectionFunction fn = new RuleBasedDetectionFunction(config);
        KeyedProcessOperator<String, ScoredTransaction, FraudAlert> operator = new KeyedProcessOperator<>(fn);

        harness = new KeyedOneInputStreamOperatorTestHarness<>(
                operator,
                (ScoredTransaction st) -> st.getTransaction().getAccountId(),
                Types.STRING
        );
        harness.open();
        harness.setProcessingTime(0L);
    }

    @AfterEach
    void tearDown() throws Exception {
        if(harness != null) {
            harness.close();
        }
    }

    @Test
    void highModelScoreReasonTriggersAndCombinesWithOthers() throws Exception {
        String cardId = "C-400";
        long ts = 4_000_000L;

        ScoredTransaction highScoreLowAmount =
                sampleScored(cardId, 100.0, 0.9); // score >= 0.5 => model flag
        harness.processElement(highScoreLowAmount, ts);

        ScoredTransaction highScoreHighAmount =
                sampleScored(cardId, 10_000.0, 0.9);
        harness.processElement(highScoreHighAmount, ts + 1_000L);

        List<FraudAlert> alerts = extractAlerts();
        assertFalse(alerts.isEmpty(), "Expected alerts for high model score / high amount");

        boolean hasHighModelScore = alerts.stream()
                .anyMatch(a -> a.getReasons().contains(AlertReason.HIGH_MODEL_SCORE));
        assertTrue(hasHighModelScore, "Expected HIGH_MODEL_SCORE in at least one alert");

        boolean hasCombined = alerts.stream()
                .anyMatch(a -> a.getReasons().contains(AlertReason.HIGH_MODEL_SCORE)
                        && a.getReasons().contains(AlertReason.HIGH_TX_AMOUNT));
        assertTrue(hasCombined, "Expected alert with both HIGH_MODEL_SCORE and HIGH_TX_AMOUNT");
    }

    @Test
    void highFrequencyRuleTriggers() throws Exception {
        String cardId = "C-100";
        long baseTs = 1_000_000L;

        for (int i = 0; i < 6; i++) {
            ScoredTransaction st = sampleScored(cardId, 100.0, 0.6);
            harness.processElement(st, baseTs + i * 1_000L);
        }

        List<FraudAlert> alerts = extractAlerts();
        assertFalse(alerts.isEmpty(), "Expected at least one alert for high frequency");

        boolean hasHighFreq = alerts.stream()
                .anyMatch(a -> a.getReasons().contains(AlertReason.HIGH_TX_FREQUENCY));
        assertTrue(hasHighFreq, "Expected HIGH_TX_FREQUENCY in alert reasons");
    }

    @Test
    void highAmountRuleTriggers() throws Exception {
        String cardId = "C-200";
        long ts = 2_000_000L;

        ScoredTransaction st = sampleScored(cardId, 2_500.0, 0.4);
        harness.processElement(st, ts);

        List<FraudAlert> alerts = extractAlerts();
        assertFalse(alerts.isEmpty(), "Expected at least one alert for high amount");

        boolean hasHighAmount = alerts.stream()
                .anyMatch(a -> a.getReasons().contains(AlertReason.HIGH_TX_AMOUNT));
        assertTrue(hasHighAmount, "Expected HIGH_TX_AMOUNT in alert reasons");
    }

    @Test
    void velocityRuleTriggers() throws Exception {
        String cardId = "C-300";
        long t0 = 3_000_000L;

        harness.processElement(sampleScored(cardId, 50.0, 0.4), t0);

        harness.processElement(sampleScored(cardId, 60.0, 0.4), t0 + 3_000L);

        List<FraudAlert> alerts = extractAlerts();
        assertFalse(alerts.isEmpty(), "Expected alerts for velocity pattern");

        boolean hasVelocity = alerts.stream()
                .anyMatch(a -> a.getReasons().contains(AlertReason.HIGH_VELOCITY));

        assertTrue(hasVelocity, "Expected HIGH_VELOCITY in at least one alert");
    }

    private List<FraudAlert> extractAlerts() {
        return harness.getOutput().stream()
                .filter(e -> e instanceof StreamRecord)
                .map(e -> ((StreamRecord<FraudAlert>) e).getValue())
                .collect(Collectors.toList());
    }

    private static ScoredTransaction sampleScored(
            String accountId,
            double amount,
            double score
    ) {
        Transaction tx = new Transaction();
        tx.setSchema("transaction_v1");
        tx.setEventId(UUID.randomUUID().toString());
        String now = Instant.now().toString();
        tx.setTimestamp(now);
        tx.setEventTime(now);
        tx.setAccountId(accountId);
        tx.setAmount(amount);
        tx.setFraudLabel(0);
        tx.setMerchantId("M-1"); // not used by rules now
        tx.setAmountMinor((long) (amount * 100));
        tx.setCurrency("EUR");
        tx.setFraudPattern(null);
        tx.setCorrelationId("corr-" + accountId);

        Map<String, Double> features = new LinkedHashMap<>();
        for (int i = 0; i < 5; i++) {
            features.put("f" + i, (double) i);
        }
        tx.setFeatures(features);

        boolean isFraud = score >= 0.5;
        double latencyMs = 1.0;

        return new ScoredTransaction(
                tx,
                score,
                isFraud,
                "test-model",
                now,
                latencyMs
        );
    }
}
