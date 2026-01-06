import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export type Health = {
    status?: string;
    es?: string;
    elasticsearch_node?: string;
    timestamp?: string;
};

export type HealthState = {
    data: Health | null;
    loading: boolean;
    error: string | null;
    lastOkAt: string | null;
};

type Options = {
    pollMs?: number;
};

export function useHealth(options: Options = {}): HealthState {
    const pollMs = options.pollMs ?? 5000;

    const [state, setState] = useState<HealthState>({
        data: null,
        loading: true,
        error: null,
        lastOkAt: null,
    });

    const timerRef = useRef<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchOnce = async () => {
            try {
                abortRef.current?.abort();
                abortRef.current = new AbortController();

                const res = await api.get<Health>("/health", {
                    signal: abortRef.current.signal,
                });

                if (!mounted) return;

                const ok = res.data?.status === "ok";
                setState((prev) => ({
                    data: res.data ?? null,
                    loading: false,
                    error: null,
                    lastOkAt: ok ? new Date().toISOString() : prev.lastOkAt,
                }));
            } catch (e: any) {
                if (!mounted) return;
                if (e?.name === "CanceledError" || e?.name === "AbortError") return;

                setState((prev) => ({
                    data: prev.data ?? { status: "down" },
                    loading: false,
                    error: "health_check_failed",
                    lastOkAt: prev.lastOkAt,
                }));
            }
        };

        fetchOnce();

        timerRef.current = window.setInterval(fetchOnce, pollMs);

        return () => {
            mounted = false;
            abortRef.current?.abort();
            if (timerRef.current) window.clearInterval(timerRef.current);
        };
    }, [pollMs]);

    return state;
}
