import {
    Area,
    AreaChart,
    Brush,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { TrendsRange } from "@/hooks/useTrends";

type RawPoint = { hour: string; count: number; avgFraudScore: number | null };
type Point = { ts: number; count: number; avgFraudScore: number | null };

function fmtUtc(ts: number): string {
    const iso = new Date(ts).toISOString(); // UTC
    return iso.replace("T", " ").slice(0, 16) + " UTC";
}

function tickUtc(ts: number, range: TrendsRange): string {
    const iso = new Date(ts).toISOString(); // UTC
    if (range === "7d") return iso.slice(5, 10) + " " + iso.slice(11, 16);
    return iso.slice(11, 16);
}

function quantile(sortedAsc: number[], q: number): number {
    if (!sortedAsc.length) return 0;
    const clamped = Math.max(0, Math.min(1, q));
    const idx = (sortedAsc.length - 1) * clamped;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sortedAsc[lo];
    const w = idx - lo;
    return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function SpikeDot({ cx, cy, payload, threshold }: any) {
    const v = typeof payload?.count === "number" ? payload.count : 0;
    if (!Number.isFinite(v) || v <= 0) return null;
    if (v < threshold) return null;

    return (
        <circle
            cx={cx}
            cy={cy}
            r={4}
            fill="hsl(var(--background))"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
        />
    );
}

export function AlertsOverTimeChart({
                                        perHour,
                                        range,
                                        height,
                                        loading,
                                    }: {
    perHour: RawPoint[];
    range: TrendsRange;
    height: number;
    loading?: boolean;
}) {
    const data: Point[] = perHour
        .map((p) => {
            const ts = Date.parse(p.hour);
            return {
                ts: Number.isFinite(ts) ? ts : 0,
                count: typeof p.count === "number" && Number.isFinite(p.count) ? p.count : 0,
                avgFraudScore: typeof p.avgFraudScore === "number" && Number.isFinite(p.avgFraudScore) ? p.avgFraudScore : null,
            };
        })
        .filter((p) => p.ts > 0)
        .sort((a, b) => a.ts - b.ts);

    const counts = data.map((d) => d.count).filter((x) => Number.isFinite(x));
    const threshold = Math.max(1, Math.round(quantile([...counts].sort((a, b) => a - b), 0.9)));

    const yMax = counts.length ? Math.max(...counts) : 1;

    if (loading && !data.length) {
        return <div className="h-[320px] animate-pulse rounded-lg bg-muted/40" />;
    }

    if (!data.length) {
        return <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No data</div>;
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                        dataKey="ts"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => tickUtc(Number(v), range)}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        allowDecimals={false}
                        domain={[0, Math.max(1, yMax)]}
                        tick={{ fontSize: 12 }}
                        width={36}
                    />
                    <Tooltip
                        formatter={(value: any, name: any, props: any) => {
                            if (name === "count") return [String(value), "alerts"];
                            return [String(value), name];
                        }}
                        labelFormatter={(label) => fmtUtc(Number(label))}
                        contentStyle={{ fontSize: 12 }}
                    />

                    <ReferenceLine
                        y={threshold}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="4 4"
                        opacity={0.7}
                        label={{ value: `spike ≥ ${threshold}`, position: "insideTopRight", fontSize: 12 }}
                    />

                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.14}
                        strokeWidth={2}
                        dot={(p) => <SpikeDot {...p} threshold={threshold} />}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                    />

                    <Brush
                        dataKey="ts"
                        height={26}
                        travellerWidth={10}
                        tickFormatter={(v) => tickUtc(Number(v), range)}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
