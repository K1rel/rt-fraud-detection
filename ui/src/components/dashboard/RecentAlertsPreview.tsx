import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
    alertKey,
    clamp01,
    formatTimestamp,
    maskId,
    normalizeSeverity,
    severityBadgeVariant,
    truncateId,
} from "@/lib/alerts";
import { useAlertsSocket } from "@/hooks/useAlertsSocket";
import type { AlertItem, AlertsResponse } from "@/types/alert_types";

import { AlertDetailsDialog } from "@/components/alerts/AlertDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    onOpenAllAlerts?: () => void;
    wsUrl?: string;
};

const PREVIEW_LIMIT = 8;

export function RecentAlertsPreview({ onOpenAllAlerts, wsUrl }: Props) {
    const baseWsUrl = wsUrl ?? (api.defaults.baseURL || "http://localhost:3001");

    const [items, setItems] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const seenRef = useRef<Set<string>>(new Set());

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selected, setSelected] = useState<AlertItem | null>(null);

    const fetchRecent = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await api.get<AlertsResponse>("/api/alerts", {
                params: {
                    limit: PREVIEW_LIMIT,
                    offset: 0,
                },
            });

            const next = res.data?.items ?? [];
            const seen = new Set<string>();

            for (const a of next) {
                const key = alertKey(a);
                if (key) seen.add(key);
            }

            seenRef.current = seen;
            setItems(next);
            setLoading(false);
        } catch (e: any) {
            setError(e?.message ? String(e.message) : "fetch_failed");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchRecent();
    }, [fetchRecent]);

    const onRealtimeAlert = useCallback((a: AlertItem) => {
        const key = alertKey(a);
        if (!key) return;
        if (seenRef.current.has(key)) return;

        seenRef.current.add(key);

        setItems((prev) => {
            const next = [a, ...prev].slice(0, PREVIEW_LIMIT);
            const allowed = new Set(next.map((x) => alertKey(x)).filter(Boolean));
            seenRef.current = allowed;
            return next;
        });
    }, []);

    const socket = useAlertsSocket({
        url: baseWsUrl,
        enabled: true,
        onAlert: onRealtimeAlert,
    });

    const openDetails = (a: AlertItem) => {
        setSelected(a);
        setDetailsOpen(true);
    };

    const selectedIndex = useMemo(() => {
        if (!selected) return -1;
        const key = alertKey(selected);
        if (!key) return -1;
        return items.findIndex((x) => alertKey(x) === key);
    }, [selected, items]);

    const hasPrev = selectedIndex > 0;
    const hasNext = selectedIndex >= 0 && selectedIndex < items.length - 1;

    const goPrev = () => {
        if (!hasPrev) return;
        const next = items[selectedIndex - 1];
        if (next) setSelected(next);
    };

    const goNext = () => {
        if (!hasNext) return;
        const next = items[selectedIndex + 1];
        if (next) setSelected(next);
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Recent Alerts</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Latest alerts preview from the live stream
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant={socket.connected ? "default" : "outline"}>
                            {socket.connected ? "WS Connected" : "WS Disconnected"}
                        </Badge>
                        <Badge variant="outline">showing {items.length}</Badge>
                        <Button variant="outline" onClick={() => void fetchRecent()}>
                            Refresh
                        </Button>
                        {onOpenAllAlerts ? (
                            <Button onClick={onOpenAllAlerts}>Open Alerts</Button>
                        ) : null}
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Alert</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Card</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {loading ? (
                                    Array.from({ length: PREVIEW_LIMIT }).map((_, i) => (
                                        <TableRow key={`recent-sk-${i}`}>
                                            <TableCell colSpan={8}>
                                                <Skeleton className="h-8 w-full" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : error ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="p-4 text-sm">
                                            <div className="font-medium">Failed to load recent alerts</div>
                                            <div className="text-muted-foreground">{error}</div>
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="p-6 text-sm text-muted-foreground">
                                            No alerts yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((a) => {
                                        const sev = normalizeSeverity(a.severity);
                                        const score = clamp01(a.fraudScore, 0);
                                        const pct = Math.round(score * 100);
                                        const displayAlertId = a.alertId ?? a.id;

                                        return (
                                            <TableRow
                                                key={alertKey(a)}
                                                className="cursor-pointer"
                                                onClick={() => openDetails(a)}
                                                title="Click to inspect alert"
                                            >
                                                <TableCell className="font-mono text-xs">
                                                    {truncateId(displayAlertId, 10)}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {formatTimestamp(a.createdAt)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={severityBadgeVariant(sev)}>{sev}</Badge>
                                                </TableCell>
                                                <TableCell className="text-xs tabular-nums">
                                                    {pct}% ({score.toFixed(3)})
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {typeof a.amount === "number"
                                                        ? `$${a.amount.toFixed(2)}`
                                                        : "—"}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {maskId(a.cardId, 4)}
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
                </CardContent>
            </Card>

            <AlertDetailsDialog
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                alert={selected}
                hasPrev={hasPrev}
                hasNext={hasNext}
                onPrev={goPrev}
                onNext={goNext}
            />
        </>
    );
}