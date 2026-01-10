import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

export type StatsResponse = {
    totalAlerts: number;
    windows: { lastHour: number; lastDay: number; lastWeek: number };
    avgFraudScore: number | null;
    breakdown: {
        detectionMethod: Array<{ method: string; count: number }>;
        severity: Array<{ severity: string; count: number }>;
    };
    topCards: Array<{ card: string; count: number }>;
    timing?: { esTookMs: number | null; totalMs: number };
};

export type TrendsResponse = {
    perHour: Array<{ hour: string; count: number; avgFraudScore: number | null }>;
    scoreHistogram: Array<{ bucket: number; count: number }>;
    timing?: { esTookMs: number | null; totalMs: number };
};

type State = {
    stats: StatsResponse | null;
    trends: TrendsResponse | null;
    loading: boolean;
    error: string | null;
    updatedAt: string | null;
};

export function useStats(opts?: { refreshMs?: number }) {
    const refreshMs = Number.isFinite(opts?.refreshMs) ? Math.max(2000, opts!.refreshMs!) : 10_000;

    const [state, setState] = useState<State>({
        stats: null,
        trends: null,
        loading: true,
        error: null,
        updatedAt: null,
    });

    const inFlightRef = useRef<AbortController | null>(null);

    const fetchOnce = useCallback(async () => {

        inFlightRef.current?.abort();

        const ctrl = new AbortController();
        inFlightRef.current = ctrl;

        setState((s) => ({
            ...s,
            loading: s.stats == null || s.trends == null, // keep smooth on refresh
            error: null,
        }));

        try {
            const [statsRes, trendsRes] = await Promise.all([
                api.get<StatsResponse>("/api/stats", { signal: ctrl.signal }),
                api.get<TrendsResponse>("/api/stats/trends", {params: {range: "24h"},  signal: ctrl.signal }),
            ]);

            setState({
                stats: statsRes.data,
                trends: trendsRes.data,
                loading: false,
                error: null,
                updatedAt: new Date().toISOString(),
            });
        } catch (e: any) {
            const isCanceled =
                e?.name === "CanceledError" || e?.code === "ERR_CANCELED";

            if (isCanceled) return;

            const msg = e?.response?.data?.error || e?.message || "Failed to load stats";
            setState((s) => ({
                ...s,
                loading: false,
                error: msg,
                updatedAt: s.updatedAt ?? null,
            }));
        } finally {
            if(inFlightRef.current === ctrl) inFlightRef.current = null;
        }
    }, []);

    useEffect(() => {
        void fetchOnce();

        const id = window.setInterval(() => {
            void fetchOnce();
        }, refreshMs);

        return () => {
            window.clearInterval(id);

            inFlightRef.current?.abort();
            inFlightRef.current = null;
        };
    }, [fetchOnce, refreshMs]);

    const refreshNow = useCallback(() => void fetchOnce(), [fetchOnce]);


    function pctChange(curr: number | null | undefined, prev: number | null | undefined): number | null {
        if (curr == null || prev == null) return null;

        if (prev === 0) {
            if (curr === 0) return 0;
            return Infinity;
        }

        const pct = ((curr - prev) / prev) * 100;
        return Number.isFinite(pct) ? pct : null;
    }

    function lastTwoValidCounts(perHour: Array<{ count: any }>) {
        const xs = perHour
            .map((x) => (typeof x?.count === "number" ? x.count : null))
            .filter((x): x is number => x != null);

        const n = xs.length;
        return {
            prev: n >= 2 ? xs[n - 2] : null,
            curr: n >= 1 ? xs[n - 1] : null,
        };
    }

    const derived = useMemo(() => {
        const stats = state.stats;
        const trends = state.trends;

        if (!stats || !trends) return null;

        const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
        const nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
        const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
        const nf3 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
        const nfRate = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        });

        const totalAlerts = stats.totalAlerts ?? 0;


        const now = new Date();
        const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

        const perHour = trends?.perHour ?? [];

        const todayCount = perHour
            .filter((p) => {
                const ts = Date.parse(p.hour);
                return Number.isFinite(ts) && ts >= startOfDayUtc.getTime() && ts <= now.getTime();
            })
            .reduce((acc, p) => acc + p.count, 0);

        const mlAlerts =
            (stats.breakdown?.detectionMethod ?? []).reduce((acc, m) => {
                const k = (m.method ?? "").toUpperCase();
                if (k.includes("ML")) return acc + (m.count ?? 0);
                return acc;
            }, 0) ?? 0;

        const mlShare = totalAlerts > 0 ? (mlAlerts / totalAlerts) * 100 : 0;

        const lastHour = stats.windows?.lastHour ?? 0;
        const alertsPerSec = lastHour / 3600;

        const week = stats.windows?.lastWeek ?? 0;
        const day = stats.windows?.lastDay ?? 0;
        const avgPerDayWeek = week > 0 ? week / 7 : 0;
        const dayTrendPct =
            avgPerDayWeek > 0 ? ((day - avgPerDayWeek) / avgPerDayWeek) * 100 : null;

        const { prev: prevHourCount, curr: currHourCount } = lastTwoValidCounts(perHour);
        const hourTrendPct = pctChange(currHourCount, prevHourCount);


        const scorePoints = perHour
            .map((p) => p.avgFraudScore)
            .filter((x): x is number => typeof x === "number" && Number.isFinite(x));

        const lastScore = scorePoints.length ? scorePoints[scorePoints.length - 1] : null;
        const prevScore = scorePoints.length >= 2 ? scorePoints[scorePoints.length - 2] : null;

        const scoreTrendPct = pctChange(lastScore, prevScore);


        const sparkCounts = perHour.slice(-24).map((p) => p.count);

        const sparkScores = perHour
            .slice(-24)
            .map((p) => (typeof p.avgFraudScore === "number" && Number.isFinite(p.avgFraudScore) ? p.avgFraudScore : 0));


        return {
            fmt: { nf0, nf1, nf2, nf3, nfRate },
            totalAlerts,
            todayCount,
            mlShare,
            avgFraudScore: stats.avgFraudScore,
            bySeverity: stats.breakdown?.severity ?? [],
            alertsPerSec,
            dayTrendPct,
            hourTrendPct,
            scoreTrendPct,
            sparkCounts,
            sparkScores,
        };
    }, [state.stats, state.trends]);

    return {
        ...state,
        derived,
        refreshNow,
        refreshMs,
    };
}


export type UseStatsResult = ReturnType<typeof useStats>;

