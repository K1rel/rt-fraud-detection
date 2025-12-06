package com.frauddetection.domain.transaction;

import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.annotation.JsonAlias;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.util.Map;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Transaction implements Serializable {

    private static final long serialVersionUID = 1L;

    @JsonProperty("schema")
    private String schema;

    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("event_time")
    private String eventTime;

    @JsonProperty("account_id")
    @JsonAlias({"_account_id", "card_id"})
    private String accountId;

    @JsonProperty("amount")
    private double amount;

    @JsonProperty("is_fraud_label")
    private Integer fraudLabel;

    @JsonProperty("merchant_id")
    private String merchantId;

    @JsonProperty("amount_minor")
    private long amountMinor;

    @JsonProperty("currency")
    private String currency;

    @JsonProperty("features")
    private Map<String, Double> features;

    @JsonProperty("fraud_pattern")
    private String fraudPattern;

    @JsonProperty("correlation_id")
    private String correlationId;

    public Transaction() {}

    public Transaction(String schema, String eventId, String timestamp, String eventTime, String accountId, double amount, Integer fraudLabel, String merchantId, long amountMinor, String currency, Map<String, Double> features, String fraudPattern, String correlationId) {
        this.schema = schema;
        this.eventId = eventId;
        this.timestamp = timestamp;
        this.eventTime = eventTime;
        this.accountId = accountId;
        this.amount = amount;
        this.fraudLabel = fraudLabel;
        this.merchantId = merchantId;
        this.amountMinor = amountMinor;
        this.currency = currency;
        this.features = features;
        this.fraudPattern = fraudPattern;
        this.correlationId = correlationId;
    }

    public String getSchema() {
        return schema;
    }

    public String getEventTime() {
        return eventTime;
    }

    public void setEventTime(String eventTime) {
        this.eventTime = eventTime;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public long getAmountMinor() {
        return amountMinor;
    }

    public void setAmountMinor(long amountMinor) {
        this.amountMinor = amountMinor;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Map<String, Double> getFeatures() {
        return features;
    }

    public void setFeatures(Map<String, Double> features) {
        this.features = features;
    }

    public String getFraudPattern() {
        return fraudPattern;
    }

    public void setFraudPattern(String fraudPattern) {
        this.fraudPattern = fraudPattern;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public void setSchema(String schema) {
        this.schema = schema;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getAccountId() {
        return accountId;
    }

    public void setAccountId(String accountId) {
        this.accountId = accountId;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public Integer getFraudLabel() {
        return fraudLabel;
    }

    public void setFraudLabel(Integer fraudLabel) {
        this.fraudLabel = fraudLabel;
    }

    public boolean isFraudKnownAndTrue(){
        return fraudLabel != null && fraudLabel == 1;
    }

    @Override
    public String toString() {
        return "Transaction{" +
                "schema='" + schema + '\'' +
                ", eventId='" + eventId + '\'' +
                ", timestamp='" + timestamp + '\'' +
                ", accountId='" + accountId + '\'' +
                ", amount=" + amount +
                ", fraudLabel=" + fraudLabel +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if(this == o) return true;
        if(!(o instanceof Transaction that)) return false;
        return Double.compare(amount, that.amount) == 0 && Objects.equals(schema, that.schema) && Objects.equals(eventId, that.eventId) && Objects.equals(timestamp, that.timestamp) && Objects.equals(accountId, that.accountId) && Objects.equals(fraudLabel, that.fraudLabel);
    }

    @Override
    public int hashCode() {
        return Objects.hash(schema, eventId, timestamp, accountId, amount, fraudLabel);
    }
}
