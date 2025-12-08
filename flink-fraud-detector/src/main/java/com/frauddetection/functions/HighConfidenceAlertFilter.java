package com.frauddetection.functions;

import com.frauddetection.domain.alert.FraudAlert;
import org.apache.flink.api.common.functions.FilterFunction;

public class HighConfidenceAlertFilter implements FilterFunction<FraudAlert> {

    private final double scoreThreshold;

    public HighConfidenceAlertFilter(double scoreThreshold) {
        this.scoreThreshold = scoreThreshold;
    }


    @Override
    public boolean filter(FraudAlert alert) throws Exception {
        if(alert == null){
            return false;
        }
        return alert.getFraudScore() > scoreThreshold;
    }
}
