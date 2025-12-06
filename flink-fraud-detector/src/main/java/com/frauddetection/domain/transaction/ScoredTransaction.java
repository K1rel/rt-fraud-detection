package com.frauddetection.domain.transaction;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ScoredTransaction implements Serializable {

    private static final long serialVersionUID = 1L;

    @JsonProperty("transaction")
    private Transaction transaction;

    @JsonProperty("fraud_score")
    private double fraudScore;

    @JsonProperty("is_fraud")
    private boolean fraudPrediction;

    @JsonProperty("model_version")
    private String modelVersion;

    @JsonProperty("scored_at")
    private String scoredAt;

    @JsonProperty("inference_ms")
    private double inferenceLatencyMs;

    public ScoredTransaction() {
    }

    public ScoredTransaction(Transaction transaction, double fraudScore, boolean fraudPrediction, String modelVersion, String scoredAt, double inferenceLatencyMs) {
        this.transaction = transaction;
        this.fraudScore = fraudScore;
        this.fraudPrediction = fraudPrediction;
        this.modelVersion = modelVersion;
        this.scoredAt = scoredAt;
        this.inferenceLatencyMs = inferenceLatencyMs;
    }

    public Transaction getTransaction() {
        return transaction;
    }

    public void setTransaction(Transaction transaction) {
        this.transaction = transaction;
    }

    public double getFraudScore() {
        return fraudScore;
    }

    public void setFraudScore(double fraudScore) {
        this.fraudScore = fraudScore;
    }

    public boolean isFraudPrediction() {
        return fraudPrediction;
    }

    public void setFraudPrediction(boolean fraudPrediction) {
        this.fraudPrediction = fraudPrediction;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }

    public String getScoredAt() {
        return scoredAt;
    }

    public void setScoredAt(String scoredAt) {
        this.scoredAt = scoredAt;
    }

    public double getInferenceLatencyMs() {
        return inferenceLatencyMs;
    }

    public void setInferenceLatencyMs(double inferenceLatencyMs) {
        this.inferenceLatencyMs = inferenceLatencyMs;
    }

    @Override
    public String toString() {
        return "ScoredTransaction{" +
                "transaction=" + transaction +
                ", fraudScore=" + fraudScore +
                ", fraudPrediction=" + fraudPrediction +
                ", modelVersion='" + modelVersion + '\'' +
                ", scoredAt='" + scoredAt + '\'' +
                ", inferenceLatencyMs=" + inferenceLatencyMs +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ScoredTransaction that)) return false;
        return Double.compare(that.fraudScore, fraudScore) == 0
                && fraudPrediction == that.fraudPrediction
                && Double.compare(that.inferenceLatencyMs, inferenceLatencyMs) == 0
                && Objects.equals(transaction, that.transaction)
                && Objects.equals(modelVersion, that.modelVersion)
                && Objects.equals(scoredAt, that.scoredAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(transaction, fraudScore, fraudPrediction, modelVersion, scoredAt, inferenceLatencyMs);
    }
}
