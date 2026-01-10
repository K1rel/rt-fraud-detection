import { useMemo, useState } from "react";
import { ChartsPanel } from "@/components/stats/ChartsPanel";
import { StatsGrid } from "@/components/stats/StatsGrid";
import { useStats } from "@/hooks/useStats";
import { useTrends, type TrendsRange } from "@/hooks/useTrends";

function maxIso(a: string | null, b: string | null): string | null {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
}

export function StatsPage() {
    const [range, setRange] = useState<TrendsRange>("24h");

    const statsState = useStats({ refreshMs: 10_000 });

    const trendsState = useTrends(range, {
        refreshMs: 10_000,
        enabled: range !== "24h",
    });

    const stats = statsState.stats;
    const trendsForCharts = range === "24h" ? statsState.trends : trendsState.trends;

    const loadingCharts =
        (stats == null && statsState.loading) ||
        (trendsForCharts == null && (range === "24h" ? statsState.loading : trendsState.loading));

    const errorCharts = statsState.error || (range === "24h" ? null : trendsState.error);

    const updatedAt = useMemo(() => {
        const t1 = statsState.updatedAt;
        const t2 = range === "24h" ? statsState.updatedAt : trendsState.updatedAt;
        return maxIso(t1, t2);
    }, [statsState.updatedAt, trendsState.updatedAt, range]);

    const refreshAll = () => {
        statsState.refreshNow();
        if (range !== "24h") trendsState.refreshNow();
    };

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <div className="text-2xl font-semibold tracking-tight">Statistics</div>
                <div className="text-sm text-muted-foreground">
                    Auto-refresh every 10 seconds • Times shown in UTC
                </div>
            </div>

            <StatsGrid layout="wide" data={statsState} />

            <ChartsPanel
                range={range}
                onRangeChange={setRange}
                stats={stats}
                trends={trendsForCharts}
                loading={loadingCharts}
                error={errorCharts}
                updatedAt={updatedAt}
                onRefresh={refreshAll}
            />
        </div>
    );
}
