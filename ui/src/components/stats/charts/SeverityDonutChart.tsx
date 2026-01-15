import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Item = { severity: string; count: number };

const ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const COLOR: Record<string, string> = {
    CRITICAL: "hsl(var(--destructive))",
    HIGH: "hsl(24 94% 50%)",
    MEDIUM: "hsl(45 93% 47%)",
    LOW: "hsl(var(--muted-foreground) / 0.55)",
};

function pct(n: number, total: number): string {
    if (!total) return "0%";
    return `${Math.round((n / total) * 100)}%`;
}

export function SeverityDonutChart({
                                       items,
                                       height,
                                       loading,
                                   }: {
    items: Item[];
    height: number;
    loading?: boolean;
}) {
    const data = useMemo(() => {
        const cleaned = (items ?? [])
            .map((x) => ({
                name: String(x.severity ?? "").toUpperCase(),
                value: Number(x.count ?? 0),
            }))
            .filter((x) => x.name && Number.isFinite(x.value) && x.value > 0)
            .sort((a, b) => {
                const ia = ORDER.indexOf(a.name as any);
                const ib = ORDER.indexOf(b.name as any);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });

        return cleaned;
    }, [items]);

    const total = useMemo(() => data.reduce((a, x) => a + x.value, 0), [data]);

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
                        formatter={(v: any, name: any) => {
                            const n = Number(v ?? 0);
                            return [`${n} (${pct(n, total)})`, String(name)];
                        }}
                        contentStyle={{ fontSize: 12 }}
                    />

                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="82%"
                        paddingAngle={2}
                        isAnimationActive={false}
                    >
                        {data.map((d) => (
                            <Cell key={d.name} fill={COLOR[d.name] ?? "hsl(var(--muted-foreground))"} />
                        ))}
                    </Pie>

                    <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="square"
                        formatter={(value: any) => {
                            const name = String(value);
                            const found = data.find((d) => d.name === name);
                            const v = found?.value ?? 0;
                            const p = total > 0 ? ` (${pct(v, total)})` : "";
                            return (
                                <span className="text-xs text-foreground">
                                    {name} — {v}{p}
                                  </span>
                            );
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
