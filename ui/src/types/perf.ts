export type PerfRun = {
    runId: string;

    rate?: number;
    durationSec?: number;
    mix?: string;

    txSent?: number;
    avgSendRate?: number;

    flinkAvgInPerSec?: number;
    flinkAvgOutPerSec?: number;

    maxLagFraudDetector?: number;
    maxLagApiStreamer?: number;

    maxBackpressureRatio?: number;

    p50LatencyMs?: number;
    p95LatencyMs?: number;
    p99LatencyMs?: number;

    peakCpu?: string;
    peakRam?: string;

    esIndexTotalDelta?: number;
    notes?: string;

    startedAt?: string;
    createdAt?: string;
};

export type PerfRunsResponse = {
    items: Array<{ id: string; index: string } & PerfRun>;
    pagination: {
        offset: number;
        limit: number;
        total: number;
        returned: number;
        hasMore: boolean;
    };
    timing?: { tookMs: number | null; totalMs: number };
};
