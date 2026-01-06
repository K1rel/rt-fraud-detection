package com.frauddetection.model;

import ai.onnxruntime.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public final class OnnxScorer implements AutoCloseable{
    private final OrtEnvironment env;
    private final OrtSession session;
    private final String inputName;
    private final String outputName;
    private final int featureCount;
    private final int positiveIndex;
    private final List<String> featureNames;

    public OnnxScorer(OrtEnvironment env, OrtSession session, String inputName, String outputName, int featureCount, int positiveIndex, List<String> featureNames) {
        this.env = env;
        this.session = session;
        this.inputName = inputName;
        this.outputName = outputName;
        this.featureCount = featureCount;
        this.positiveIndex = positiveIndex;
        this.featureNames = featureNames;
    }

    // ----- API -----

    public int getFeatureCount() {return featureCount;}

    public float score(float[] x) throws Exception{
        if (x.length != featureCount) throw new IllegalArgumentException("Expected  " + featureCount + " features, got " + x.length);
        return scoreBatch(new float[][] { x })[0];
    }


    public float[] scoreBatch(float[][] X) throws OrtException {
        if (X.length == 0) return new float[0];
        try(OnnxTensor input = OnnxTensor.createTensor(env, X)){
            Map<String, OnnxTensor> feed = Collections.singletonMap(inputName, input);
            try (OrtSession.Result r = session.run(feed, java.util.Set.of(outputName))){

                @SuppressWarnings("resource")
                OnnxValue v = r.get(outputName).orElseThrow(() -> new IllegalStateException("Missing output: " + outputName));


                if (!(v instanceof OnnxTensor t))
                    throw new IllegalStateException("Expected OnnxTensor, got " + v.getClass());

                Object val = t.getValue();

                if(val instanceof float[][] out2d){
                    int cols = out2d[0].length;

                    int col = (cols >= 2) ? positiveIndex : 0;

                    float[] p = new float[out2d.length];
                    for(int i = 0; i < out2d.length; i++) p[i] = out2d[i][col];
                    return p;
                } else if (val instanceof float[] out1d) {

                    return out1d.clone();
                } else {
                    var fb = t.getFloatBuffer();
                    fb.rewind();
                    float[] out = new float[fb.remaining()];

                    fb.get(out);

                    return out;
                }
            }
        }
    }

    @Override
    public void close() throws Exception {
        session.close();
        env.close();
    }

    // ---- HELPERS -----

    public List<String> getFeatureNames() {
        return featureNames;
    }
}
