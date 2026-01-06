import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
    AlertsSortBy,
    SortDir,
    alertKey,
    clamp01,
    formatTimestamp,
    matchesFilters,
    maskId,
    normalizeSeverity,
    severityBadgeVariant,
    severityRowClass,
    truncateId,
} from "@/lib/alerts";
import { AlertItem,
    AlertsFiltersState,
    AlertsResponse} from "@/types/alert_types";
import { useAlertsSocket } from "@/hooks/useAlertsSocket";
import { AlertsFilters } from "@/components/alerts/AlertsFilters";
import { AlertDetailsDialog } from "@/components/alerts/AlertDetailsDialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type Props = {
    wsUrl?: string;
};

const MAX_ITEMS = 500;

function sortComparator(by: AlertsSortBy, dir: SortDir) {
    const mul = dir === "asc" ? 1 : -1;

    return (a: AlertItem, b: AlertItem) => {
        if (by === "score") {
            const sa = clamp01(a.fraudScore, 0);
            const sb = clamp01(b.fraudScore, 0);
            if (sa === sb) return 0;
            return sa < sb ? -1 * mul : 1 * mul;
        }

        // time
        const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
        const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
        if (ta === tb) return 0;
        return ta < tb ? -1 * mul : 1 * mul;
    };
}

function playBeep() {
    try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
        if (!Ctx) return;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.03;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => {
            o.stop();
            ctx.close().catch(() => {});
        }, 140);
    } catch {
        // ignore
    }
}

export function AlertsTable({ wsUrl }: Props) {
    const baseWsUrl = wsUrl ?? (api.defaults.baseURL || "http://localhost:3001");

    const [filters, setFilters] = useState<AlertsFiltersState>({
        scoreMin: 0,
        scoreMax: 1,
        severities: [],
        detectionMethod: "ALL",
        since: "",
        until: "",
    });

    const [sortBy, setSortBy] = useState<AlertsSortBy>("time");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const [pageSize, setPageSize] = useState<number>(50);
    const [page, setPage] = useState<number>(0);
    const [pageMeta, setPageMeta] = useState<{
        offset: number;
        limit: number;
        total?: number;
        returned?: number;
        hasMore?: boolean;
    } | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [items, setItems] = useState<AlertItem[]>([]);
    const seenRef = useRef<Set<string>>(new Set());

    const [autoScroll, setAutoScroll] = useState<boolean>(true);
    const [sound, setSound] = useState<boolean>(false);

    const [pausedCount, setPausedCount] = useState<number>(0);

    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selected, setSelected] = useState<AlertItem | null>(null);

    const [flashKeys, setFlashKeys] = useState<Set<string>>(() => new Set());

    const liveMode = page === 0;

    const pendingRef = useRef<AlertItem[]>([]);
    const flushScheduledRef = useRef(false);

    const flushPending = useCallback(() => {
        flushScheduledRef.current = false;

        const batch = pendingRef.current;
        pendingRef.current = [];
        if (!batch.length) return;

        setItems(prev => {
            const next = [...batch, ...prev];
            return next.slice(0, MAX_ITEMS);
        });

        if (autoScroll && scrollerRef.current) {
            scrollerRef.current.scrollTop = 0;
        }
        const newest = batch[0] as any;
        console.log("batch_delay_ms", performance.now() - newest._uiRecv);

    }, [autoScroll]);

    const scheduleFlush = useCallback(() => {
        if (flushScheduledRef.current) return;
        flushScheduledRef.current = true;
        setTimeout(flushPending, 40);
    }, [flushPending]);


    const fetchPage = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params: any = {
                limit: pageSize,
                offset: page * pageSize,
            };

            if (filters.since) params.since = filters.since;
            if (filters.until) params.until = filters.until;

            if (typeof filters.scoreMin === "number") params.scoreMin = filters.scoreMin;
            if (typeof filters.scoreMax === "number") params.scoreMax = filters.scoreMax;

            if (filters.detectionMethod !== "ALL") params.detectionMethods = [filters.detectionMethod];

            if (filters.severities.length) params.severities = filters.severities;

            const res = await api.get<AlertsResponse>("/api/alerts", { params });

            const next = res.data?.items ?? [];
            setPageMeta(res.data?.pagination ?? null);

            const seen = new Set<string>();
            for (const a of next) seen.add(alertKey(a));
            seenRef.current = seen;

            setItems(next);
            setLoading(false);
        } catch (e: any) {
            setLoading(false);
            setError(e?.message ? String(e.message) : "fetch_failed");
            setPageMeta(null);
        }
    }, [page, pageSize, filters]);

    useEffect(() => {
        void fetchPage();
        if (!liveMode) setPausedCount(0);
    }, [fetchPage]);

    const onRealtimeAlert = useCallback(
        (a: AlertItem) => {
            if (!liveMode) {
                setPausedCount((c) => c + 1);
                return;
            }

            if (!matchesFilters(a, filters)) return;

            const key = alertKey(a);
            if (!key) return;

            if (seenRef.current.has(key)) return;
            seenRef.current.add(key);

            setFlashKeys((prev) => {
                const next = new Set(prev);
                next.add(key);
                return next;
            });
            setTimeout(() => {
                setFlashKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }, 900);

            const sev = normalizeSeverity(a.severity);
            if (sound && (sev === "HIGH" || sev === "CRITICAL")) playBeep();

            (a as any)._uiRecv = performance.now();
            pendingRef.current.unshift(a);
            scheduleFlush();

            //logs
            const now = Date.now();
            const rt: any = (a as any)._rt || {};

            const apiConsumerTs = typeof rt.apiConsumerTs === "number" ? rt.apiConsumerTs : null;
            const serverTs = typeof rt.serverTs === "number" ? rt.serverTs : null;

            const emitToUiMs = serverTs !== null ? (now - serverTs) : null;
            const consumeToEmitMs =
                apiConsumerTs !== null && serverTs !== null ? (serverTs - apiConsumerTs) : null;
            const consumeToUiMs = apiConsumerTs !== null ? (now - apiConsumerTs) : null;

            console.log(
                "emit_to_ui_ms", emitToUiMs,
                "consume_to_emit_ms", consumeToEmitMs,
                "consume_to_ui_ms", consumeToUiMs
            );


        },
        [liveMode, filters, sound, scheduleFlush]
    );

    const socket = useAlertsSocket({
        url: baseWsUrl,
        enabled: true,

        severities: filters.severities.length ? filters.severities : [],
        onAlert: onRealtimeAlert,
    });

    const displayed = useMemo(() => {
        if (sortBy === "time" && sortDir === "desc") return items;

        const arr = [...items];
        arr.sort(sortComparator(sortBy, sortDir));
        return arr;
    }, [items, sortBy, sortDir]);

    const toggleSort = (by: AlertsSortBy) => {
        if (sortBy !== by) {
            setSortBy(by);
            setSortDir(by === "time" ? "desc" : "desc");
            return;
        }
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    };

    const openDetails = (a: AlertItem) => {
        setSelected(a);
        setDetailsOpen(true);
    };

    const selectedIndex = useMemo(() => {
        if (!selected) return -1;
        const key = alertKey(selected);
        if (!key) return -1;
        return displayed.findIndex((x) => alertKey(x) === key);
    }, [selected, displayed]);

    const hasPrev = selectedIndex > 0;
    const hasNext = selectedIndex >= 0 && selectedIndex < displayed.length - 1;

    const goPrev = () => {
        if (!hasPrev) return;
        const next = displayed[selectedIndex - 1];
        if (next) setSelected(next);
    };

    const goNext = () => {
        if (!hasNext) return;
        const next = displayed[selectedIndex + 1];
        if (next) setSelected(next);
    };

    const HeaderSort = ({ label, by }: { label: string; by: AlertsSortBy }) => (
        <button
            className="flex items-center gap-1 hover:underline"
            onClick={() => toggleSort(by)}
            title={`Sort by ${label}`}
        >
            <span>{label}</span>
            {sortBy === by ? (
                <span className="text-muted-foreground">{sortDir === "desc" ? "↓" : "↑"}</span>
            ) : null}
        </button>
    );

    return (
        <div className="space-y-4">
            <AlertsFilters value={filters} onChange={(n) => { setPage(0); setFilters(n); }} />

            <div className="rounded-xl border bg-card/50">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                    <div className="flex items-center gap-2">
                        <div className="font-semibold">Alerts</div>
                        <Badge variant={socket.connected ? "default" : "outline"}>
                            {socket.connected ? "WS Connected" : "WS Disconnected"}
                        </Badge>
                        <Badge variant="outline">items: {displayed.length}</Badge>
                        {liveMode ? (
                            <Badge variant="secondary">Live</Badge>
                        ) : (
                            <Badge variant="outline">History</Badge>
                        )}
                        {pageMeta?.total !== undefined ? (
                            <Badge variant="outline">total: {pageMeta.total}</Badge>
                        ): null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {!liveMode && pausedCount > 0 ? (
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">+{pausedCount} new</Badge>
                                <Button
                                    variant="default"
                                    onClick={() => {
                                        setPage(0);
                                        setPausedCount(0);
                                    }}
                                >
                                    Back to live
                                </Button>
                            </div>
                        ) : null}

                        <Button
                            variant={autoScroll ? "default" : "outline"}
                            onClick={() => setAutoScroll((v) => !v)}
                            title="Auto-scroll to newest alert"
                        >
                            Auto-scroll {autoScroll ? "ON" : "OFF"}
                        </Button>

                        <Button
                            variant={sound ? "default" : "outline"}
                            onClick={() => setSound((v) => !v)}
                            title="Beep on HIGH/CRITICAL (optional)"
                        >
                            Sound {sound ? "ON" : "OFF"}
                        </Button>

                        <Button variant="outline" onClick={() => void fetchPage()}>
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            Prev
                        </Button>
                        <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={loading || (pageMeta?.hasMore == false)}>
                            Next
                        </Button>
                        <Badge variant="outline">page: {page}</Badge>
                        {pageMeta ? (
                            <Badge variant="outline">
                                offset: {pageMeta.offset} • returned: {pageMeta.returned ?? displayed.length}
                            </Badge>
                        ) : null}

                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">page size</span>
                        {[25, 50, 100, 200].map((n) => (
                            <Button
                                key={n}
                                size="sm"
                                variant={pageSize === n ? "default" : "outline"}
                                onClick={() => {
                                    setPage(0);
                                    setPageSize(n);
                                }}
                            >
                                {n}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* content */}
                <div ref={scrollerRef} className="max-h-[65vh] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Alert</TableHead>
                                <TableHead>
                                    <HeaderSort label="Time" by="time" />
                                </TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Card</TableHead>
                                <TableHead>
                                    <HeaderSort label="Score" by="score" />
                                </TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <TableRow key={`sk-${i}`}>
                                        <TableCell colSpan={8}>
                                            <Skeleton className="h-8 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : error ? (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <div className="p-3 text-sm">
                                            <div className="font-medium">Failed to load alerts</div>
                                            <div className="text-muted-foreground">{error}</div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : displayed.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <div className="p-6 text-sm text-muted-foreground">No alerts match filters.</div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                displayed.map((a) => {
                                    const sev = normalizeSeverity(a.severity);
                                    const key = alertKey(a);
                                    const flash = flashKeys.has(key);

                                    const score = clamp01(a.fraudScore, 0);
                                    const pct = Math.round(score * 100);

                                    const rowClass = [
                                        "cursor-pointer",
                                        "transition-colors duration-700",
                                        severityRowClass(sev),
                                        flash ? "bg-foreground/5" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ");

                                    const displayAlertId = a.alertId ?? a.id;

                                    return (
                                        <TableRow
                                            key={key}
                                            className={rowClass}
                                            onClick={() => openDetails(a)}
                                            title="Click to view details"
                                        >
                                            <TableCell className="font-mono text-xs">
                                                {truncateId(displayAlertId, 10)}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {formatTimestamp(a.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {typeof a.amount === "number" ? `$${a.amount.toFixed(2)}` : "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {maskId(a.cardId, 4)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="min-w-[120px]">
                                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                        <span>{pct}%</span>
                                                        <span>{score.toFixed(3)}</span>
                                                    </div>
                                                    <div className="mt-1 h-2 w-full rounded bg-muted">
                                                        <div
                                                            className="h-2 rounded bg-foreground"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={severityBadgeVariant(sev)}>{sev}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {(a.detectionMethod ?? "—").toString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDetails(a);
                                                    }}
                                                >
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <AlertDetailsDialog
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                alert={selected}
                hasPrev={hasPrev}
                hasNext={hasNext}
                onPrev={goPrev}
                onNext={goNext}/>
        </div>
    );
}
