package com.frauddetection.domain.alert;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;

import java.io.Serializable;
import java.time.Instant;
import java.util.*;

@JsonIgnoreProperties(ignoreUnknown = true)
public class FraudAlert implements Serializable {
    private static final long serialVersionUID = 1L;

    private String alertId;

    private String eventId;

    private String accountId;

    private String cardId;

    private double amount;

    private String currency;

    private double fraudScore;

    private boolean fraudPrediction;

    private AlertDetectionMethod detectionMethod;

    private Set<AlertReason> reasons;

    private AlertSeverity severity;
    private java.util.Map<String, Double> features;
    private java.util.Map<String, Double> featureContributions;
    private String modelVersion;
    private String scoredAt;
    private Double inferenceMs;

    private String createdAt;

    public FraudAlert() {
    }

    public FraudAlert(String alertId, String eventId, String accountId, String cardId, double amount, String currency, double fraudScore, boolean fraudPrediction, AlertDetectionMethod detectionMethod, Set<AlertReason> reasons, AlertSeverity severity, String createdAt) {
        this.alertId = alertId;
        this.eventId = eventId;
        this.accountId = accountId;
        this.cardId = cardId;
        this.amount = amount;
        this.currency = currency;
        this.fraudScore = fraudScore;
        this.fraudPrediction = fraudPrediction;
        this.detectionMethod = detectionMethod;
        this.reasons = reasons;
        this.severity = severity;
        this.createdAt = createdAt;
    }

    public static FraudAlert fromScoredTransaction(
            ScoredTransaction scored,
            Set<AlertReason> reasons,
            long createdAtMillis
    ){
        Transaction tx = scored.getTransaction();
        String nowIso = Instant.ofEpochMilli(createdAtMillis).toString();
        String accountId = tx.getAccountId();
        String cardId = accountId;
        double score = scored.getFraudScore();

        AlertDetectionMethod detectionMethod = deriveDetectionMethod(reasons);
        AlertSeverity severity = deriveSeverity(score, reasons);
        String alertId = UUID.randomUUID().toString();
        var feats = tx.getFeatures();


        FraudAlert a = new FraudAlert(
        alertId,
        tx.getEventId(),
        accountId,
        cardId,
        tx.getAmount(),
        tx.getCurrency(),
        score,
        scored.isFraudPrediction(),
        detectionMethod,
        EnumSet.copyOf(reasons),
        severity,
        nowIso
        );

        a.setFeatures(tx.getFeatures());
        a.setFeatureContributions(null);
        a.setModelVersion(scored.getModelVersion());
        a.setScoredAt(scored.getScoredAt());
        a.setInferenceMs(scored.getInferenceLatencyMs());

        return a;

    }

    private static AlertDetectionMethod deriveDetectionMethod(Set<AlertReason> reasons) {
        boolean hasModel = reasons.contains(AlertReason.HIGH_MODEL_SCORE);
        boolean hasRules = reasons.stream().anyMatch(r -> r != AlertReason.HIGH_MODEL_SCORE);

        if(hasModel && hasRules){
            return AlertDetectionMethod.ML_AND_RULES;
        } else if(hasModel){
            return AlertDetectionMethod.ML;
        } else {
            return AlertDetectionMethod.RULES;
        }
    }

    private static final double S_CRITICAL = 0.90;
    private static final double S_HIGH     = 0.70;
    private static final double S_MEDIUM   = 0.40;

    private static AlertSeverity fromScore(double score) {
        if (score >= S_CRITICAL) return AlertSeverity.CRITICAL;
        if (score >= S_HIGH)     return AlertSeverity.HIGH;
        if (score >= S_MEDIUM)   return AlertSeverity.MEDIUM;
        return AlertSeverity.LOW;
    }

    private static AlertSeverity fromReasons(boolean hasModel, int ruleCount) {
        if (ruleCount >= 3) return AlertSeverity.CRITICAL;
        if (ruleCount >= 2 || (hasModel && ruleCount >= 1)) return AlertSeverity.HIGH;
        if (ruleCount >= 1 || hasModel) return AlertSeverity.MEDIUM;
        return AlertSeverity.LOW;
    }

    private static AlertSeverity maxSeverity(AlertSeverity a, AlertSeverity b) {
        return a.ordinal() >= b.ordinal() ? a : b;
    }

    private static AlertSeverity deriveSeverity(double score, Set<AlertReason> reasons) {
        boolean hasModel = reasons.contains(AlertReason.HIGH_MODEL_SCORE);

        int ruleCount = 0;
        if (reasons.contains(AlertReason.HIGH_TX_AMOUNT)) ruleCount++;
        if (reasons.contains(AlertReason.HIGH_TX_FREQUENCY)) ruleCount++;
        if (reasons.contains(AlertReason.HIGH_VELOCITY)) ruleCount++;

        AlertSeverity sScore = fromScore(score);
        AlertSeverity sRules = fromReasons(hasModel, ruleCount);

        return maxSeverity(sScore, sRules);
    }

    public String getAlertId() {
        return alertId;
    }

    public void setAlertId(String alertId) {
        this.alertId = alertId;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getAccountId() {
        return accountId;
    }

    public void setAccountId(String accountId) {
        this.accountId = accountId;
    }

    public String getCardId() {
        return cardId;
    }

    public void setCardId(String cardId) {
        this.cardId = cardId;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
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

    public AlertDetectionMethod getDetectionMethod() {
        return detectionMethod;
    }

    public void setDetectionMethod(AlertDetectionMethod detectionMethod) {
        this.detectionMethod = detectionMethod;
    }

    public Set<AlertReason> getReasons() {
        return reasons;
    }

    public void setReasons(Set<AlertReason> reasons) {
        this.reasons = reasons;
    }

    public AlertSeverity getSeverity() {
        return severity;
    }

    public void setSeverity(AlertSeverity severity) {
        this.severity = severity;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public Map<String, Double> getFeatures() {
        return features;
    }

    public void setFeatures(Map<String, Double> features) {
        this.features = features;
    }

    public Map<String, Double> getFeatureContributions() {
        return featureContributions;
    }

    public void setFeatureContributions(Map<String, Double> featureContributions) {
        this.featureContributions = featureContributions;
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

    public Double getInferenceMs() {
        return inferenceMs;
    }

    public void setInferenceMs(Double inferenceMs) {
        this.inferenceMs = inferenceMs;
    }

    @Override
    public String toString() {
        return "FraudAlert{" +
                "alertId='" + alertId + '\'' +
                ", eventId='" + eventId + '\'' +
                ", accountId='" + accountId + '\'' +
                ", cardId='" + cardId + '\'' +
                ", amount=" + amount +
                ", currency='" + currency + '\'' +
                ", fraudScore=" + fraudScore +
                ", fraudPrediction=" + fraudPrediction +
                ", detectionMethod=" + detectionMethod +
                ", reasons=" + reasons +
                ", severity=" + severity +
                ", createdAt='" + createdAt + '\'' +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        FraudAlert that = (FraudAlert) o;
        return Double.compare(amount, that.amount) == 0 && Double.compare(fraudScore, that.fraudScore) == 0 && fraudPrediction == that.fraudPrediction && Objects.equals(alertId, that.alertId) && Objects.equals(eventId, that.eventId) && Objects.equals(accountId, that.accountId) && Objects.equals(cardId, that.cardId) && Objects.equals(currency, that.currency) && detectionMethod == that.detectionMethod && Objects.equals(reasons, that.reasons) && severity == that.severity && Objects.equals(createdAt, that.createdAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(alertId, eventId, accountId, cardId, amount, currency, fraudScore, fraudPrediction, detectionMethod, reasons, severity, createdAt);
    }
}
