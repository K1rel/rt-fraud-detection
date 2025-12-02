package com.frauddetection.ml;

import com.frauddetection.model.OnnxScorer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModelLoaderTest {


    @Test
    void loadDefaultScorerFromResource() throws Exception {
        try (OnnxScorer scorer = ModelLoader.loadDefaultScorer()){
            assertNotNull(scorer, "Scorer should not be null");
            assertTrue(scorer.getFeatureCount() > 0, "Feature count must be > 0");
        }
    }

    @Test
    void scoreReturnsProbabilityBetweenZeroAndOne() throws Exception {
        try(OnnxScorer scorer = ModelLoader.loadDefaultScorer()){
            int f = scorer.getFeatureCount();
            float[] x = new float[f];
            float p = scorer.score(x);
            assertTrue(p >= 0.0f && p <= 1.0f, "Probability should be between 0.0 and 1.0");
        }
    }
}
