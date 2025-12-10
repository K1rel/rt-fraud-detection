package com.frauddetection.serialization;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.frauddetection.domain.alert.FraudAlert;
import org.apache.flink.api.common.serialization.SerializationSchema;

import java.io.IOException;

public class FraudAlertSerializationSchema implements SerializationSchema<FraudAlert> {
    private static final long serialVersionUID = 1L;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    public byte[] serialize(FraudAlert alert) {
        if(alert == null){
            return null;
        }
        try{
            return OBJECT_MAPPER.writeValueAsBytes(alert);
        }catch (IOException e){
            throw new RuntimeException("Failed to serialize FraudAlert to JSON", e);
        }
    }
}
