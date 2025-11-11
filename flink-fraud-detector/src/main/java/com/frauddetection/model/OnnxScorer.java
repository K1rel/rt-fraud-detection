package com.frauddetection.model;

import ai.onnxruntime.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class OnnxScorer implements AutoCloseable{
    private final OrtEnvironment env;
    private final OrtSession session;
    private final String inputName;
    private final String outputName;
    private final int featureCount;
    private final int positiveIndex;

    public OnnxScorer(OrtEnvironment env, OrtSession session, String inputName, String outputName, int featureCount, int positiveIndex) {
        this.env = env;
        this.session = session;
        this.inputName = inputName;
        this.outputName = outputName;
        this.featureCount = featureCount;
        this.positiveIndex = positiveIndex;
    }

    // --- FACTORIES ---

    public static OnnxScorer fromResource(String resourcePath) throws OrtException, IOException {
       byte[] model = readAllResource(resourcePath);
       String sidecarRes = siblingJson(resourcePath, "class_labels.json");
       byte[] sidecar = readAllResource(sidecarRes);
       return fromBytes(model, sidecar);
    }

    public static OnnxScorer fromPath(Path modelPath, Path sidecarPath) throws OrtException, IOException {
        byte[] model = Files.readAllBytes(modelPath);
        byte[] sidecar = Files.readAllBytes(sidecarPath);
        return fromBytes(model, sidecar);
    }

    // ----- CORE -----

    private static OnnxScorer fromBytes(byte[] model, byte[] sidecarJson) throws OrtException, IOException {

        if (model == null || model.length == 0){
            throw new IllegalArgumentException("Empty ONNX model.");
        }
        if(sidecarJson == null || sidecarJson.length == 0){
            throw new IllegalArgumentException("Missing class_labels sidecar.");
        }

        Sidecar sidecar = Sidecar.parse(sidecarJson);

        OrtEnvironment env = OrtEnvironment.getEnvironment();
        OrtSession session;

        try(OrtSession.SessionOptions so = new OrtSession.SessionOptions()){
            so.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            session = env.createSession(model, so);
        }

        if(session.getInputNames().size() != 1) throw new IllegalStateException("Expected exactly one input, got " + session.getInputNames().size());

        int numOutputs = session.getOutputNames().size();
        if(numOutputs < 1 || numOutputs > 2){
            throw new IllegalStateException("Expected 1 or 2 outputs, got " + numOutputs);
        }

        String inName = session.getInputNames().iterator().next();
        NodeInfo ninfo = session.getInputInfo().get(inName);

        if(!(ninfo.getInfo() instanceof TensorInfo ti)) throw new IllegalStateException("Input is not a tensor.");
        if(ti.type != OnnxJavaType.FLOAT) throw new IllegalStateException("Expected FLOAT input, got " + ti.type);

        long[] shape = ti.getShape();
        int featFromModel = deduceFeatureCount(shape);
        int featFromSidecar = sidecar.nFeatures;

        if(featFromSidecar <= 0) throw new IllegalStateException("Sidecar must have at least one feature.");
        if(featFromModel > 0 && featFromModel != featFromSidecar) throw new IllegalStateException("Model features is not equal to sidecar features.");

        int featureCount = (featFromModel > 0) ? featFromModel : featFromSidecar;

        String probOutName = null;
        TensorInfo probInfo = null;
        for(String name : session.getOutputNames()){
            NodeInfo oi = session.getOutputInfo().get(name);
            if(oi.getInfo() instanceof TensorInfo to && to.type == OnnxJavaType.FLOAT){
                probOutName = name;
                probInfo = to;
                break;
            }
        }
        if(probOutName == null){
            throw new IllegalStateException("No Float tesnor output found.");
        }

        long[] odims = probInfo.getShape();
        int classesFromModel = deduceClasses(odims);
        if (classesFromModel > 0 && classesFromModel != sidecar.classLabels.size()) throw new IllegalStateException("Classes from model is not equal to sidecar class labels.");

        int positiveIndex = sidecar.positiveIndex();
        if(positiveIndex < 0)
            throw new IllegalStateException("Positive label missing in sidecar.");

        return new OnnxScorer(env, session, inName, probOutName, featureCount, positiveIndex);
    }

    private static int deduceFeatureCount(long[] shape) {
        if(shape == null || shape.length == 0) return -1;
        long last = (shape.length >= 2) ? shape[shape.length - 1] : shape[0];
        return (last > 0) ? (int) last : -1;
    }

    private static int deduceClasses(long[] shape){
        if(shape == null || shape.length == 0) return -1;
        long last = (shape.length >= 2) ? shape[shape.length - 1] : shape[0];
        return (last > 0) ? (int) last : -1;
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

    private static byte[] readAllResource(String resPath) throws IOException {
        try(InputStream is = OnnxScorer.class.getResourceAsStream(resPath)){
            if (is == null) throw new IOException("Resource not found: " + resPath);
            return is.readAllBytes();
        }
    }

    private static String siblingJson(String resPath, String fileName){
        int idx = resPath.lastIndexOf("/");
        String dir = (idx >= 0) ? resPath.substring(0, idx) : "";
        if (dir.isEmpty()) return "/" + fileName;
        return dir + "/" + fileName;
    }


    private static final class Sidecar {
        final List<String> classLabels;
        final String positiveLabel;
        final int nFeatures;


        private Sidecar(List<String> classLabels, String positiveLabel, int nFeatures) {
            this.classLabels = classLabels;
            this.positiveLabel = positiveLabel;
            this.nFeatures = nFeatures;
        }

        static Sidecar parse(byte[] json) throws IOException{
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
}
