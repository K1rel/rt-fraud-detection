export type ReviewStatus = "OPEN" | "FALSE_POSITIVE" | "CLOSED";
export type EscalationStatus = "NONE" | "ESCALATED";

export interface AlertSearchParams {
    limit: number;
    offset: number;
    since?: string;
    until?: string;
    scoreMin?: number;
    scoreMax?: number;
    detectionMethods?: string[];
    severities?: string[];
    reviewStatus?: ReviewStatus;
    escalationStatus?: EscalationStatus;
    q?: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const ALERT_INDEX_PREFIX =
    process.env.ELASTICSEARCH_ALERT_INDEX_PREFIX;
export const ALERT_INDEX_PATTERN = `${ALERT_INDEX_PREFIX}*`;

function parseNumber(value: unknown, defaultValue: number): number {
    if (value === undefined || value === null) return defaultValue;

    const n = Number(value);
    if (!Number.isFinite(n)) return defaultValue;

    return n;
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
}

function parseIsoDate(value: unknown): string | undefined {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

function parseList(value: unknown): string[] | undefined {
    if (!value) return undefined;

    if (Array.isArray(value)) {
        const normalized = value
            .map((v) => String(v).trim())
            .filter((v) => v.length > 0);
        return normalized.length ? normalized : undefined;
    }

    const str = String(value).trim();
    if (!str) return undefined;

    const parts = str
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    return parts.length ? parts : undefined;
}

function normalizeToUpper(list?: string[]): string[] | undefined {
    if (!list) return undefined;

    const normalized = list.map((s) => s.toUpperCase());
    return normalized.length ? normalized : undefined;
}

function parseSearch(value: unknown): string | undefined {
    const s = String(value ?? "").trim();
    if (!s) return undefined;
    return s.slice(0, 120);
}

function parseReviewStatus(value: unknown): ReviewStatus | undefined {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "OPEN" || s === "FALSE_POSITIVE" || s === "CLOSED") return s;
    return undefined;
}

function parseEscalationStatus(value: unknown): EscalationStatus | undefined {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "NONE" || s === "ESCALATED") return s;
    return undefined;
}

function escapeWildcard(value: string): string {
    return value.replace(/[\\*?]/g, "\\$&");
}

function uniq(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
}

export function parseAlertSearchParams(query: any): AlertSearchParams {
    const limit = clamp(parseNumber(query.limit, DEFAULT_LIMIT), 1, MAX_LIMIT);
    const offset = Math.max(0, parseNumber(query.offset, 0));

    const since = parseIsoDate(query.since);
    const until = parseIsoDate(query.until);

    const scoreMin =
        query.scoreMin !== undefined && query.scoreMin !== null
            ? Number(query.scoreMin)
            : undefined;

    const scoreMax =
        query.scoreMax !== undefined && query.scoreMax !== null
            ? Number(query.scoreMax)
            : undefined;

    const detectionMethods = normalizeToUpper(
        parseList(query.detectionMethods ?? query["detectionMethods[]"])
    );

    const severities = normalizeToUpper(
        parseList(query.severities ?? query["severities[]"])
    );

    const reviewStatus = parseReviewStatus(query.reviewStatus);
    const escalationStatus = parseEscalationStatus(query.escalationStatus);
    const q = parseSearch(query.q);

    const params: AlertSearchParams = {
        limit,
        offset,
    };

    if (since) params.since = since;
    if (until) params.until = until;

    if (scoreMin !== undefined && Number.isFinite(scoreMin)) {
        params.scoreMin = scoreMin;
    }

    if (scoreMax !== undefined && Number.isFinite(scoreMax)) {
        params.scoreMax = scoreMax;
    }

    if (detectionMethods && detectionMethods.length) {
        params.detectionMethods = detectionMethods;
    }

    if (severities && severities.length) {
        params.severities = severities;
    }

    if (reviewStatus) {
        params.reviewStatus = reviewStatus;
    }

    if (escalationStatus) {
        params.escalationStatus = escalationStatus;
    }

    if (q) {
        params.q = q;
    }

    return params;
}

function buildSearchClause(q: string): Record<string, any> {
    const raw = q.trim();
    const compact = raw.replace(/\s+/g, "");
    const alnum = raw.replace(/[^a-zA-Z0-9]/g, "");

    const wildcardCandidates = uniq([raw, compact, alnum])
        .map((x) => x.trim())
        .filter((x) => x.length >= 3 && x.length <= 64);

    const should: any[] = [
        { constant_score: { filter: { term: { "alertId.keyword": raw } }, boost: 100 } },
        { constant_score: { filter: { term: { alertId: raw } }, boost: 95 } },

        { constant_score: { filter: { term: { "eventId.keyword": raw } }, boost: 90 } },
        { constant_score: { filter: { term: { eventId: raw } }, boost: 85 } },

        { constant_score: { filter: { term: { "cardId.keyword": raw } }, boost: 80 } },
        { constant_score: { filter: { term: { cardId: raw } }, boost: 75 } },

        { constant_score: { filter: { term: { "accountId.keyword": raw } }, boost: 70 } },
        { constant_score: { filter: { term: { accountId: raw } }, boost: 65 } },

        {
            multi_match: {
                query: raw,
                type: "best_fields",
                operator: "and",
                lenient: true,
                fields: [
                    "alertId^8",
                    "eventId^7",
                    "cardId^6",
                    "accountId^5",
                    "severity^2",
                    "detectionMethod^2",
                    "reviewStatus^2",
                    "escalationStatus^2",
                    "reasons^2",
                ],
            },
        },
    ];

    for (const candidate of wildcardCandidates) {
        const value = `*${escapeWildcard(candidate)}*`;

        should.push(
            { wildcard: { "alertId.keyword": { value, case_insensitive: true, boost: 25 } } },
            { wildcard: { "eventId.keyword": { value, case_insensitive: true, boost: 22 } } },
            { wildcard: { "cardId.keyword": { value, case_insensitive: true, boost: 20 } } },
            { wildcard: { "accountId.keyword": { value, case_insensitive: true, boost: 18 } } }
        );
    }

    return {
        bool: {
            should,
            minimum_should_match: 1,
        },
    };
}

export function buildAlertSearchBody(
    params: AlertSearchParams
): Record<string, any> {
    const filter: any[] = [];
    const must: any[] = [];

    const createdRange: Record<string, string> = {};
    if (params.since) createdRange.gte = params.since;
    if (params.until) createdRange.lte = params.until;

    if (Object.keys(createdRange).length > 0) {
        filter.push({
            range: {
                createdAt: {
                    ...createdRange,
                    format: "strict_date_optional_time",
                },
            },
        });
    }

    const scoreRange: Record<string, number> = {};
    if (typeof params.scoreMin === "number") scoreRange.gte = params.scoreMin;
    if (typeof params.scoreMax === "number") scoreRange.lte = params.scoreMax;

    if (Object.keys(scoreRange).length > 0) {
        filter.push({
            range: {
                fraudScore: scoreRange,
            },
        });
    }

    if (params.detectionMethods && params.detectionMethods.length > 0) {
        filter.push({
            terms: {
                detectionMethod: params.detectionMethods,
            },
        });
    }

    if (params.severities && params.severities.length > 0) {
        filter.push({
            terms: {
                severity: params.severities,
            },
        });
    }

    if (params.reviewStatus === "FALSE_POSITIVE") {
        filter.push({
            term: {
                reviewStatus: "FALSE_POSITIVE",
            },
        });
    } else if (params.reviewStatus === "CLOSED") {
        filter.push({
            term: {
                reviewStatus: "CLOSED",
            },
        });
    } else if (params.reviewStatus === "OPEN") {
        filter.push({
            bool: {
                should: [
                    { term: { reviewStatus: "OPEN" } },
                    {
                        bool: {
                            must_not: {
                                exists: { field: "reviewStatus" },
                            },
                        },
                    },
                ],
                minimum_should_match: 1,
            },
        });
    }

    if (params.escalationStatus === "ESCALATED") {
        filter.push({
            term: {
                escalationStatus: "ESCALATED",
            },
        });
    } else if (params.escalationStatus === "NONE") {
        filter.push({
            bool: {
                should: [
                    { term: { escalationStatus: "NONE" } },
                    {
                        bool: {
                            must_not: {
                                exists: { field: "escalationStatus" },
                            },
                        },
                    },
                ],
                minimum_should_match: 1,
            },
        });
    }

    if (params.q) {
        must.push(buildSearchClause(params.q));
    }

    const query =
        filter.length === 0 && must.length === 0
            ? { match_all: {} }
            : {
                bool: {
                    ...(filter.length ? { filter } : {}),
                    ...(must.length ? { must } : {}),
                },
            };

    return {
        from: params.offset,
        size: params.limit,
        sort: params.q
            ? [
                { _score: { order: "desc" as const } },
                { createdAt: { order: "desc" as const, unmapped_type: "date" } },
            ]
            : [{ createdAt: { order: "desc" as const, unmapped_type: "date" } }],
        query,
    };
}