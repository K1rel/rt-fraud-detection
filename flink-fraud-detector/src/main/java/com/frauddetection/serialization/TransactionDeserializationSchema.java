package com.frauddetection.serialization;

import com.frauddetection.model.Transaction;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.DeserializationFeature;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class TransactionDeserializationSchema implements DeserializationSchema<Transaction> {
    private static final long serialVersionUID = 1L;

    private static final Logger LOG = LoggerFactory.getLogger(TransactionDeserializationSchema.class);

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Override
    public Transaction deserialize(byte[] message){
        if (message == null || message.length == 0){
            LOG.warn("Received empty Kafka message for Transaction");
            return null;
        }

        String payload = new String(message, StandardCharsets.UTF_8);

        try{
            Transaction tx = OBJECT_MAPPER.readValue(message, Transaction.class);

            if(tx.getSchema() == null || tx.getSchema().isBlank()){
                LOG.warn("Dropping Transaction with missing schema: {}", payload);
                return null;
            }
            if((tx.getEventTime() == null || tx.getEventTime().isBlank()) && (tx.getTimestamp() == null || tx.getTimestamp().isBlank())){
                LOG.warn("Dropping Transaction with missing event_time/timestamp: {}", payload);
                return null;
            }

            return tx;
        } catch (Exception e){
            LOG.warn("Failed to deserialize Transaction JSON: {}", new String(message, StandardCharsets.UTF_8), e);
            return null;
        }
    }

    @Override
    public boolean isEndOfStream(Transaction nextElement) {
        return false;
    }

    @Override
    public TypeInformation<Transaction> getProducedType() {
        return TypeInformation.of(Transaction.class);
    }
}
