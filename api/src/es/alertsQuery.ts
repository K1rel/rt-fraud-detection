export interface AlertSearchParams {
    limit: number;
    offset: number;
    since?: string;
    until?: string;
    scoreMin?: number;
    scoreMax?: number;
    detectionMethods?: string[];
    severities?: string[];
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const ALERT_INDEX_PREFIX =
    process.env.ELASTICSEARCH_ALERT_INDEX_PREFIX;
export const ALERT_INDEX_PATTERN = `${ALERT_INDEX_PREFIX}*`;

function parseNumber(value: unknown, defaultValue: number): number{
    if (value === undefined || value === null) return defaultValue;

    const n = Number(value);
    if(!Number.isFinite(n)) return  defaultValue;

    return n;
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n,min), max);
}

function parseIsoDate(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
 }

 function parseList(value: unknown): string[] | undefined{
    if(!value) return undefined;

    if(Array.isArray(value)){
        const normalized = value
            .map((v) => String(v).trim())
            .filter((v) => v.length > 0);
        return normalized.length ? normalized : undefined;
    }

    const str = String(value).trim();
    if(!str) return undefined;

    const parts = str
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    return parts.length ? parts : undefined;
 }

function normalizeToUpper(list?: string[]): string[] | undefined {
    if(!list) return undefined;

    const normalized = list.map(s => s.toUpperCase());

    return normalized.length ? normalized : undefined;
}

 export function parseAlertSearchParams(query: any): AlertSearchParams{

    const limit = clamp(
        parseNumber(query.limit, DEFAULT_LIMIT),
        1,
        MAX_LIMIT,
    );

    const offset = Math.max(0,parseNumber(query.offset, 0));

    const since = parseIsoDate(query.since);
    const until = parseIsoDate(query.until);

    const scoreMin = query.scoreMin !== undefined && query.scoreMin !== null ? Number(query.scoreMin) : undefined;
    const scoreMax = query.scoreMax !== undefined && query.scoreMax !== null ? Number(query.scoreMax) : undefined;


    const detectionMethods = normalizeToUpper(
        parseList(query.detectionMethods),
    );

    const severities = normalizeToUpper(
      parseList(query.severities),
    );

    const params: AlertSearchParams = {
      limit,
      offset,
    };

    if (since) params.since = since;
    if (until) params.until = until;

    if(scoreMin !== undefined && Number.isFinite(scoreMin)){
        params.scoreMin = scoreMin;
    }
    if(scoreMax !== undefined && Number.isFinite(scoreMax)){
        params.scoreMax = scoreMax;
    }

    if(detectionMethods && detectionMethods.length){
        params.detectionMethods = detectionMethods;
    }

    if(severities && severities.length){
        params.severities = severities;
    }

    return params;
 }

 export function buildAlertSearchBody(
     params: AlertSearchParams,
 ) : Record<string, any> {
    const filter: any[] = [];

    const createdRange: Record<string, string> = {};
    if(params.since) {
        createdRange.gte = params.since;
    }

    if(params.until){
        createdRange.lte = params.until;
    }

    if(Object.keys(createdRange).length > 0){
        filter.push({
            range: {
                createdAt: {
                    ...createdRange,
                    format: 'strict_date_optional_time'
                },
            },
        });
    }

    const scoreRange: Record<string, number> = {};

    if(typeof params.scoreMin === 'number'){
        scoreRange.gte = params.scoreMin;
    }
    if(typeof params.scoreMax === 'number'){
        scoreRange.lte = params.scoreMax;
    }

    if(Object.keys(scoreRange).length > 0){
        filter.push({
            range:{
                fraudScore: scoreRange
            }
        });
    }

    if(params.detectionMethods && params.detectionMethods.length > 0){
        filter.push({
            terms: {
                detectionMethod: params.detectionMethods
            },
        });
    }

    if(params.severities && params.severities.length > 0){
        filter.push({
            terms: {
                severity: params.severities,
            },
        });
    }

    let query: Record<string, any>;
    if(filter.length === 0){
        query = {match_all: {}};
    } else {
        query = {
            bool: {
                filter,
            },
        };
    }

    return {
        from: params.offset,
        size: params.limit,
        sort:[
            {
                createdAt: {
                    order: 'desc' as const,
                },
            },
        ],
        query,
    };
 }