import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Bucket = { bucket: number; count: number };

function inferStep(buckets: Bucket[]): number {
    const xs = buckets
        .map((b) => (typeof b.bucket === "number" && Number.isFinite(b.bucket) ? b.bucket : null))
        .filter((x): x is number => x != null)
        .sort((a, b) => a - b);

    for (let i = 1; i < xs.length; i++) {
        const d = xs[i] - xs[i - 1];
        if (d > 0 && Number.isFinite(d)) return d;
    }
    return 0.1;
}

function clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
}

export function ScoreHistogramChart({
                                        buckets,
                                        height,
                                        loading,
                                    }: {
    buckets: Bucket[];
    height: number;
    loading?: boolean;
}) {
    const step = inferStep(buckets ?? []);

    const data = (buckets ?? [])
        .map((b) => {
            const start = typeof b.bucket === "number" && Number.isFinite(b.bucket) ? b.bucket : 0;
            const end = clamp01(start + step);
            const label = `${start.toFixed(2)}–${end.toFixed(2)}`;
            return {
                label,
                start,
                count: typeof b.count === "number" && Number.isFinite(b.count) ? b.count : 0,
            };
        })
        .sort((a, b) => a.start - b.start);

    const any = data.some((d) => d.count > 0);

    if (loading && !any) {
        return <div className="h-[260px] animate-pulse rounded-lg bg-muted/40" />;
    }

    if (!any) {
        return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">No data</div>;
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} height={36} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={34} />
                    <Tooltip
                        formatter={(value: any) => [String(value), "alerts"]}
                        labelFormatter={(label) => `score bucket: ${label}`}
                        contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
