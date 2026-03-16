import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PerfRunsResponse } from "@/types/perf";

type State = {
    data: PerfRunsResponse | null;
    loading: boolean;
    error: string | null;
    updatedAt: string | null;
};

export function usePerfRuns(opts?: { refreshMs?: number; limit?: number }) {
    const refreshMs = Number.isFinite(opts?.refreshMs)
        ? Math.max(5_000, opts!.refreshMs!)
        : 30_000;

    const limit = Number.isFinite(opts?.limit) ? Math.max(1, Math.min(200, opts!.limit!)) : 50;

    const [state, setState] = useState<State>({
        data: null,
        loading: true,
        error: null,
        updatedAt: null,
    });

    const inFlightRef = useRef<AbortController | null>(null);

    const fetchOnce = useCallback(async () => {
        if (inFlightRef.current) inFlightRef.current.abort();
        const ac = new AbortController();
        inFlightRef.current = ac;

        setState((s) => ({ ...s, loading: true, error: null }));

        try {
            const res = await api.get<PerfRunsResponse>("/api/perf/runs", {
                params: { limit, offset: 0 },
                signal: ac.signal as any,
            });

            setState({
                data: res.data,
                loading: false,
                error: null,
                updatedAt: new Date().toISOString(),
            });
        } catch (e: any) {
            if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
            const msg = e?.response?.data?.error || e?.message || "Failed to load perf runs";
            setState((s) => ({ ...s, loading: false, error: String(msg) }));
        } finally {
            if (inFlightRef.current === ac) inFlightRef.current = null;
        }
    }, [limit]);

    useEffect(() => {
        void fetchOnce();
        const t = setInterval(() => void fetchOnce(), refreshMs);
        return () => {
            clearInterval(t);
            if (inFlightRef.current) inFlightRef.current.abort();
        };
    }, [fetchOnce, refreshMs]);

    const refreshNow = useCallback(() => void fetchOnce(), [fetchOnce]);

    return { ...state, refreshNow };
}
