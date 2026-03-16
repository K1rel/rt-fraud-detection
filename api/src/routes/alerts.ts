import { Router } from "express";
import { Client } from "@elastic/elasticsearch";
import {
    ALERT_INDEX_PATTERN,
    type AlertSearchParams,
    buildAlertSearchBody,
    parseAlertSearchParams,
    type ReviewStatus,
    type EscalationStatus,
} from "../es/alertsQuery";

function unwrapEsResponse<T = any>(resp: any): T {
    return resp && resp.body ? resp.body : resp;
}

function normalizeReviewStatus(value: unknown): ReviewStatus {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "FALSE_POSITIVE") return "FALSE_POSITIVE";
    if (s === "CLOSED") return "CLOSED";
    return "OPEN";
}

function normalizeEscalationStatus(value: unknown): EscalationStatus {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "ESCALATED") return "ESCALATED";
    return "NONE";
}

function mapHit(hit: any) {
    const src = hit?._source || {};
    return {
        id: hit?._id,
        index: hit?._index,
        ...src,
        reviewStatus: normalizeReviewStatus(src?.reviewStatus),
        escalationStatus: normalizeEscalationStatus(src?.escalationStatus),
    };
}

async function findAlertHit(esClient: Client, id: string): Promise<any | null> {
    const raw = await esClient.search({
        index: ALERT_INDEX_PATTERN,
        size: 1,
        allow_no_indices: true,
        ignore_unavailable: true,
        sort: [
            {
                createdAt: {
                    order: "desc" as const,
                    unmapped_type: "date",
                },
            },
        ],
        query: {
            bool: {
                should: [
                    { ids: { values: [id] } },
                    { term: { "alertId.keyword": id } },
                    { term: { alertId: id } },
                ],
                minimum_should_match: 1,
            },
        },
    } as any);

    const result: any = unwrapEsResponse(raw);
    const hits = result.hits?.hits ?? [];
    return hits.length ? hits[0] : null;
}

export default function createAlertsRouter(esClient: Client): Router {
    const router = Router();

    router.get("/", async (req, res, next) => {
        try {
            const params: AlertSearchParams = parseAlertSearchParams(req.query);
            const body = buildAlertSearchBody(params);

            const raw = await esClient.search({
                index: ALERT_INDEX_PATTERN,
                ...body,
                allow_no_indices: true,
                ignore_unavailable: true,
            } as any);

            const result: any = unwrapEsResponse(raw);
            const hits = result.hits?.hits ?? [];

            const totalRaw = result.hits?.total;
            const total =
                typeof totalRaw === "number" ? totalRaw : totalRaw?.value ?? 0;

            const items = hits.map(mapHit);

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
                },
                filters: params,
            });
        } catch (err) {
            next(err);
        }
    });

    router.patch("/:id/review", async (req, res, next) => {
        try {
            const id = String(req.params.id ?? "").trim();
            if (!id) {
                return res.status(400).json({ error: "Missing alert id" });
            }

            const reviewStatusRaw = String(req.body?.reviewStatus ?? "")
                .trim()
                .toUpperCase();

            if (
                reviewStatusRaw !== "OPEN" &&
                reviewStatusRaw !== "FALSE_POSITIVE" &&
                reviewStatusRaw !== "CLOSED"
            ) {
                return res.status(400).json({
                    error: "Invalid reviewStatus. Expected OPEN, FALSE_POSITIVE, or CLOSED",
                });
            }

            const reviewStatus = reviewStatusRaw as ReviewStatus;
            const hit = await findAlertHit(esClient, id);

            if (!hit) {
                return res.status(404).json({ error: "Alert not found", id });
            }

            const reviewedAt = new Date().toISOString();

            await esClient.update({
                index: hit._index,
                id: hit._id,
                refresh: "wait_for",
                doc: {
                    reviewStatus,
                    reviewedAt,
                },
            } as any);

            const updated = mapHit({
                ...hit,
                _source: {
                    ...(hit._source || {}),
                    reviewStatus,
                    reviewedAt,
                },
            });

            return res.json({
                ok: true,
                item: updated,
            });
        } catch (err) {
            next(err);
        }
    });

    router.patch("/:id/escalation", async (req, res, next) => {
        try {
            const id = String(req.params.id ?? "").trim();
            if (!id) {
                return res.status(400).json({ error: "Missing alert id" });
            }

            const escalationStatusRaw = String(req.body?.escalationStatus ?? "")
                .trim()
                .toUpperCase();

            if (
                escalationStatusRaw !== "NONE" &&
                escalationStatusRaw !== "ESCALATED"
            ) {
                return res.status(400).json({
                    error: "Invalid escalationStatus. Expected NONE or ESCALATED",
                });
            }

            const escalationStatus = escalationStatusRaw as EscalationStatus;
            const hit = await findAlertHit(esClient, id);

            if (!hit) {
                return res.status(404).json({ error: "Alert not found", id });
            }

            const escalatedAt =
                escalationStatus === "ESCALATED"
                    ? new Date().toISOString()
                    : null;

            await esClient.update({
                index: hit._index,
                id: hit._id,
                refresh: "wait_for",
                doc: {
                    escalationStatus,
                    escalatedAt,
                },
            } as any);

            const updated = mapHit({
                ...hit,
                _source: {
                    ...(hit._source || {}),
                    escalationStatus,
                    escalatedAt,
                },
            });

            return res.json({
                ok: true,
                item: updated,
            });
        } catch (err) {
            next(err);
        }
    });

    router.get("/:id", async (req, res, next) => {
        try {
            const id = String(req.params.id ?? "").trim();
            if (!id) {
                return res.status(400).json({ error: "Missing alert id" });
            }

            const hit = await findAlertHit(esClient, id);

            if (!hit) {
                return res.status(404).json({ error: "Alert not found", id });
            }

            return res.json(mapHit(hit));
        } catch (err) {
            next(err);
        }
    });

    return router;
}