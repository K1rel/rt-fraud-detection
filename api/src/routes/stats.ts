import { Client } from "@elastic/elasticsearch";
import { Router } from "express";
import { cacheJson } from "../middleware/cache";
import { buildStatsAggBody, buildTrendsAggBody, unwrapEsResponse } from "../es/statsQuery";
import { ALERT_INDEX_PATTERN } from "../es/alertsQuery";
import { createHash } from "crypto";

function toInt(value: unknown, def: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : def;
}

function sha256Short(input: string): string {
    return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

type TrendsRange = "1h" | "6h" | "24h" | "7d";

function parseTrendsRange(raw: unknown): TrendsRange {
    const s = String(raw ?? "").trim().toLowerCase();
    if (s === "1h" || s === "6h" || s === "24h" || s === "7d") return s;
    return "24h";
}

function rangeToMs(r: TrendsRange): number {
    switch (r) {
        case "1h":
            return 1 * 60 * 60 * 1000;
        case "6h":
            return 6 * 60 * 60 * 1000;
        case "24h":
            return 24 * 60 * 60 * 1000;
        case "7d":
            return 7 * 24 * 60 * 60 * 1000;
    }
}

function rangeToBucketInterval(r: TrendsRange): string {
    // keep bucket count modest on a laptop
    switch (r) {
        case "1h":
            return "1m";
        case "6h":
            return "5m";
        case "24h":
            return "1h";
        case "7d":
            return "6h";
    }
}

export default function createStatsRouter(esClient: Client): Router {
    const router = Router();

    const cacheTtlMs = toInt(process.env.STATS_CACHE_TTL_MS, 10_000);
    const saltRaw = process.env.STATS_ANON_SALT;
    if (!saltRaw) throw new Error("Missing STATS_ANON_SALT");
    const anonSalt = saltRaw.trim();

    router.get("/", cacheJson(cacheTtlMs), async (req, res, next) => {
        const started = Date.now();

        try {
            const body = buildStatsAggBody({ topCardsSize: 10 });

            const raw = await esClient.search({
                index: ALERT_INDEX_PATTERN,
                ...body,
                request_cache: true,
                allow_no_indices: true,
                ignore_unavailable: true,
                filter_path: ["took", "aggregations"],
            } as any);

            const result: any = unwrapEsResponse(raw);
            const aggs = result.aggregations || {};

            const totalAlerts = aggs.total_count?.doc_count ?? 0;

            const lastHour = aggs.last_hour?.doc_count ?? 0;
            const prevHour = aggs.prev_hour?.doc_count ?? 0;
            const lastDay = aggs.last_day?.doc_count ?? 0;
            const prevDay  = aggs.prev_day?.doc_count ?? 0;

            const lastWeek = aggs.last_week?.doc_count ?? 0;

            const avgFraudScore = aggs.avg_fraud_score?.value ?? null;

            const byDetectionMethod = (aggs.by_detection_method?.buckets ?? []).map((b: any) => ({
                method: String(b.key),
                count: b.doc_count ?? 0,
            }));

            const bySeverity = (aggs.by_severity?.buckets ?? []).map((b: any) => ({
                severity: String(b.key),
                count: b.doc_count ?? 0,
            }));

            const topCards = (aggs.top_cards?.buckets ?? []).map((b: any) => ({
                card: sha256Short(`${anonSalt}:${String(b.key)}`),
                count: b.doc_count ?? 0,
            }));

            return res.json({
                totalAlerts,
                windows: {
                    lastHour,
                    prevHour,
                    lastDay,
                    prevDay,
                    lastWeek,
                },
                avgFraudScore,
                breakdown: {
                    detectionMethod: byDetectionMethod,
                    severity: bySeverity,
                },
                topCards,
                timing: {
                    esTookMs: result.took ?? null,
                    totalMs: Date.now() - started,
                },
            });
        } catch (err) {
            next(err);
        }
    });

    // GET /api/stats/trends?range=1h|6h|24h|7d
    router.get("/trends", cacheJson(cacheTtlMs), async (req, res, next) => {
        const started = Date.now();

        try {
            const range = parseTrendsRange(req.query.range);

            const end = new Date();
            const start = new Date(end.getTime() - rangeToMs(range));

            const body = buildTrendsAggBody({
                startIso: start.toISOString(),
                endIso: end.toISOString(),
                histogramInterval: 0.1,
                timeBucketInterval: rangeToBucketInterval(range),
            });

            const raw = await esClient.search({
                index: ALERT_INDEX_PATTERN,
                ...body,
                request_cache: true,
                allow_no_indices: true,
                ignore_unavailable: true,
                filter_path: ["took", "aggregations"],
            } as any);

            const result: any = unwrapEsResponse(raw);
            const aggs = result.aggregations || {};

            const perHour = (aggs.alerts_per_hour?.buckets ?? []).map((b: any) => ({
                hour: b.key_as_string ?? new Date(b.key).toISOString(),
                count: b.doc_count ?? 0,
                avgFraudScore: b.avg_score?.value ?? null,
            }));

            const scoreHistogram = (aggs.score_histogram?.buckets ?? []).map((b: any) => ({
                bucket: b.key,
                count: b.doc_count ?? 0,
            }));

            return res.json({
                range,
                perHour,
                scoreHistogram,
                timing: {
                    esTookMs: result.took ?? null,
                    totalMs: Date.now() - started,
                },
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
