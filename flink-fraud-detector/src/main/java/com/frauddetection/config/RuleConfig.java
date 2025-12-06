package com.frauddetection.config;

import java.io.Serializable;

public final class RuleConfig implements Serializable {
    private static final long serialVersionUID = 1L;

    private final int maxTxPerMinute;
    private final long frequencyWindowMs;
    private final double highAmountThreshold;
    private final long velocityMinGapMs;
    private final double modelScoreThreshold;

    public RuleConfig(int maxTxPerMinute, long frequencyWindowsMs, double highAmountThreshold, long velocityMinGapMs, double modelScoreThreshold) {
        this.maxTxPerMinute = maxTxPerMinute;
        this.frequencyWindowMs = frequencyWindowsMs;
        this.highAmountThreshold = highAmountThreshold;
        this.velocityMinGapMs = velocityMinGapMs;
        this.modelScoreThreshold = modelScoreThreshold;
    }

    public static RuleConfig fromEnv() {
        int maxTxPerMinute = intEnv("RULE_MAX_TX_PER_MINUTE", 5);
        long frequencyWindowMs = longEnv("RULE_FREQUENCY_WINDOW_MS", 60_000L);
        double highAmountThreshold = doubleEnv("RULE_HIGH_AMOUNT_THRESHOLD", 5_000.0);
        long velocityMinGapMs = longEnv("RULE_VELOCITY_MIN_GAP_MS", 5_000L);
        double modelScoreThreshold = doubleEnv("RULE_MODEL_SCORE_THRESHOLD", 0.5);

        return new RuleConfig(
                maxTxPerMinute,
                frequencyWindowMs,
                highAmountThreshold,
                velocityMinGapMs,
                modelScoreThreshold
        );
    }

    private static int intEnv(String key, int defaultValue) {
        String v = System.getenv(key);
        if (v == null || v.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static long longEnv(String key, long defaultValue) {
        String v = System.getenv(key);
        if (v == null || v.isBlank()) {
            return defaultValue;
        }
        try {
            return Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static double doubleEnv(String key, double defaultValue) {
        String v = System.getenv(key);
        if (v == null || v.isBlank()) {
            return defaultValue;
        }
        try {
            return Double.parseDouble(v.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public int getMaxTxPerMinute() {
        return maxTxPerMinute;
    }

    public long getFrequencyWindowMs() {
        return frequencyWindowMs;
    }

    public double getHighAmountThreshold() {
        return highAmountThreshold;
    }

    public long getVelocityMinGapMs() {
        return velocityMinGapMs;
    }

    public double getModelScoreThreshold() {
        return modelScoreThreshold;
    }

    @Override
    public String toString() {
        return "RuleConfig{" +
                "maxTxPerMinute=" + maxTxPerMinute +
                ", frequencyWindowMs=" + frequencyWindowMs +
                ", highAmountThreshold=" + highAmountThreshold +
                ", velocityMinGapMs=" + velocityMinGapMs +
                ", modelScoreThreshold=" + modelScoreThreshold +
                '}';
    }
}