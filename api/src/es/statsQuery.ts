export type BuildStatsOptions = {
    topCardsSize?: number;
};

export type BuildTrendsOptions = {
    startIso: string;
    endIso: string;
    histogramInterval?: number;
    timeBucketInterval?: string; // e.g. "1m", "5m", "1h", "6h"
};

export function buildStatsAggBody(opts: BuildStatsOptions = {}): Record<string, any> {
    const topCardsSize = Number.isFinite(opts.topCardsSize)
        ? Math.max(1, Math.min(50, opts.topCardsSize!))
        : 10;

    return {
        size: 0,
        query: { match_all: {} },
        aggs: {
            total_count: {
                filter: { match_all: {} },
            },
            last_hour: { filter: { range: { eventTime: { gte: "now-1h", format: "strict_date_optional_time" }}}},
            last_day:  { filter: { range: { eventTime: { gte: "now-24h", format: "strict_date_optional_time" }}}},
            last_week: { filter: { range: { eventTime: { gte: "now-7d", format: "strict_date_optional_time" }}}},

            avg_fraud_score: {
                avg: { field: "fraudScore" },
            },
            by_detection_method: {
                terms: {
                    field: "detectionMethod",
                    size: 16,
                    order: { _count: "desc" },
                },
            },
            by_severity: {
                terms: {
                    field: "severity",
                    size: 16,
                    order: { _count: "desc" },
                },
            },
            top_cards: {
                terms: {
                    field: "cardId.keyword",
                    size: topCardsSize,
                    order: { _count: "desc" },
                },
            },
        },
    };
}

export function buildTrendsAggBody(opts: BuildTrendsOptions): Record<string, any> {
    const histogramInterval = Number.isFinite(opts.histogramInterval)
        ? Math.max(0.01, Math.min(1, opts.histogramInterval!))
        : 0.1;

    const timeBucketInterval = String(opts.timeBucketInterval ?? "1h").trim() || "1h";

    return {
        size: 0,
        query: {
            range: {
                eventTime: {
                    gte: opts.startIso,
                    lte: opts.endIso,
                    format: "strict_date_optional_time",
                },
            },
        },
        aggs: {
            alerts_per_hour: {
                date_histogram: {
                    field: "eventTime",
                    fixed_interval: timeBucketInterval,
                    time_zone: "UTC",
                    min_doc_count: 0,
                    extended_bounds: {
                        min: opts.startIso,
                        max: opts.endIso,
                    },
                },
                aggs: {
                    avg_score: { avg: { field: "fraudScore" } },
                },
            },
            score_histogram: {
                histogram: {
                    field: "fraudScore",
                    interval: histogramInterval,
                    min_doc_count: 0,
                    extended_bounds: { min: 0, max: 1 },
                },
            },
        },
    };
}

export function unwrapEsResponse<T = any>(resp: any): T {
    return resp && resp.body ? resp.body : resp;
}
