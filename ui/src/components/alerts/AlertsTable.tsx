import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ChevronsLeftIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsRightIcon,
    RefreshCwIcon,
    SearchIcon,
    SlidersHorizontalIcon,
    Volume2Icon,
    VolumeXIcon,
} from "lucide-react";

import { api } from "@/lib/api";
import {
    AlertsSortBy,
    SortDir,
    alertKey,
    clamp01,
    formatTimestamp,
    maskId,
    matchesFilters,
    normalizeSeverity,
    severityBadgeVariant,
    severityRowClass,
    truncateId,
} from "@/lib/alerts";
import {
    ALERT_THRESHOLD_PRESETS,
    areAlertsFiltersEqual,
    createAlertsFiltersFromSettings,
    useAppSettings,
    type PageSizeOption,
} from "@/lib/settings";
import {
    AlertItem,
    AlertsFiltersState,
    AlertsResponse,
    EscalationStatus,
    ReviewStatus,
} from "@/types/alert_types";
import { useAlertsSocket } from "@/hooks/useAlertsSocket";
import { AlertsFilters } from "@/components/alerts/AlertsFilters";
import { AlertDetailsDialog } from "@/components/alerts/AlertDetailsDialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

        const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
        const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
        if (ta === tb) return 0;
        return ta < tb ? -1 * mul : 1 * mul;
    };
}

function matchesSearchLocal(a: AlertItem, q: string): boolean {
    const s = q.trim().toLowerCase();
    if (!s) return true;

    const reasons = Array.isArray((a as any).reasons) ? (a as any).reasons : [];

    const haystack = [
        a.alertId,
        a.id,
        a.cardId,
        a.severity,
        a.detectionMethod,
        a.reviewStatus,
        a.escalationStatus,
        (a as any).accountId,
        (a as any).eventId,
        ...reasons,
    ]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).toLowerCase())
        .join(" ");

    return haystack.includes(s);
}

function playBeep() {
    try {
        const Ctx = (window.AudioContext ||
            (window as any).webkitAudioContext) as
            | typeof AudioContext
            | undefined;
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

function countActiveFilters(f: AlertsFiltersState): number {
    let n = 0;
    if (f.scoreMin > 0) n++;
    if (f.scoreMax < 1) n++;
    if (f.severities.length > 0) n++;
    if (f.detectionMethod !== "ALL") n++;
    if (f.reviewStatus !== "ALL") n++;
    if (f.escalationStatus !== "ALL") n++;
    if (f.since) n++;
    if (f.until) n++;
    return n;
}

function normalizeReviewStatus(value: unknown): ReviewStatus {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "FALSE_POSITIVE") return "FALSE_POSITIVE";
    if (s === "CLOSED") return "CLOSED";
    return "OPEN";
}

function reviewBadgeVariant(
    status: ReviewStatus
): "default" | "secondary" | "outline" {
    if (status === "FALSE_POSITIVE") return "secondary";
    if (status === "CLOSED") return "default";
    return "outline";
}

function normalizeEscalationStatus(value: unknown): EscalationStatus {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "ESCALATED") return "ESCALATED";
    return "NONE";
}

function escalationBadgeVariant(
    status: EscalationStatus
): "destructive" | "outline" {
    if (status === "ESCALATED") return "destructive";
    return "outline";
}

export function AlertsTable({ wsUrl }: Props) {
    const { settings, updateSettings } = useAppSettings();

    const baseWsUrl =
        wsUrl ?? (api.defaults.baseURL || "http://localhost:3001");

    const defaultFilters = useMemo(
        () => createAlertsFiltersFromSettings(settings),
        [settings]
    );

    const defaultPresetMeta =
        settings.thresholdDefaults.defaultPreset === "CUSTOM"
            ? null
            : ALERT_THRESHOLD_PRESETS[settings.thresholdDefaults.defaultPreset];

    const [filters, setFilters] = useState<AlertsFiltersState>(() =>
        createAlertsFiltersFromSettings(settings)
    );

    const [sortBy, setSortBy] = useState<AlertsSortBy>("time");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const [pageSize, setPageSize] = useState<number>(
        () => settings.workflowDefaults.defaultPageSize
    );
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

    const [autoScroll, setAutoScroll] = useState<boolean>(
        () => settings.realtime.autoScrollLiveAlerts
    );
    const [sound, setSound] = useState<boolean>(
        () => settings.realtime.soundOnHighCritical
    );
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [liveEnabled, setLiveEnabled] = useState<boolean>(
        () => settings.realtime.liveModeOnInitialPageLoad
    );

    const [pausedCount, setPausedCount] = useState<number>(0);

    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selected, setSelected] = useState<AlertItem | null>(null);

    const [flashKeys, setFlashKeys] = useState<Set<string>>(() => new Set());

    const [searchInput, setSearchInput] = useState<string>("");
    const [search, setSearch] = useState<string>("");

    const activeFilterCount = useMemo(
        () => countActiveFilters(filters),
        [filters]
    );
    const liveMode =
        liveEnabled &&
        page === 0 &&
        !search &&
        areAlertsFiltersEqual(filters, defaultFilters);

    const pendingRef = useRef<AlertItem[]>([]);
    const flushScheduledRef = useRef(false);

    useEffect(() => {
        if (
            activeFilterCount > 0 ||
            settings.thresholdDefaults.defaultPreset !== "CUSTOM"
        ) {
            setShowFilters(true);
        }
    }, [activeFilterCount, settings.thresholdDefaults.defaultPreset]);

    const goLive = useCallback(() => {
        setFilters(defaultFilters);
        setSearchInput("");
        setSearch("");
        setPage(0);
        setLiveEnabled(true);
        setPausedCount(0);
    }, [defaultFilters]);

    const flushPending = useCallback(() => {
        flushScheduledRef.current = false;

        const batch = pendingRef.current;
        pendingRef.current = [];
        if (!batch.length) return;

        setItems((prev) => {
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

    const applySearch = () => {
        setPage(0);
        setSearch(searchInput.trim());
    };

    const clearSearch = () => {
        setSearchInput("");
        setSearch("");
        setPage(0);
    };

    const fetchPage = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params: any = {
                limit: pageSize,
                offset: page * pageSize,
            };

            if (search) params.q = search;
            if (filters.since) params.since = filters.since;
            if (filters.until) params.until = filters.until;
            if (typeof filters.scoreMin === "number") params.scoreMin = filters.scoreMin;
            if (typeof filters.scoreMax === "number") params.scoreMax = filters.scoreMax;

            if (filters.detectionMethod !== "ALL") {
                params.detectionMethods = filters.detectionMethod;
            }

            if (filters.severities.length) {
                params.severities = filters.severities.join(",");
            }

            if (filters.reviewStatus !== "ALL") {
                params.reviewStatus = filters.reviewStatus;
            }

            if (filters.escalationStatus !== "ALL") {
                params.escalationStatus = filters.escalationStatus;
            }

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
    }, [page, pageSize, filters, search]);

    useEffect(() => {
        void fetchPage();
        if (!liveMode) setPausedCount(0);
    }, [fetchPage, liveMode]);

    useEffect(() => {
        const onStateUpdated = () => {
            void fetchPage();
        };

        window.addEventListener(
            "alerts:review-updated",
            onStateUpdated as EventListener
        );
        window.addEventListener(
            "alerts:escalation-updated",
            onStateUpdated as EventListener
        );

        return () => {
            window.removeEventListener(
                "alerts:review-updated",
                onStateUpdated as EventListener
            );
            window.removeEventListener(
                "alerts:escalation-updated",
                onStateUpdated as EventListener
            );
        };
    }, [fetchPage]);

    const onRealtimeAlert = useCallback(
        (a: AlertItem) => {
            if (!liveMode) {
                setPausedCount((c) => c + 1);
                return;
            }

            if (!matchesFilters(a, filters)) return;
            if (!matchesSearchLocal(a, search)) return;

            const key = alertKey(a);
            if (!key) return;

            if (seenRef.current.has(key)) return;
            seenRef.current.add(key);

            if (settings.realtime.flashNewRows) {
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
            }

            const sev = normalizeSeverity(a.severity);
            if (sound && (sev === "HIGH" || sev === "CRITICAL")) playBeep();

            if (
                settings.workflowDefaults.autoOpenNewestAlert &&
                !detailsOpen
            ) {
                setSelected(a);
                setDetailsOpen(true);
            }

            (a as any)._uiRecv = performance.now();
            pendingRef.current.unshift(a);
            scheduleFlush();

            const now = Date.now();
            const rt: any = (a as any)._rt || {};

            const apiConsumerTs =
                typeof rt.apiConsumerTs === "number" ? rt.apiConsumerTs : null;
            const serverTs =
                typeof rt.serverTs === "number" ? rt.serverTs : null;

            const emitToUiMs = serverTs !== null ? now - serverTs : null;
            const consumeToEmitMs =
                apiConsumerTs !== null && serverTs !== null
                    ? serverTs - apiConsumerTs
                    : null;
            const consumeToUiMs =
                apiConsumerTs !== null ? now - apiConsumerTs : null;

            console.log(
                "emit_to_ui_ms",
                emitToUiMs,
                "consume_to_emit_ms",
                consumeToEmitMs,
                "consume_to_ui_ms",
                consumeToUiMs
            );
        },
        [
            liveMode,
            filters,
            sound,
            scheduleFlush,
            search,
            settings,
            detailsOpen,
        ]
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
            setSortDir("desc");
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

    const total = pageMeta?.total;
    const totalPages =
        total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
    const currentPageLabel = page + 1;
    const fromRow = displayed.length ? page * pageSize + 1 : 0;
    const toRow = page * pageSize + displayed.length;

    const compact = settings.display.compactTableRows;

    const density = compact
        ? {
            row: "h-9",
            head: "px-2 py-1 text-[11px] font-medium leading-none",
            text: "px-2 py-1.5 text-[11px] leading-none",
            mono: "px-2 py-1.5 font-mono text-[11px] leading-none",
            badge: "h-5 rounded-md px-1.5 text-[10px] leading-none",
            button: "h-7 px-2 text-[11px]",
            scoreWrap: "min-w-[88px]",
            scoreMeta: "mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground",
            scoreTrack: "h-1.5",
        }
        : {
            row: "",
            head: "",
            text: "text-xs",
            mono: "font-mono text-xs",
            badge: "",
            button: "",
            scoreWrap: "min-w-[140px]",
            scoreMeta: "mb-1 flex items-center justify-between text-[11px] text-muted-foreground",
            scoreTrack: "h-2",
        };

    function compactMethodLabel(value: unknown): string {
        const s = String(value ?? "—").trim().toUpperCase();
        if (!compact) return s || "—";
        if (s === "ML_AND_RULES") return "ML+R";
        return s || "—";
    }

    function compactReviewLabel(value: ReviewStatus): string {
        if (!compact) return value;
        if (value === "FALSE_POSITIVE") return "FP";
        return value;
    }

    function compactEscalationLabel(value: EscalationStatus): string {
        if (!compact) return value;
        if (value === "ESCALATED") return "ESC";
        return value;
    }

    const HeaderSort = ({
                            label,
                            by,
                        }: {
        label: string;
        by: AlertsSortBy;
    }) => (
        <button
            className="flex items-center gap-1 hover:underline"
            onClick={() => toggleSort(by)}
            title={`Sort by ${label}`}
        >
            <span>{label}</span>
            {sortBy === by ? (
                <span className="text-muted-foreground">
                    {sortDir === "desc" ? "↓" : "↑"}
                </span>
            ) : null}
        </button>
    );

    return (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold tracking-tight">Alert queue</div>

                            <Badge variant={socket.connected ? "default" : "outline"}>
                                {socket.connected ? "Connected" : "Disconnected"}
                            </Badge>

                            <Badge variant={liveMode ? "secondary" : "outline"}>
                                {liveMode ? "Live" : "History"}
                            </Badge>

                            {defaultPresetMeta ? (
                                <Badge variant="outline">{defaultPresetMeta.label}</Badge>
                            ) : null}

                            {activeFilterCount > 0 ? (
                                <Badge variant="outline">{activeFilterCount} filters</Badge>
                            ) : null}

                            {search ? <Badge variant="outline">Search active</Badge> : null}
                        </div>

                        <div className="text-sm text-muted-foreground">
                            {total != null
                                ? `${total.toLocaleString()} matching alerts`
                                : `${displayed.length.toLocaleString()} alerts loaded`}
                            {!liveMode && pausedCount > 0
                                ? ` • ${pausedCount.toLocaleString()} new while browsing`
                                : ""}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {!liveMode ? (
                            <Button size="sm" onClick={goLive}>
                                Back to live
                            </Button>
                        ) : null}

                        <Button
                            size="sm"
                            variant={showFilters ? "secondary" : "outline"}
                            onClick={() => setShowFilters((v) => !v)}
                        >
                            <SlidersHorizontalIcon className="mr-1 size-4" />
                            Filters
                        </Button>

                        <Button
                            size="sm"
                            variant={autoScroll ? "secondary" : "outline"}
                            onClick={() => {
                                const next = !autoScroll;
                                setAutoScroll(next);
                                updateSettings({
                                    realtime: {
                                        autoScrollLiveAlerts: next,
                                    },
                                });
                            }}
                        >
                            Auto-scroll
                        </Button>

                        <Button
                            size="sm"
                            variant={sound ? "secondary" : "outline"}
                            onClick={() => {
                                const next = !sound;
                                setSound(next);
                                updateSettings({
                                    realtime: {
                                        soundOnHighCritical: next,
                                    },
                                });
                            }}
                        >
                            {sound ? (
                                <Volume2Icon className="mr-1 size-4" />
                            ) : (
                                <VolumeXIcon className="mr-1 size-4" />
                            )}
                            Sound
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void fetchPage()}
                            disabled={loading}
                        >
                            <RefreshCwIcon
                                className={`mr-1 size-4 ${
                                    loading ? "animate-spin" : ""
                                }`}
                            />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") applySearch();
                            }}
                            placeholder="Search alertId, eventId, cardId, accountId, severity, method..."
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={applySearch}>Search</Button>
                        <Button
                            variant="outline"
                            onClick={clearSearch}
                            disabled={!search && !searchInput}
                        >
                            Clear
                        </Button>
                    </div>
                </div>

                {search ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">query: {search}</Badge>
                    </div>
                ) : null}
            </div>

            {showFilters ? (
                <div className="border-b bg-muted/20 p-4">
                    <AlertsFilters
                        compact={compact}
                        value={filters}
                        onChange={(n) => {
                            setPage(0);
                            setFilters(n);
                        }}
                    />
                </div>
            ) : null}

            <div
                ref={scrollerRef}
                className={compact ? "max-h-[72vh] overflow-auto" : "max-h-[64vh] overflow-auto"}
            >
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                            <TableHead className={`${compact ? "w-[120px]" : "w-[180px]"} ${density.head}`}>
                                Alert
                            </TableHead>
                            <TableHead className={`${compact ? "w-[140px]" : "w-[180px]"} ${density.head}`}>
                                <HeaderSort label="Time" by="time" />
                            </TableHead>
                            <TableHead className={`${compact ? "w-[90px]" : "w-[110px]"} ${density.head}`}>
                                Amount
                            </TableHead>
                            <TableHead className={`${compact ? "w-[90px]" : "w-[110px]"} ${density.head}`}>
                                Card
                            </TableHead>
                            <TableHead className={`${compact ? "w-[110px]" : "w-[180px]"} ${density.head}`}>
                                <HeaderSort label="Score" by="score" />
                            </TableHead>
                            <TableHead className={`${compact ? "w-[96px]" : "w-[120px]"} ${density.head}`}>
                                Severity
                            </TableHead>
                            <TableHead className={`${compact ? "w-[92px]" : "w-[140px]"} ${density.head}`}>
                                Method
                            </TableHead>
                            <TableHead className={`${compact ? "w-[90px]" : "w-[150px]"} ${density.head}`}>
                                Review
                            </TableHead>
                            <TableHead className={`${compact ? "w-[90px]" : "w-[150px]"} ${density.head}`}>
                                Escalation
                            </TableHead>
                            <TableHead className={`${compact ? "w-[72px]" : "w-[100px]"} text-right ${density.head}`}>
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {loading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={`sk-${i}`}>
                                    <TableCell colSpan={10}>
                                        <Skeleton className="h-10 w-full" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={10}>
                                    <div className="p-4 text-sm">
                                        <div className="font-medium">Failed to load alerts</div>
                                        <div className="text-muted-foreground">{error}</div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : displayed.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10}>
                                    <div className="p-8 text-sm text-muted-foreground">
                                        No alerts match the current search and filters.
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayed.map((a) => {
                                const sev = normalizeSeverity(a.severity);
                                const reviewStatus = normalizeReviewStatus(a.reviewStatus);
                                const escalationStatus = normalizeEscalationStatus(a.escalationStatus);
                                const key = alertKey(a);
                                const flash = flashKeys.has(key);

                                const score = clamp01(a.fraudScore, 0);
                                const pct = Math.round(score * 100);

                                const displayAlertId = a.alertId ?? a.id;

                                return (
                                    <TableRow
                                        key={key}
                                        className={[
                                            "cursor-pointer transition-colors duration-700",
                                            density.row,
                                            severityRowClass(sev),
                                            flash ? "bg-foreground/5" : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        onClick={() => openDetails(a)}
                                        title="Click to view details"
                                    >
                                        <TableCell className={density.mono}>
                                            {settings.display.showRawIdsInTable
                                                ? String(displayAlertId ?? "—")
                                                : truncateId(displayAlertId, compact ? 8 : 10)}
                                        </TableCell>

                                        <TableCell className={density.text}>
                                            {formatTimestamp(a.createdAt, settings.display.timestampFormat)}
                                        </TableCell>

                                        <TableCell className={density.text}>
                                            {typeof a.amount === "number" ? `$${a.amount.toFixed(2)}` : "—"}
                                        </TableCell>

                                        <TableCell className={density.mono}>
                                            {maskId(a.cardId, 4, settings.display.cardMaskMode)}
                                        </TableCell>

                                        <TableCell className={compact ? "px-2 py-1.5" : ""}>
                                            <div className={density.scoreWrap} title={score.toFixed(3)}>
                                                <div className={density.scoreMeta}>
                                                    <span>{pct}%</span>
                                                    {!compact ? <span>{score.toFixed(3)}</span> : null}
                                                </div>
                                                <div className={`${density.scoreTrack} w-full rounded-full bg-muted`}>
                                                    <div
                                                        className={`${density.scoreTrack} rounded-full bg-foreground`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className={compact ? "px-2 py-1.5" : ""}>
                                            <Badge className={density.badge} variant={severityBadgeVariant(sev)}>
                                                {sev}
                                            </Badge>
                                        </TableCell>

                                        <TableCell className={density.text}>
                                            {compactMethodLabel(a.detectionMethod)}
                                        </TableCell>

                                        <TableCell className={compact ? "px-2 py-1.5" : ""}>
                                            <Badge className={density.badge} variant={reviewBadgeVariant(reviewStatus)}>
                                                {compactReviewLabel(reviewStatus)}
                                            </Badge>
                                        </TableCell>

                                        <TableCell className={compact ? "px-2 py-1.5" : ""}>
                                            <Badge className={density.badge} variant={escalationBadgeVariant(escalationStatus)}>
                                                {compactEscalationLabel(escalationStatus)}
                                            </Badge>
                                        </TableCell>

                                        <TableCell className={`${compact ? "px-2 py-1.5" : ""} text-right`}>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className={density.button}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDetails(a);
                                                }}
                                            >
                                                {compact ? "Open" : "View"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="border-t px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {fromRow.toLocaleString()}–{toRow.toLocaleString()}
                        {total != null ? ` of ${total.toLocaleString()}` : ""}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                        <div className="flex items-center gap-2">
                            <span className={compact ? "text-[11px] text-muted-foreground" : "text-sm text-muted-foreground"}>
                                {compact ? "Rows" : "Rows per page"}
                            </span>
                            {[25, 50, 100, 200].map((n) => (
                                <Button
                                    key={n}
                                    size="sm"
                                    variant={pageSize === n ? "secondary" : "outline"}
                                    className={compact ? "h-7 px-2 text-[11px]" : ""}
                                    onClick={() => {
                                        setPage(0);
                                        setPageSize(n);
                                        updateSettings({
                                            workflowDefaults: {
                                                defaultPageSize: n as PageSizeOption,
                                            },
                                        });
                                    }}
                                >
                                    {n}
                                </Button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="min-w-[92px] text-right text-sm text-muted-foreground">
                                Page {currentPageLabel}
                                {totalPages ? ` of ${totalPages}` : ""}
                            </div>

                            <Button
                                size="sm"
                                variant="outline"
                                className={compact ? "h-7 w-7 p-0" : ""}
                                onClick={() => setPage(0)}
                                disabled={page === 0}
                                title="First page"
                            >
                                <ChevronsLeftIcon className="size-4" />
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                className={compact ? "h-7 w-7 p-0" : ""}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                title="Previous page"
                            >
                                <ChevronLeftIcon className="size-4" />
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                className={compact ? "h-7 w-7 p-0" : ""}
                                onClick={() => setPage((p) => p + 1)}
                                disabled={loading || pageMeta?.hasMore === false}
                                title="Next page"
                            >
                                <ChevronRightIcon className="size-4" />
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                className={compact ? "h-7 w-7 p-0" : ""}
                                onClick={() => {
                                    if (totalPages) setPage(totalPages - 1);
                                }}
                                disabled={
                                    loading || !totalPages || page >= totalPages - 1
                                }
                                title="Last page"
                            >
                                <ChevronsRightIcon className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <AlertDetailsDialog
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                alert={selected}
                hasPrev={hasPrev}
                hasNext={hasNext}
                onPrev={goPrev}
                onNext={goNext}
            />
        </div>
    );
}