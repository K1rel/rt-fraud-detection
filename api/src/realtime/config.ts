export type RealtimeConfig = {
    kafkaBrokers: string [];
    alertsTopic: string;
    consumerGroupId: string;
    wsMaxClients: number;
    wsAuthToken?: string;
    roomAll: string;
    roomSeverityPrefix: string;
};


function toInt(value: unknown, def: number) : number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : def;
}

function parseBrokers(raw: string | undefined): string[]{
    const v = (raw || "").trim();
    if (!v) return ["kafka:9092"];
    return v
        .split(",")
        .map((s) => s.trim())
        .filter((s)=>s.length > 0);
}

export function readRealtimeConfig(): RealtimeConfig{
    const wsMaxClients = Math.max(1, Math.min(10_000, toInt(process.env.WS_MAX_CLIENTS, 50)));
    const wsAuthToken = process.env.WS_AUTH_TOKEN ? String(process.env.WS_AUTH_TOKEN).trim() : undefined;

    return {
        kafkaBrokers: parseBrokers(process.env.KAFKA_BOOTSTRAP_SERVERS),
        alertsTopic: (process.env.ALERTS_TOPIC || "fraud_alerts").trim(),
        consumerGroupId: (process.env.KAFKA_CONSUMER_GROUP || "api-alert-streamers").trim(),

        wsMaxClients,
        wsAuthToken: wsAuthToken && wsAuthToken.length ? wsAuthToken : undefined,

        roomAll: "all",
        roomSeverityPrefix: "severity",
    };
}

export function normalizeSeverity(value: unknown): string {
    const s = (value === undefined || value == null) ? "UNKNOWN" : String(value).trim();
    return s ? s.toUpperCase() : "UNKNOWN";
}