package com.frauddetection;

import org.apache.flink.api.common.RuntimeExecutionMode;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;

public class FraudDetectionJob{
    public static void main(String[] args) throws Exception {
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setRuntimeMode(RuntimeExecutionMode.STREAMING);

        DataStream<String> bootstrap = env.fromData("fraud-detector-online");
        bootstrap.map(v -> v).name("bootstrap").print().name("stdout");

        env.execute("FraudDetection - skeleton");
    }
}