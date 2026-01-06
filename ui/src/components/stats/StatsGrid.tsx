import { StatsCard, StatsCardSkeleton } from "@/components/stats/StatsCard";
import { AlertCircleIcon, BellIcon, GaugeIcon, PieChartIcon, PercentIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStats } from "@/hooks/useStats";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

type PieItem = { label: string; value: number };

const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const severityColor: Record<string, string> = {
    CRITICAL: "hsl(var(--destructive))",
    HIGH: "hsl(var(--destructive))",
    MEDIUM: "hsl(var(--primary))",
    LOW: "hsl(var(--muted-foreground))",
};


function MiniPie({ items, title }: { items: PieItem[]; title?: string }) {
    const total = items.reduce((a, x) => a + (x.value ?? 0), 0);
    const top = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];

    const stops: Array<{ from: number; to: number; color: string }> = [];
    let acc = 0;

    items.forEach((it) => {
        const v = it.value ?? 0;
        const pct = total > 0 ? (v / total) * 100 : 0;
        const from = acc;
        const to = acc + pct;
        acc = to;

        const key = String(it.label ?? "").toUpperCase();
        const color = severityColor[key] ?? "hsl(var(--secondary-foreground))";

        stops.push({ from, to, color });
    });


    const bg =
        total <= 0
            ? "conic-gradient(hsl(var(--muted-foreground)) 0% 100%)"
            : `conic-gradient(${stops.map((s) => `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`).join(", ")})`;

    const label = top ? `${top.label}: ${top.value}` : "—";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-default">
                    <div className="relative size-12 rounded-full border" style={{ background: bg }}>
                        <div className="absolute inset-2.5 rounded-full bg-background" />
                    </div>
                    <div className="hidden xl:block text-xs text-muted-foreground tabular-nums">
                        {label}
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>{title ?? label}</TooltipContent>
        </Tooltip>
    );
}

export function StatsGrid({ className, layout="wide"  }: { className?: string; layout?: "wide" | "compact"; }) {
    const { stats, trends, derived, loading, error, refreshMs } = useStats({ refreshMs: 10_000 });

    const showSkeleton = loading && (!stats || !trends || !derived);


    if (error) {
        return (
            <div className={cn("rounded-xl border bg-muted/20 p-4 text-sm", className)}>
                <div className="font-medium">Stats unavailable</div>
                <div className="text-muted-foreground mt-1">{error}</div>
                <div className="text-muted-foreground mt-2">
                    Auto-refresh: {Math.round(refreshMs / 1000)}s • Check API at <code>/api/stats</code>
                </div>
            </div>
        );
    }

    const gridClass =
        layout === "wide"
            ? "grid gap-6 grid-cols-1 md:grid-cols-2"
            : "grid gap-4 grid-cols-1 sm:grid-cols-2";

    if (showSkeleton) {
        return (
            <div className={cn(gridClass, className)}>
                <StatsCardSkeleton />
                <StatsCardSkeleton />
                <StatsCardSkeleton />
                <StatsCardSkeleton />
                <StatsCardSkeleton />
            </div>
        );
    }

    if (!derived || !stats) return null;

    const { fmt } = derived;

    const totalAlertsValue = fmt.nf0.format(derived.totalAlerts);
    const todaySub = `Today (UTC): ${fmt.nf0.format(derived.todayCount)}`;

    const detectionRateValue = `${fmt.nf1.format(derived.mlShare)}%`;
    const avgScoreValue =
        typeof derived.avgFraudScore === "number" ? fmt.nf3.format(derived.avgFraudScore) : "—";

    const lastHour = stats.windows?.lastHour ?? 0;

    const throughputValue =
        lastHour > 0 ? fmt.nfRate.format(derived.alertsPerSec) : "0";

    const severityItems = (derived.bySeverity ?? [])
        .map((s) => ({
            label: String(s.severity ?? "").toUpperCase(),
            value: s.count ?? 0,
        }))
        .sort((a, b) => {
            const ia = severityOrder.indexOf(a.label as any);
            const ib = severityOrder.indexOf(b.label as any);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });


    return (
        <TooltipProvider delayDuration={200}>
        <div className={cn(gridClass, className)}>
            <StatsCard
                className="min-h-[180px]"
                title="Total Alerts"
                help='Total alerts stored in Elasticsearch. "Today" is computed from hourly buckets since 00:00 UTC.'
                icon={<BellIcon className="size-4" />}
                value={totalAlertsValue}
                subvalue={todaySub}
                trend={{ pct: derived.dayTrendPct, label: "Last 24h vs 7d daily average" }}
                sparkline={derived.sparkCounts}
            />

            <StatsCard
                className="min-h-[180px]"
                title="ML Share of Alerts"
                help='Derived: share of alerts where detectionMethod contains "ML" (ML or ML_AND_RULES). Not a true txn-based rate.'
                icon={<PercentIcon className="size-4" />}
                value={`${detectionRateValue}`}
                subvalue="ML alerts / all alerts"
                trend={undefined}
                sparkline={derived.sparkCounts}
            />

            <StatsCard
                className="min-h-[180px]"
                title="Average Fraud Score"
                help="Average fraudScore (0–1) over all alerts."
                icon={<AlertCircleIcon className="size-4" />}
                value={avgScoreValue}
                subvalue="Mean score across alerts"
                trend={{ pct: derived.scoreTrendPct, label: "Last non-null hour vs previous non-null hour" }}
                sparkline={derived.sparkScores}
            />

            <StatsCard
                className="min-h-[180px]"
                title="Alerts by Severity"
                help="Severity distribution across all alerts (terms aggregation)."
                icon={<PieChartIcon className="size-4" />}
                value={fmt.nf0.format((derived.bySeverity ?? []).reduce((a, s) => a + (s.count ?? 0), 0))}
                subvalue="Distribution across severities"
                trend={undefined}
                sparkline={derived.sparkCounts}
                rightVisual={<MiniPie items={severityItems} title="Severity distribution" />}
            />

            <StatsCard
                className="min-h-[180px]"
                title="Alerts Throughput"
                help='Derived from windows.lastHour as alerts/sec.'
                icon={<GaugeIcon className="size-4" />}
                value={`${throughputValue} alerts/sec`}
                subvalue={`Last hour: ${fmt.nf0.format(lastHour)} alerts`}
                trend={{ pct: derived.hourTrendPct, label: "Current hour vs previous hour (bucket counts)" }}
                sparkline={derived.sparkCounts}
            />
        </div>
        </TooltipProvider>
    );
}
