package com.frauddetection.domain.alert;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;

import java.io.Serializable;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

@JsonIgnoreProperties(ignoreUnknown = true)
public class FraudAlert implements Serializable {
    private static final long serialVersionUID = 1L;

    private String eventId;

    private String accountId;

    private String cardId;

    private double amount;

    private String currency;

    private double fraudScore;

    private boolean fraudPrediction;

    private Set<AlertReason> reasons;

    private String createdAt;

    public FraudAlert() {
    }

    public FraudAlert(String eventId, String accountId, String cardId, double amount, String currency, double fraudScore, boolean fraudPrediction, Set<AlertReason> reasons, String createdAt) {
        this.eventId = eventId;
        this.accountId = accountId;
        this.cardId = cardId;
        this.amount = amount;
        this.currency = currency;
        this.fraudScore = fraudScore;
        this.fraudPrediction = fraudPrediction;
        this.reasons = reasons;
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

        return new FraudAlert(
                tx.getEventId(),
                accountId,
                cardId,
                tx.getAmount(),
                tx.getCurrency(),
                scored.getFraudScore(),
                scored.isFraudPrediction(),
                EnumSet.copyOf(reasons),
                nowIso
        );
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

    public Set<AlertReason> getReasons() {
        return reasons;
    }

    public void setReasons(Set<AlertReason> reasons) {
        this.reasons = reasons;
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
                "eventId='" + eventId + '\'' +
                ", accountId='" + accountId + '\'' +
                ", cardId='" + cardId + '\'' +
                ", amount=" + amount +
                ", currency='" + currency + '\'' +
                ", fraudScore=" + fraudScore +
                ", fraudPrediction=" + fraudPrediction +
                ", reasons=" + reasons +
                ", createdAt='" + createdAt + '\'' +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        FraudAlert that = (FraudAlert) o;
        return Double.compare(amount, that.amount) == 0 && Double.compare(fraudScore, that.fraudScore) == 0 && fraudPrediction == that.fraudPrediction && Objects.equals(eventId, that.eventId) && Objects.equals(accountId, that.accountId) && Objects.equals(cardId, that.cardId) && Objects.equals(currency, that.currency) && Objects.equals(reasons, that.reasons) && Objects.equals(createdAt, that.createdAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(eventId, accountId, cardId, amount, currency, fraudScore, fraudPrediction, reasons, createdAt);
    }
}
