package com.frauddetection.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.InputStream;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.*;


public class OnnxParityTest {

    @Test
    public void javaMatchesPythonOnnxRuntime() throws Exception {

        try (InputStream is = getClass().getResourceAsStream("/ref/ref_batch.json")) {
            assertNotNull(is, "Missing /ref/ref_batch.json (run ml-model/scripts/make_ref_batch.py)");

            ObjectMapper om = new ObjectMapper();
            JsonNode node = om.readTree(is);

            int F = node.get("n_features").asInt();
            JsonNode Xnode = node.get("X");

            JsonNode Pnode = node.has("proba_py_onnx") ? node.get("proba_py_onnx") : node.get("proba_py");
            assertNotNull(Pnode, "Reference probs missing (need proba_py_onnx or proba_py)");

            int N = Xnode.size();
            float[][] X = new float[N][F];
            float[] p_py = new float[N];

            for (int i = 0; i < N; i++) {
                JsonNode row = Xnode.get(i);
                assertEquals(F, row.size(), "Feature width mismatch at row " + i);
                for (int j = 0; j < F; j++) X[i][j] = (float) row.get(j).asDouble();
                p_py[i] = (float) Pnode.get(i).asDouble();
            }

            try (OnnxScorer scorer = OnnxScorer.fromResource("/model/best_model.onnx")) {
                float[] p_java = scorer.scoreBatch(X);

                double maxAbs = 0.0, mae = 0.0;
                for (int i = 0; i < N; i++) {
                    double d = Math.abs(p_java[i] - p_py[i]);
                    maxAbs = Math.max(maxAbs, d);
                    mae += d;
                }

                mae /= N;

                System.out.printf("{\"parity_max_abs\": %.9f, \"parity_mae\": %.9f, \"n\": %d}%n", maxAbs, mae, N);
                assertTrue(maxAbs < 1e-6, "Parity failed. max_abs=" + maxAbs);
            }
        }
    }
}
