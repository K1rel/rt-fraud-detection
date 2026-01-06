package com.frauddetection.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

final class Sidecar {
    final List<String> classLabels;
    final String positiveLabel;
    final int nFeatures;
    final List<String> featureNames;


    private Sidecar(List<String> classLabels, String positiveLabel, int nFeatures, List<String> featureNames) {
        this.classLabels = classLabels;
        this.positiveLabel = positiveLabel;
        this.nFeatures = nFeatures;
        this.featureNames = featureNames;
    }

    static Sidecar parse(byte[] json) throws IOException {
        ObjectMapper om = new ObjectMapper();
        JsonNode root = om.readTree(json);

        JsonNode arr = root.get("class_labels");
        if(arr == null || !arr.isArray()) throw new IllegalArgumentException("Missing class_labels.");

        List <String> labels = new ArrayList<>();
        for(JsonNode e : arr) labels.add(e.isNumber() ? String.valueOf(e.asInt()) : e.asText());

        JsonNode pl = root.get("positive_label");
        String pos = (pl != null) ? (pl.isNumber() ? String.valueOf(pl.asInt()) : pl.asText()) : "1";

        JsonNode nf = root.get("n_features");
        int nfeat = (nf != null && nf.isInt()) ? nf.asInt() : -1;

        JsonNode fn = root.get("feature_names");
        List<String> names = new ArrayList<>();
        if (fn != null && fn.isArray()) {
            for (JsonNode e : fn) names.add(e.asText());
        }

        if (nfeat <= 0 && !names.isEmpty()) nfeat = names.size();

        if (!names.isEmpty() && names.size() != nfeat) {
            throw new IllegalArgumentException("feature_names size (" + names.size() + ") != n_features (" + nfeat + ")");
        }
        if (names.isEmpty()) {
            throw new IllegalArgumentException("Missing feature_names in sidecar JSON (required to avoid wrong feature order)");
        }

        return new Sidecar(labels, pos, nfeat, names);
    }

    int positiveIndex() {
        for (int i = 0; i < classLabels.size(); i++){
            if (classLabels.get(i).equalsIgnoreCase(positiveLabel)) return i;
        }
        return -1;
    }
}
