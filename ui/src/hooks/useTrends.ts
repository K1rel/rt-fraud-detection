import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { TrendsResponse } from "@/hooks/useStats";

export type TrendsRange = "1h" | "6h" | "24h" | "7d";

type State = {
    trends: TrendsResponse | null;
    loading: boolean;
    error: string | null;
    updatedAt: string | null;
};

export function useTrends(
    range: TrendsRange,
    opts?: { refreshMs?: number; enabled?: boolean }
) {
    const refreshMs = Number.isFinite(opts?.refreshMs) ? Math.max(2000, opts!.refreshMs!) : 10_000;
    const enabled = opts?.enabled ?? true;

    const [state, setState] = useState<State>({
        trends: null,
        loading: enabled,
        error: null,
        updatedAt: null,
    });

    const inFlightRef = useRef<AbortController | null>(null);

    const fetchOnce = useCallback(async () => {
        if (!enabled) return;

        inFlightRef.current?.abort();

        const ctrl = new AbortController();
        inFlightRef.current = ctrl;

        setState((s) => ({
            ...s,
            loading: s.trends == null, // smooth on refresh
            error: null,
        }));

        try {
            const res = await api.get<TrendsResponse>("/api/stats/trends", {
                params: { range },
                signal: ctrl.signal,
            });

            setState({
                trends: res.data,
                loading: false,
                error: null,
                updatedAt: new Date().toISOString(),
            });
        } catch (e: any) {
            const isCanceled = e?.name === "CanceledError" || e?.code === "ERR_CANCELED";
            if (isCanceled) return;

            const msg = e?.response?.data?.error || e?.message || "Failed to load trends";
            setState((s) => ({
                ...s,
                loading: false,
                error: msg,
                updatedAt: s.updatedAt ?? null,
            }));
        } finally {
            if (inFlightRef.current === ctrl) inFlightRef.current = null;
        }
    }, [range, enabled]);

    useEffect(() => {
        if (!enabled) {
            inFlightRef.current?.abort();
            inFlightRef.current = null;
            setState((s) => ({ ...s, loading: false, error: null, trends: null, updatedAt: null }));
            return;
        }

        void fetchOnce();

        const id = window.setInterval(() => void fetchOnce(), refreshMs);

        return () => {
            window.clearInterval(id);
            inFlightRef.current?.abort();
            inFlightRef.current = null;
        };
    }, [fetchOnce, refreshMs, enabled]);

    const refreshNow = useCallback(() => {
        if (!enabled) return;
        void fetchOnce();
    }, [fetchOnce, enabled]);

    return {
        ...state,
        refreshNow,
        refreshMs,
        enabled,
    };
}
