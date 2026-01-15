export type StatsWindows = {
    lastHour: number;
    prevHour: number;
    lastDay: number;
    prevDay: number;
    lastWeek: number;
};

export type StatsBreakdown = {
    detectionMethod: Array<{ method: string; count: number }>;
    severity: Array<{ severity: string; count: number }>;
};

export type StatsResponse = {
    totalAlerts: number;
    windows: StatsWindows;
    avgFraudScore: number | null;
    breakdown: StatsBreakdown;
    topCards: Array<{ card: string; count: number }>;
    timing?: { esTookMs: number | null; totalMs: number };
};

export type TrendsResponse = {
    range?: string;
    perHour: Array<{ hour: string; count: number; avgFraudScore: number | null }>;
    scoreHistogram: Array<{ bucket: number; count: number }>;
    timing?: { esTookMs: number | null; totalMs: number };
};
