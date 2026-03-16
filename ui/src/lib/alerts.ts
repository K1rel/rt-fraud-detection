import {
    AlertItem,
    AlertsFiltersState,
    EscalationStatus,
    ReviewStatus,
    Severity,
} from "@/types/alert_types";
import type { CardMaskMode, TimestampFormat } from "@/lib/settings";

export type AlertsSortBy = "time" | "score";
export type SortDir = "asc" | "desc";

export function alertKey(a: AlertItem): string {
    return String(a.alertId || a.id || "");
}

export function normalizeSeverity(v: unknown): Severity {
    const s = (v == null ? "UNKNOWN" : String(v)).trim().toUpperCase();
    if (s === "LOW" || s === "MEDIUM" || s === "HIGH" || s === "CRITICAL") {
        return s;
    }
    return "UNKNOWN";
}

export function normalizeReviewStatus(v: unknown): ReviewStatus {
    const s = (v == null ? "OPEN" : String(v)).trim().toUpperCase();
    if (s === "FALSE_POSITIVE") return "FALSE_POSITIVE";
    if (s === "CLOSED") return "CLOSED";
    return "OPEN";
}

export function normalizeEscalationStatus(v: unknown): EscalationStatus {
    const s = (v == null ? "NONE" : String(v)).trim().toUpperCase();
    if (s === "ESCALATED") return "ESCALATED";
    return "NONE";
}

export function maskId(
    value: unknown,
    keepLast = 4,
    mode: CardMaskMode = "LAST4"
): string {
    const s = (value == null ? "" : String(value)).trim();
    if (!s) return "—";

    if (mode === "FULL") return s;
    if (mode === "MASKED") return "********";

    if (s.length <= keepLast) return s;
    const last = s.slice(-keepLast);
    return `****${last}`;
}

export function truncateId(value: unknown, left = 8): string {
    const s = (value == null ? "" : String(value)).trim();
    if (!s) return "—";
    return s.length <= left ? s : s.slice(0, left);
}

export function clamp01(n: unknown, def = 0): number {
    const x = Number(n);
    if (!Number.isFinite(x)) return def;
    return Math.min(1, Math.max(0, x));
}

export function toIsoOrEmptyFromDatetimeLocal(v: string): string {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
}

export function formatTimestamp(
    iso: unknown,
    mode: TimestampFormat = "LOCAL"
): string {
    if (!iso) return "—";

    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return "—";

    const formatted = new Intl.DateTimeFormat(undefined, {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        ...(mode === "UTC" ? { timeZone: "UTC" } : {}),
    }).format(d);

    return mode === "UTC" ? `${formatted} UTC` : formatted;
}

export function formatCompactTimestamp(
    iso: unknown,
    mode: TimestampFormat = "LOCAL"
): string {
    if (!iso) return "—";

    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return "—";

    const formatted = new Intl.DateTimeFormat(undefined, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        ...(mode === "UTC" ? { timeZone: "UTC", hour12: false } : {}),
    }).format(d);

    return mode === "UTC" ? `${formatted} UTC` : formatted;
}

export function formatDetectionMethod(
    value: unknown,
    compact = false
): string {
    const s = String(value ?? "").trim().toUpperCase();
    if (!s) return "—";
    if (!compact) return s;

    if (s === "ML_AND_RULES") return "ML+R";
    return s;
}

export function matchesFilters(a: AlertItem, f: AlertsFiltersState): boolean {
    const score = clamp01(a.fraudScore, 0);
    if (score < f.scoreMin || score > f.scoreMax) return false;

    const sev = normalizeSeverity(a.severity);
    if (f.severities.length && !f.severities.includes(sev)) return false;

    const dm = (a.detectionMethod == null ? "" : String(a.detectionMethod))
        .trim()
        .toUpperCase();
    if (
        f.detectionMethod !== "ALL" &&
        dm !== f.detectionMethod.trim().toUpperCase()
    ) {
        return false;
    }

    const reviewStatus = normalizeReviewStatus(a.reviewStatus);
    if (f.reviewStatus !== "ALL" && reviewStatus !== f.reviewStatus) {
        return false;
    }

    const escalationStatus = normalizeEscalationStatus(a.escalationStatus);
    if (
        f.escalationStatus !== "ALL" &&
        escalationStatus !== f.escalationStatus
    ) {
        return false;
    }

    const ts = a.createdAt ? new Date(String(a.createdAt)).getTime() : NaN;
    if (f.since) {
        const s = new Date(f.since).getTime();
        if (!Number.isNaN(ts) && Number.isFinite(s) && ts < s) return false;
    }
    if (f.until) {
        const u = new Date(f.until).getTime();
        if (!Number.isNaN(ts) && Number.isFinite(u) && ts > u) return false;
    }

    return true;
}

export function severityRowClass(sev: Severity): string {
    switch (sev) {
        case "CRITICAL":
            return "bg-destructive/10";
        case "HIGH":
            return "bg-destructive/5";
        case "MEDIUM":
            return "bg-secondary/20";
        case "LOW":
            return "";
        default:
            return "";
    }
}

export function severityBadgeVariant(
    sev: Severity
): "default" | "secondary" | "destructive" | "outline" {
    switch (sev) {
        case "CRITICAL":
        case "HIGH":
            return "destructive";
        case "MEDIUM":
            return "secondary";
        case "LOW":
            return "outline";
        default:
            return "outline";
    }
}