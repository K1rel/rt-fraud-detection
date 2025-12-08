package com.frauddetection.domain.alert;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;

import java.io.Serializable;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

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


        return new FraudAlert(
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

    private static AlertSeverity deriveSeverity(double score, Set<AlertReason> reasons) {
        if(score >= 0.98){
            return AlertSeverity.CRITICAL;
        }
        if (score >= 0.90){
            return AlertSeverity.HIGH;
        }
        if(score >= 0.80){
            return AlertSeverity.MEDIUM;
        }

        return AlertSeverity.LOW;
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
