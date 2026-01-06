import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
    clamp01,
    formatTimestamp,
    maskId,
    normalizeSeverity,
    severityBadgeVariant,
} from "@/lib/alerts";
import type { AlertDetail, AlertItem } from "@/types/alert_types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogClose
} from "@/components/ui/dialog";

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    alert: AlertItem | null;

    hasPrev?: boolean;
    hasNext?: boolean;
    onPrev?: () => void;
    onNext?: () => void;
};

function isRecord(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === "object" && !Array.isArray(v);
}

function formatReason(r: unknown): string {
    const s = (r == null ? "" : String(r)).trim();
    if (!s) return "—";
    return s.replaceAll("_", " ");
}

function toPrettyJson(v: unknown): string {
    try {
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
}

function downloadJson(filename: string, obj: unknown) {
    const blob = new Blob([toPrettyJson(obj)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function ScoreGauge({ score }: { score: number }) {
    const s = clamp01(score, 0);
    const pct = Math.round(s * 100);
    const deg = Math.round(s * 360);

    return (
        <div className="flex items-center gap-4">
            <div
                className="relative h-16 w-16 rounded-full border"
                style={{
                    background: `conic-gradient(hsl(var(--foreground)) ${deg}deg, hsl(var(--muted)) 0deg)`,
                }}
                aria-label={`Fraud score ${pct}%`}
                title={`Fraud score ${s.toFixed(3)}`}
            >
                <div className="absolute inset-2 grid place-items-center rounded-full bg-background">
                    <div className="text-xs font-semibold">{pct}%</div>
                </div>
            </div>

            <div className="min-w-[160px]">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{pct}%</span>
                    <span>{s.toFixed(3)}</span>
                </div>
                <div className="mt-1 h-2 w-full rounded bg-muted">
                    <div className="h-2 rounded bg-foreground" style={{ width: `${pct}%` }} />
                </div>
            </div>
        </div>
    );
}

function KeyValueGrid({
                          obj,
                          title,
                          emptyText,
                      }: {
    obj: Record<string, unknown> | null;
    title: string;
    emptyText?: string;
}) {
    const entries = useMemo(() => {
        if (!obj) return [];
        return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
    }, [obj]);

    return (
        <div className="rounded-xl border p-4">
            <div className="mb-3 text-sm font-semibold">{title}</div>
            {entries.length === 0 ? (
                <div className="text-sm text-muted-foreground">{emptyText ?? "—"}</div>
            ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {entries.map(([k, v]) => {
                        const isObj = isRecord(v) || Array.isArray(v);
                        const text = isObj ? toPrettyJson(v) : v == null ? "—" : String(v);
                        return (
                            <div key={k} className="rounded-lg border bg-background p-2">
                                <div className="text-[11px] font-mono text-muted-foreground">{k}</div>
                                <div className="mt-1 break-words text-xs">
                                    {isObj ? (
                                        <pre className="max-h-32 overflow-auto text-xs leading-relaxed">{text}</pre>
                                    ) : (
                                        text
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function AlertDetail({
                                open,
                                onOpenChange,
                                alert,
                                hasPrev,
                                hasNext,
                                onPrev,
                                onNext,
                            }: Props) {
    const cacheRef = useRef<Map<string, AlertDetail>>(new Map());
    const abortRef = useRef<AbortController | null>(null);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [detail, setDetail] = useState<AlertDetail | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const id = (alert?.alertId ?? alert?.id ?? "").toString();

    useEffect(() => {
        if (!open) return;

        // reset action feedback when opening
        setActionMsg(null);
    }, [open]);

    useEffect(() => {
        if (!open || !id) {
            setLoading(false);
            setErr(null);
            setDetail(null);
            return;
        }

        const cached = cacheRef.current.get(id);
        if (cached) {
            setDetail(cached);
            setErr(null);
            setLoading(false);
            return;
        }

        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        setLoading(true);
        setErr(null);
        setDetail(null);

        (async () => {
            try {
                const res = await api.get<AlertDetail>(`/api/alerts/${encodeURIComponent(id)}`, {
                    signal: ac.signal as any,
                });
                const data = (res?.data ?? null) as any;
                if (!data) throw new Error("empty_response");
                cacheRef.current.set(id, data);
                setDetail(data);
                setLoading(false);
            } catch (e: any) {
                if (e?.name === "CanceledError" || e?.name === "AbortError") return;
                setErr(e?.message ? String(e.message) : "fetch_failed");
                setLoading(false);
            }
        })();

        return () => {
            ac.abort();
        };
    }, [open, id]);

    // keyboard navigation
    useEffect(() => {
        if (!open) return;

        const onKey = (ev: KeyboardEvent) => {
            if (ev.key === "ArrowLeft" && hasPrev && onPrev) {
                ev.preventDefault();
                onPrev();
            }
            if (ev.key === "ArrowRight" && hasNext && onNext) {
                ev.preventDefault();
                onNext();
            }
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, hasPrev, hasNext, onPrev, onNext]);

    const sev = useMemo(() => normalizeSeverity(detail?.severity ?? alert?.severity), [detail?.severity, alert?.severity]);
    const score = useMemo(() => clamp01((detail?.fraudScore ?? alert?.fraudScore) as any, 0), [detail?.fraudScore, alert?.fraudScore]);

    const reasons = useMemo(() => {
        const r = (detail as any)?.reasons;
        return Array.isArray(r) ? r : [];
    }, [detail]);


    const transactionObj = useMemo(() => {
        if (!detail) return null;

        const d: any = detail as any;
        if (isRecord(d.transaction)) return d.transaction as Record<string, unknown>;

        const out: Record<string, unknown> = {};
        const omit = new Set(["index", "_rt", "transaction"]);
        for (const [k, v] of Object.entries(detail)) {
            if (omit.has(k)) continue;
            out[k] = v;
        }
        return out;
    }, [detail]);

    const timeline = useMemo(() => {
        const d: any = detail ?? alert ?? {};
        const items: Array<{ label: string; value: unknown }> = [];

        // best-effort keys
        const txTs =
            d.transactionTs ?? d.txTs ?? d.eventTs ?? d.eventTime ?? d.transactionTime ?? d.txTime ?? null;
        if (txTs) items.push({ label: "Transaction time", value: txTs });

        if (d.createdAt) items.push({ label: "Alert created", value: d.createdAt });

        // _rt timestamps if present
        const rt = d._rt;
        if (rt && typeof rt === "object") {
            for (const [k, v] of Object.entries(rt)) {
                if (k.toLowerCase().includes("ts") || k.toLowerCase().includes("time")) {
                    items.push({ label: `_rt.${k}`, value: v });
                }
            }
        }

        // dedupe by label
        const seen = new Set<string>();
        return items.filter((it) => {
            if (seen.has(it.label)) return false;
            seen.add(it.label);
            return true;
        });
    }, [detail, alert]);

    const json = useMemo(() => (detail ? toPrettyJson(detail) : ""), [detail]);

    const displayId = (detail?.alertId ?? detail?.id ?? id ?? "—").toString();

    const topBadges = (
        <>
            <Badge variant={severityBadgeVariant(sev)}>{sev}</Badge>
            <Badge variant="outline">time: {formatTimestamp(detail?.createdAt ?? alert?.createdAt)}</Badge>
            <Badge variant="outline">method: {(detail?.detectionMethod ?? alert?.detectionMethod ?? "—").toString()}</Badge>
            <Badge variant="outline">id: {displayId}</Badge>
        </>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Alert details</DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-2">
                        {topBadges}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[75vh] overflow-y-auto pr-2">
                {actionMsg ? (
                    <div className="rounded-lg border bg-secondary/20 p-3 text-sm">
                        <span className="font-medium">Action:</span>{" "}
                        <span className="text-muted-foreground">{actionMsg}</span>
                    </div>
                ) : null}

                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : err ? (
                    <div className="rounded-lg border p-4">
                        <div className="font-medium">Failed to load alert details</div>
                        <div className="text-sm text-muted-foreground">{err}</div>
                    </div>
                ) : !detail ? (
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">—</div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Summary */}
                        <div className="rounded-xl border p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="text-sm font-semibold">Summary</div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(displayId);
                                                setActionMsg("Copied Alert ID to clipboard");
                                            } catch {
                                                setActionMsg("Copy failed (clipboard blocked)");
                                            }
                                        }}
                                    >
                                        Copy Alert ID
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            downloadJson(`alert_${displayId}.json`, detail);
                                            setActionMsg("Exported alert JSON");
                                        }}
                                    >
                                        Export JSON
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <ScoreGauge score={score} />

                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    <div className="rounded-lg border bg-background p-2">
                                        <div className="text-[11px] font-mono text-muted-foreground">amount</div>
                                        <div className="mt-1 text-xs">
                                            {typeof detail.amount === "number"
                                                ? `${detail.amount.toFixed(2)} ${String(detail.currency ?? "")}`.trim()
                                                : "—"}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border bg-background p-2">
                                        <div className="text-[11px] font-mono text-muted-foreground">cardId</div>
                                        <div className="mt-1 text-xs font-mono">{maskId(detail.cardId, 4)}</div>
                                    </div>

                                    <div className="rounded-lg border bg-background p-2">
                                        <div className="text-[11px] font-mono text-muted-foreground">accountId</div>
                                        <div className="mt-1 text-xs font-mono">{String((detail as any).accountId ?? "—")}</div>
                                    </div>

                                    <div className="rounded-lg border bg-background p-2">
                                        <div className="text-[11px] font-mono text-muted-foreground">eventId</div>
                                        <div className="mt-1 text-xs font-mono">{String((detail as any).eventId ?? "—")}</div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            console.log("[alert_action] false_positive", { id: displayId });
                                            setActionMsg("Marked as False Positive (stub)");
                                        }}
                                    >
                                        Mark as False Positive
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            console.log("[alert_action] escalate", { id: displayId });
                                            setActionMsg("Escalated alert (stub)");
                                        }}
                                    >
                                        Escalate Alert
                                    </Button>

                                    <div className="ml-auto flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={onPrev} disabled={!hasPrev || !onPrev}>
                                            Prev
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={onNext} disabled={!hasNext || !onNext}>
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-xl border p-4">
                                <div className="mb-3 text-sm font-semibold">Rule violations</div>
                                {reasons.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">—</div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {reasons.map((r: any, idx: number) => (
                                            <Badge key={`${String(r)}-${idx}`} variant="secondary">
                                                {formatReason(r)}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Transaction fields */}
                        <KeyValueGrid obj={transactionObj} title="Transaction fields" emptyText="No transaction fields found." />

                        {/* Timeline + Raw JSON */}
                        <div className="space-y-4">
                            <div className="rounded-xl border p-4">
                                <div className="mb-3 text-sm font-semibold">Timeline</div>
                                {timeline.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">—</div>
                                ) : (
                                    <div className="space-y-2">
                                        {timeline.map((it) => (
                                            <div key={it.label} className="flex items-center justify-between rounded-lg border bg-background p-2">
                                                <div className="text-xs font-mono">{it.label}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {typeof it.value === "string" && it.value.includes("T")
                                                        ? formatTimestamp(it.value)
                                                        : String(it.value ?? "—")}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border p-4">
                                <div className="mb-2 text-sm font-semibold">Raw JSON</div>
                                <details className="rounded-lg border bg-background p-2">
                                    <summary className="cursor-pointer select-none text-xs text-muted-foreground">
                                        Toggle JSON
                                    </summary>
                                    <pre className="mt-2 max-h-[45vh] overflow-auto text-xs leading-relaxed">
                    {json || "—"}
                  </pre>
                                </details>
                            </div>
                        </div>
                    </div>
                )}
                </div>
                <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                    <DialogClose asChild>
                        <Button variant="outline">Close</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
