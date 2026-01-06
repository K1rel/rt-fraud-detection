export interface StatsResponse {
    totalAlerts?: number;
    windows?: Record<string, number>;
    avgFraudScore?: number;
    breakdown?: Record<string, Array<Record<string, unknown>>>;
    topCards?: Array<{ card: string; count: number }>;
    [k: string]: unknown;
}
