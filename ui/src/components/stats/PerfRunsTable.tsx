import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { PerfRunsResponse } from "@/types/perf";

function fmtNum(v: unknown, digits = 2): string {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    // avoid noise
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(digits);
}

function fmtIso(v?: string): string {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toISOString().replace("T", " ").replace("Z", " UTC");
}

type Props = {
    data: PerfRunsResponse | null;
    loading: boolean;
    error: string | null;
    updatedAt: string | null;
    onRefresh: () => void;
};

export function PerfRunsTable({ data, loading, error, updatedAt, onRefresh }: Props) {
    const rows = data?.items ?? [];

    const headerRight = useMemo(() => {
        return (
            <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">
                    {updatedAt ? `Updated ${fmtIso(updatedAt)}` : ""}
                </div>
                <Button variant="secondary" size="sm" onClick={onRefresh}>
                    Refresh
                </Button>
            </div>
        );
    }, [updatedAt, onRefresh]);

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Performance Results</CardTitle>
                {headerRight}
            </CardHeader>

            <CardContent className="space-y-3">
                {error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Failed to load perf runs</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {loading && rows.length === 0 ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Run ID</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                    <TableHead>Mix</TableHead>
                                    <TableHead className="text-right">Tx sent</TableHead>
                                    <TableHead className="text-right">Avg send</TableHead>
                                    <TableHead className="text-right">Flink in/s</TableHead>
                                    <TableHead className="text-right">Flink out/s</TableHead>
                                    <TableHead className="text-right">Lag fraud-detector</TableHead>
                                    <TableHead className="text-right">Lag api-streamer</TableHead>
                                    <TableHead className="text-right">Max backpressure</TableHead>
                                    <TableHead className="text-right">P50 ms</TableHead>
                                    <TableHead className="text-right">P95 ms</TableHead>
                                    <TableHead className="text-right">P99 ms</TableHead>
                                    <TableHead>Peak CPU</TableHead>
                                    <TableHead>Peak RAM</TableHead>
                                    <TableHead className="text-right">ES index Δ</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={18} className="text-sm text-muted-foreground">
                                            No runs yet. Post one to <code>/api/perf/runs</code>.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-mono text-xs">{r.runId ?? r.id}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.rate, 0)}</TableCell>
                                            <TableCell className="text-right">
                                                {r.durationSec != null ? `${fmtNum(r.durationSec, 0)}s` : "—"}
                                            </TableCell>
                                            <TableCell>{r.mix ?? "—"}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.txSent, 0)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.avgSendRate, 2)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.flinkAvgInPerSec, 2)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.flinkAvgOutPerSec, 2)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.maxLagFraudDetector, 0)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.maxLagApiStreamer, 0)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.maxBackpressureRatio, 3)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.p50LatencyMs, 0)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.p95LatencyMs, 0)}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.p99LatencyMs, 0)}</TableCell>
                                            <TableCell className="text-xs">{r.peakCpu ?? "—"}</TableCell>
                                            <TableCell className="text-xs">{r.peakRam ?? "—"}</TableCell>
                                            <TableCell className="text-right">{fmtNum(r.esIndexTotalDelta, 0)}</TableCell>
                                            <TableCell className="text-xs">{r.notes ?? ""}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
