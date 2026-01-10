import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Item = { severity: string; count: number };

const ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;

const SEV_COLOR: Record<string, string> = {
    CRITICAL: "#ef4444",
    HIGH: "#f97316",
    MEDIUM: "#eab308",
    LOW: "#22c55e",
    UNKNOWN: "#94a3b8",
};

function normalizeKey(s: string): string {
    const k = (s ?? "").trim().toUpperCase();
    return k || "UNKNOWN";
}

export function SeverityDonutChart({
                                       items,
                                       height,
                                       loading,
                                   }: {
    items: Array<{ severity: string; count: number }>;
    height: number;
    loading?: boolean;
}) {
    const data = (items ?? [])
        .map((x) => ({
            key: normalizeKey(String(x.severity ?? "UNKNOWN")),
            value: typeof x.count === "number" && Number.isFinite(x.count) ? x.count : 0,
        }))
        .filter((x) => x.value > 0)
        .sort((a, b) => {
            const ia = ORDER.indexOf(a.key as any);
            const ib = ORDER.indexOf(b.key as any);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

    const total = data.reduce((acc, x) => acc + x.value, 0);

    if (loading && !data.length) {
        return <div className="h-[260px] animate-pulse rounded-lg bg-muted/40" />;
    }

    if (!data.length) {
        return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">No data</div>;
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Tooltip
                        formatter={(value: any, name: any, props: any) => {
                            const v = Number(value) || 0;
                            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
                            return [`${v} (${pct}%)`, props?.payload?.key ?? "severity"];
                        }}
                        contentStyle={{ fontSize: 12 }}
                    />
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="key"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                        isAnimationActive={false}
                    >
                        {data.map((entry) => (
                            <Cell key={entry.key} fill={SEV_COLOR[entry.key] ?? SEV_COLOR.UNKNOWN} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
