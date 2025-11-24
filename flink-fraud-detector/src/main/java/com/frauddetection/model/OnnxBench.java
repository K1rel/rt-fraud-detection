package com.frauddetection.model;

import java.nio.file.Path;
import java.util.Random;

public final class OnnxBench {
    public static void main(String[] args) throws Exception {
        String src = (args.length > 0 ? args[0] : "resource");
        long N = (args.length > 1 ? Long.parseLong(args[1]) : 10000L);

        OnnxScorer tmp = ("path".equalsIgnoreCase(src) && args.length > 3)
                ? OnnxFactories.fromPath(Path.of(args[2]), Path.of(args[3]))
                : OnnxFactories.fromResource("/model/best_model.onnx");

        try (OnnxScorer scorer = tmp){
            int F = scorer.getFeatureCount();
            float[][] X = new float[(int) N][F];
            Random rnd = new Random(42);
            for (int i = 0; i < N; i++){
                for(int j =0; j < F; j++)
                    X[i][j] = (float) rnd.nextGaussian();
            }

            int warm = (int) Math.min(32, N);
            scorer.scoreBatch(slice(X, warm));

            long t0 = System.nanoTime();
            scorer.scoreBatch(X);
            long t1 = System.nanoTime();

            double msPerRow = (t1 - t0) / 1_000_000.0 / N;
            System.out.printf("{\"java_ms_per_row\": %.6f, \"n\": %d, \"features\": %d}%n", msPerRow, N, F);
        }
    }

    private static float[][] slice(float[][] X, int n){
        float[][] out = new float[n][X[0].length];
        System.arraycopy(X, 0, out, 0, n);
        return out;
    }
}
