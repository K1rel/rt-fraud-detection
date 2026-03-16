import { Client } from "@elastic/elasticsearch";
import { Router } from "express";
import { createHash } from "crypto";
import {
    PERF_INDEX_PATTERN,
    PERF_INDEX_PREFIX,
    buildPerfRunsSearchBody,
    parsePerfRunsSearchParams,
} from "../es/perfQuery";

function unwrapEsResponse<T = any>(resp: any): T {
    return resp && resp.body ? resp.body : resp;
}

function indexForNow(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${PERF_INDEX_PREFIX}${yyyy}.${mm}`;
}

function normalizeStr(v: unknown): string | undefined {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s.length ? s : undefined;
}

function normalizeNum(v: unknown): number | undefined {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function stableDocId(runId: string): string {
    // deterministic id so re-posting overwrites instead of duplicating
    return createHash("sha256").update(runId).digest("hex").slice(0, 32);
}

export default function createPerfRouter(esClient: Client): Router {
    const router = Router();

    // GET /api/perf/runs?limit=50&offset=0
    router.get("/runs", async (req, res, next) => {
        const started = Date.now();

        try {
            const params = parsePerfRunsSearchParams(req.query);
            const body = buildPerfRunsSearchBody(params);

            const raw = await esClient.search({
                index: PERF_INDEX_PATTERN,
                ...body,
                allow_no_indices: true,
                ignore_unavailable: true,
            } as any);

            const result: any = unwrapEsResponse(raw);
            const hits = result.hits?.hits ?? [];
            const total = result.hits?.total?.value ?? 0;

            const items = hits.map((hit: any) => {
                const src = hit._source || {};
                return {
                    id: hit._id,
                    index: hit._index,
                    ...src,
                };
            });

            res.json({
                items,
                pagination: {
                    offset: params.offset,
                    limit: params.limit,
                    total,
                    returned: items.length,
                    hasMore: params.offset + items.length < total,
                },
                timing: {
                    tookMs: result.took ?? null,
                    totalMs: Date.now() - started,
                },
            });
        } catch (err) {
            next(err);
        }
    });

    // POST /api/perf/runs  (minimal validation, ES is the DB)
    router.post("/runs", async (req, res, next) => {
        try {
            const b = req.body ?? {};
            const runId = normalizeStr(b.runId);
            if (!runId) return res.status(400).json({ error: "Missing runId" });

            const doc = {
                runId,
                rate: normalizeNum(b.rate),
                durationSec: normalizeNum(b.durationSec),
                mix: normalizeStr(b.mix),
                txSent: normalizeNum(b.txSent),
                avgSendRate: normalizeNum(b.avgSendRate),
                flinkAvgInPerSec: normalizeNum(b.flinkAvgInPerSec),
                flinkAvgOutPerSec: normalizeNum(b.flinkAvgOutPerSec),
                maxLagFraudDetector: normalizeNum(b.maxLagFraudDetector),
                maxLagApiStreamer: normalizeNum(b.maxLagApiStreamer),
                maxBackpressureRatio: normalizeNum(b.maxBackpressureRatio),
                p50LatencyMs: normalizeNum(b.p50LatencyMs),
                p95LatencyMs: normalizeNum(b.p95LatencyMs),
                p99LatencyMs: normalizeNum(b.p99LatencyMs),
                peakCpu: normalizeStr(b.peakCpu),
                peakRam: normalizeStr(b.peakRam),
                esIndexTotalDelta: normalizeNum(b.esIndexTotalDelta),
                notes: normalizeStr(b.notes),
                startedAt: normalizeStr(b.startedAt) || new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };

            const idx = indexForNow();
            const id = stableDocId(runId);

            const raw = await esClient.index({
                index: idx,
                id,
                document: doc as any,
                refresh: "wait_for",
            } as any);

            const result: any = unwrapEsResponse(raw);

            res.status(201).json({
                ok: true,
                index: idx,
                id,
                result: result.result ?? "unknown",
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
