import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { AlertItem } from "@/types/alert_types";
import { normalizeSeverity } from "@/lib/alerts";

type Options = {
    url: string;
    enabled?: boolean;
    severities?: string[];
    authToken?: string;
    onAlert: (a: AlertItem) => void;
};

type State = {
    connected: boolean;
    error: string | null;
    hello: any | null;
    received: number;
};

export function useAlertsSocket(opts: Options): State {
    const enabled = opts.enabled ?? true;

    const [state, setState] = useState<State>({
        connected: false,
        error: null,
        hello: null,
        received: 0,
    });

    const socketRef = useRef<Socket | null>(null);
    const onAlertRef = useRef(opts.onAlert);
    const sevRef = useRef<string[]>(opts.severities ?? []);

    useEffect(() => {
        onAlertRef.current = opts.onAlert;
    }, [opts.onAlert]);

    useEffect(() => {
        sevRef.current = opts.severities ?? [];
        const s = socketRef.current;
        if (!s || !s.connected) return;

        const sevs = (sevRef.current || []).map((x) => normalizeSeverity(x))
        if (sevs.length) {
            s.emit("subscribe", { severities: sevs }, () => {});
        } else {
            s.emit("subscribeAll", {}, () => {});
        }
    }, [opts.severities]);

    const auth = useMemo(() => {
        const token = opts.authToken?.trim();
        return token ? { token } : undefined;
    }, [opts.authToken]);

    useEffect(() => {
        if (!enabled) {
            socketRef.current?.disconnect();
            socketRef.current = null;
            setState((p) => ({ ...p, connected: false }));
            return;
        }

        socketRef.current?.disconnect();
        socketRef.current = null;

        const s = io(opts.url, {
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 250,
            reconnectionDelayMax: 2000,
            timeout: 8000,
            auth,
        });

        socketRef.current = s;

        const onConnect = () => {
            setState((prev) => ({ ...prev, connected: true, error: null }));
            const sevs = (sevRef.current || []).map((x) => normalizeSeverity(x));
            if (sevs.length) s.emit("subscribe", { severities: sevs }, () => {});
            else s.emit("subscribeAll", {}, () => {});
        };

        const onDisconnect = (reason: any) => {
            setState((prev) => ({ ...prev, connected: false, error: reason ? String(reason) : prev.error }));
        };

        const onConnectError = (err: any) => {
            setState((prev) => ({ ...prev, connected: false, error: err?.message ? String(err.message) : "connect_error" }));
        };

        const onAlert = (payload: any) => {
            const a = (payload ?? {}) as AlertItem;
            onAlertRef.current(a);
            setState((prev) => ({ ...prev, received: prev.received + 1 }));
        };

        s.on("connect", onConnect);
        s.on("disconnect", onDisconnect);
        s.on("connect_error", onConnectError);
        s.on("alert", onAlert);

        return () => {
            s.off("connect", onConnect);
            s.off("disconnect", onDisconnect);
            s.off("connect_error", onConnectError);
            s.off("alert", onAlert);
            s.disconnect();
            socketRef.current = null;
        };
    }, [opts.url, enabled, auth]);

    return state;
}
