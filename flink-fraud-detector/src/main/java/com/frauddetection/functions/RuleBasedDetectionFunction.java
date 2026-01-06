package com.frauddetection.functions;

import com.frauddetection.config.RuleConfig;
import com.frauddetection.domain.alert.AlertReason;
import com.frauddetection.domain.alert.FraudAlert;
import com.frauddetection.domain.transaction.ScoredTransaction;
import com.frauddetection.domain.transaction.Transaction;
import org.apache.flink.api.common.functions.OpenContext;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.EnumSet;

public class RuleBasedDetectionFunction extends KeyedProcessFunction<String, ScoredTransaction, FraudAlert> {

    private static final Logger LOG = LoggerFactory.getLogger(RuleBasedDetectionFunction.class);

    private final RuleConfig config;

    private transient ValueState<Long> windowStartMsState;
    private transient ValueState<Long> windowCountState;

    private transient ValueState<Long> lastEventTimeMsState;


    public RuleBasedDetectionFunction(RuleConfig config) {
        this.config = config;
    }

    @Override
    public void open(OpenContext openContext) throws Exception {
        ValueStateDescriptor<Long> windowStartDesc = new ValueStateDescriptor<>("rb.windowStartMs", Long.class);
        ValueStateDescriptor<Long> windowCountDesc = new ValueStateDescriptor<>("rb.windowCount", Long.class);
        ValueStateDescriptor<Long> lastEventTimeDesc = new ValueStateDescriptor<>("rb.lastEventTimeMs", Long.class);

        windowStartMsState = getRuntimeContext().getState(windowStartDesc);
        windowCountState = getRuntimeContext().getState(windowCountDesc);
        lastEventTimeMsState = getRuntimeContext().getState(lastEventTimeDesc);

        LOG.info("RuleBasedDetectionFunction initialized with {}", config);
    }


    @Override
    public void processElement(ScoredTransaction scored, Context ctx, Collector<FraudAlert> out) throws Exception {
        if (scored == null || scored.getTransaction() == null){
            return;
        }

        final Transaction tx = scored.getTransaction();
        final String key = ctx.getCurrentKey();

        final long nowProc = ctx.timerService().currentProcessingTime();
        final long eventTimeMs = ctx.timestamp() != null ? ctx.timestamp() : nowProc;

        EnumSet<AlertReason> reasons = EnumSet.noneOf(AlertReason.class);

        if(scored.getFraudScore() >= config.getModelScoreThreshold()){
            reasons.add(AlertReason.HIGH_MODEL_SCORE);
        }

        Long windowStartMs = windowStartMsState.value();
        Long count = windowCountState.value();

        if(windowStartMs == null){
            windowStartMs = nowProc;
            windowStartMsState.update(windowStartMs);
            count = 0L;

            long timerTs = windowStartMs + config.getFrequencyWindowMs();
            ctx.timerService().registerProcessingTimeTimer(timerTs);
        }

        long newCount = (count == null ? 0L : count) + 1L;
        windowCountState.update(newCount);

        if (newCount > config.getMaxTxPerMinute()){
            reasons.add(AlertReason.HIGH_TX_FREQUENCY);
        }

        double amount = tx.getAmount();
        if(amount > config.getHighAmountThreshold()){
            reasons.add(AlertReason.HIGH_TX_AMOUNT);
        }

        Long lastEventTimeMs = lastEventTimeMsState.value();
        if(lastEventTimeMs != null){
            long deltaMs = Math.abs(eventTimeMs - lastEventTimeMs);
            if(deltaMs < config.getVelocityMinGapMs()){
                reasons.add(AlertReason.HIGH_VELOCITY);
            }
        }
        lastEventTimeMsState.update(eventTimeMs);

        if (!reasons.isEmpty()) {
            FraudAlert alert = FraudAlert.fromScoredTransaction(scored, reasons, nowProc);
            if(LOG.isDebugEnabled()){
                LOG.debug("Emitting alert for key{} reasons={}", key, reasons);
            }
            out.collect(alert);
        }

    }

    @Override
    public void onTimer(
            long timestamp,
            OnTimerContext ctx,
            Collector<FraudAlert> out
    ){
        windowStartMsState.clear();
        windowCountState.clear();
    }
}
