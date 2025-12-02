package com.frauddetection.ml;

import com.frauddetection.model.OnnxFactories;
import com.frauddetection.model.OnnxScorer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;

public final class ModelLoader {
    private static final Logger LOG = LoggerFactory.getLogger(ModelLoader.class);

    private ModelLoader() {

    }

    public static OnnxScorer loadDefaultScorer() throws Exception {
        String src = envOrDefault("ONNX_MODEL_SRC", "resource");

        try{
            if("path".equalsIgnoreCase(src)){
                String modelPath =  requireEnv("ONNX_MODEL_PATH");
                String sidecarPath = requireEnv("ONNX_SICECAR_PATH");
                LOG.info("Loading ONNX model from path model={} sidecar={}", modelPath, sidecarPath);
                return OnnxFactories.fromPath(Path.of(modelPath), Path.of(sidecarPath));
            } else {
                String resource = envOrDefault("ONNX_MODEL_RESOURCE", "/model/best_model.onnx");
                LOG.info("Loading ONNX model from resource={}", resource);
                return OnnxFactories.fromResource(resource);
            }
        } catch (Exception e){
            LOG.error("Failed to load ONNX model", e);
            throw e;
        }
    }

    private static String envOrDefault(String key, String defaultValue) {
        String v = System.getenv(key);
        return v == null ? defaultValue : v;
    }

    private static String requireEnv(String key){
        String v = System.getenv(key);
        if(v == null || v.isBlank()){
            throw new IllegalStateException("Missing required environment variable " + key);
        }
        return v;
    }
}
