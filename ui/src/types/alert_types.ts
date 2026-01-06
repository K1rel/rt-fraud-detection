export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type Severity = (typeof SEVERITIES)[number] | "UNKNOWN";


export interface AlertItem {
    id: string;
    index?: string;
    alertId?: string;
    createdAt?: string;
    amount?: number;
    currency?: string;
    cardId?: string;
    fraudScore?: number;
    severity?: Severity | string;
    detectionMethod?: string;
    [k: string]: unknown;
}

export interface AlertDetail extends AlertItem {
    eventId?: string;
    accountId?: string;
    fraudPrediction?: boolean;
    reasons?: string[];

    transaction?: Record<string, unknown>;

    _rt?: Record<string, unknown>;
}

export interface AlertsResponse {
    items: AlertItem[];
    pagination?: {
        offset: number;
        limit: number;
        total?: number;
        returned?: number;
        hasMore?: boolean;
    };
    timing?: { tookMs?: number };
    filters?: Record<string, unknown>;
}

export type AlertsFiltersState = {
    scoreMin: number;
    scoreMax: number;
    severities: Severity[];
    detectionMethod: string;
    since: string;
    until: string;
};
