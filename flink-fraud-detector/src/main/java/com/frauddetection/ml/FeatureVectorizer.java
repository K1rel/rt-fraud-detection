package com.frauddetection.ml;

import com.frauddetection.domain.transaction.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public final class FeatureVectorizer {
    private static final Logger LOG = LoggerFactory.getLogger(FeatureVectorizer.class);

    private FeatureVectorizer() {

    }

    public static float[] toFeatureVector(Transaction tx, int expectedSize) {
        Map<String, Double> feats = tx.getFeatures();
        if (feats == null || feats.isEmpty()) {
            throw new IllegalArgumentException("Transaction.features is null or empty for eventId=" + tx.getEventId());
        }
        if (expectedSize <= 0){
            throw new IllegalArgumentException("Invalid expected feature size: " + expectedSize);
        }

        float[] out = new float[expectedSize];
        int i = 0;
        for(Double v : feats.values()){
            if(i >= expectedSize){
                LOG.warn("More features than expected ({}). Truncating for eventId={}",
                        expectedSize, tx.getEventId()
                        );
                break;
            }
            out[i++] = (v != null) ? v.floatValue() : 0.0f;
        }

        if(i < expectedSize){
            LOG.debug("Fewer features ({}) than expected ({}). Padding with zeros for eventId={}",
                    i,
                    expectedSize,
                    tx.getEventId());
        }

        return out;
    }

}
