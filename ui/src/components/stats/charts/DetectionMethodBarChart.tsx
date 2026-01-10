import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Item = { method: string; count: number };

export function DetectionMethodBarChart({
                                            items,
                                            height,
                                            loading,
                                        }: {
    items: Item[];
    height: number;
    loading?: boolean;
}) {
    const data = (items ?? [])
        .map((x) => ({
            method: String(x.method ?? "UNKNOWN"),
            count: typeof x.count === "number" && Number.isFinite(x.count) ? x.count : 0,
        }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count);

    if (loading && !data.length) {
        return <div className="h-[260px] animate-pulse rounded-lg bg-muted/40" />;
    }

    if (!data.length) {
        return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">No data</div>;
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                        dataKey="method"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={40}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={34} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
