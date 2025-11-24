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


    private Sidecar(List<String> classLabels, String positiveLabel, int nFeatures) {
        this.classLabels = classLabels;
        this.positiveLabel = positiveLabel;
        this.nFeatures = nFeatures;
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

        return new Sidecar(labels, pos, nfeat);
    }

    int positiveIndex() {
        for (int i = 0; i < classLabels.size(); i++){
            if (classLabels.get(i).equalsIgnoreCase(positiveLabel)) return i;
        }
        return -1;
    }
}
