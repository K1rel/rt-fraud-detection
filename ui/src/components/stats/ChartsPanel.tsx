import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatsResponse, TrendsResponse } from "@/hooks/useStats";
import type { TrendsRange } from "@/hooks/useTrends";
import { AlertsOverTimeChart } from "@/components/stats/charts/AlertsOverTimeChart";
import { SeverityDonutChart } from "@/components/stats/charts/SeverityDonutChart";
import { DetectionMethodBarChart } from "@/components/stats/charts/DetectionMethodBarChart";
import { ScoreHistogramChart } from "@/components/stats/charts/ScoreHistogramChart";

const RANGE_LABEL: Record<TrendsRange, string> = {
    "1h": "1h",
    "6h": "6h",
    "24h": "24h",
    "7d": "7d",
};

export function ChartsPanel({
                                className,
                                range,
                                onRangeChange,
                                stats,
                                trends,
                                loading,
                                error,
                                updatedAt,
                                onRefresh,
                            }: {
    className?: string;
    range: TrendsRange;
    onRangeChange: (r: TrendsRange) => void;

    stats: StatsResponse | null;
    trends: TrendsResponse | null;

    loading: boolean;
    error: string | null;
    updatedAt: string | null;

    onRefresh: () => void;
}) {
    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="space-y-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-base">Trends & Visualizations</CardTitle>
                        <div className="text-xs text-muted-foreground mt-1">
                            Range affects time-series + histogram •{" "}
                            {updatedAt ? (
                                <>
                                    updated: <span className="font-mono">{updatedAt}</span>
                                </>
                            ) : (
                                "—"
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={range} onValueChange={(v) => onRangeChange(v as TrendsRange)}>
                            <SelectTrigger className="w-[110px]">
                                <SelectValue placeholder="Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1h">{RANGE_LABEL["1h"]}</SelectItem>
                                <SelectItem value="6h">{RANGE_LABEL["6h"]}</SelectItem>
                                <SelectItem value="24h">{RANGE_LABEL["24h"]}</SelectItem>
                                <SelectItem value="7d">{RANGE_LABEL["7d"]}</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="secondary" onClick={onRefresh} disabled={loading} className="gap-2">
                            <RefreshCwIcon className={cn("size-4", loading ? "animate-spin" : "")} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {error ? (
                    <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                        <div className="font-medium">Charts unavailable</div>
                        <div className="text-muted-foreground mt-1">{error}</div>
                        <div className="text-muted-foreground mt-2">
                            Check API: <code>/api/stats</code> and <code>/api/stats/trends?range={range}</code>
                        </div>
                    </div>
                ) : null}

                <div className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3 pb-2">
                        <div className="text-sm font-medium">Alerts over time</div>
                        <div className="text-xs text-muted-foreground">Area line • spike markers</div>
                    </div>
                    <AlertsOverTimeChart range={range} perHour={trends?.perHour ?? []} height={320} loading={loading} />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-xl border p-3">
                        <div className="text-sm font-medium pb-2">Fraud by severity</div>
                        <SeverityDonutChart items={stats?.breakdown?.severity ?? []} height={260} loading={loading} />
                    </div>

                    <div className="rounded-xl border p-3">
                        <div className="text-sm font-medium pb-2">Fraud by detection method</div>
                        <DetectionMethodBarChart items={stats?.breakdown?.detectionMethod ?? []} height={260} loading={loading} />
                    </div>

                    <div className="rounded-xl border p-3">
                        <div className="text-sm font-medium pb-2">Score distribution</div>
                        <ScoreHistogramChart buckets={trends?.scoreHistogram ?? []} height={260} loading={loading} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
