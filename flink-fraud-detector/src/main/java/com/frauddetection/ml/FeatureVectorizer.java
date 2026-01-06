package com.frauddetection.ml;

import com.frauddetection.domain.transaction.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class FeatureVectorizer {
    private static final Logger LOG = LoggerFactory.getLogger(FeatureVectorizer.class);

    private FeatureVectorizer() {

    }

    public static float[] toFeatureVector(Transaction tx, List<String> featureOrder) {
        Map<String, Double> feats = tx.getFeatures();
        if (feats == null || feats.isEmpty()) {
            throw new IllegalArgumentException("Transaction.features is null or empty for eventId=" + tx.getEventId());
        }
        if (featureOrder == null || featureOrder.isEmpty()) {
            throw new IllegalArgumentException("featureOrder is null/empty for eventId=" + tx.getEventId());
        }

        float[] out = new float[featureOrder.size()];
        for (int i = 0; i < featureOrder.size(); i++) {
            String name = featureOrder.get(i);
            Double v = feats.get(name);
            out[i] = (v != null) ? v.floatValue() : 0.0f;
        }
        return out;
    }
    public static LinkedHashMap<String, Double> toOrderedFeatureMap(Transaction tx, List<String> featureOrder) {
        Map<String, Double> feats = tx.getFeatures();
        if (feats == null) feats = Map.of();

        LinkedHashMap<String, Double> out = new LinkedHashMap<>();
        for (String name : featureOrder) {
            Double v = feats.get(name);
            out.put(name, v != null ? v : 0.0);
        }
        return out;
    }

    public static float[] toFeatureVector(Map<String, Double> feats, java.util.List<String> featureOrder) {
        if (feats == null || feats.isEmpty()) {
            throw new IllegalArgumentException("features map is null/empty");
        }
        if (featureOrder == null || featureOrder.isEmpty()) {
            throw new IllegalArgumentException("featureOrder is null/empty");
        }

        float[] out = new float[featureOrder.size()];
        for (int i = 0; i < featureOrder.size(); i++) {
            String name = featureOrder.get(i);
            Double v = feats.get(name);
            out[i] = (v != null) ? v.floatValue() : 0.0f;
        }
        return out;
    }

}
