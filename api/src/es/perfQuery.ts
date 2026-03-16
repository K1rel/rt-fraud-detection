export interface PerfRunsSearchParams {
    limit: number;
    offset: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const PERF_INDEX_PREFIX =
    process.env.ELASTICSEARCH_PERF_INDEX_PREFIX || "perf-runs-";
export const PERF_INDEX_PATTERN = `${PERF_INDEX_PREFIX}*`;

function parseNumber(value: unknown, def: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : def;
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
}

export function parsePerfRunsSearchParams(query: any): PerfRunsSearchParams {
    const limit = clamp(parseNumber(query.limit, DEFAULT_LIMIT), 1, MAX_LIMIT);
    const offset = Math.max(0, Math.trunc(parseNumber(query.offset, 0)));

    return { limit, offset };
}

export function buildPerfRunsSearchBody(
    params: PerfRunsSearchParams
): Record<string, any> {
    return {
        from: params.offset,
        size: params.limit,
        sort: [
            { startedAt: { order: "desc" as const, unmapped_type: "date" } },
            { createdAt: { order: "desc" as const, unmapped_type: "date" } },
        ],
        query: { match_all: {} },
    };
}
