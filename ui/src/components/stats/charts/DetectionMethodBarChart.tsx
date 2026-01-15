import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type Item = { method: string; count: number };

const LABEL: Record<string, string> = {
    ML: "ML",
    RULES: "RULES",
    ML_AND_RULES: "ML + RULES",
};

function normalizeKey(s: unknown): string {
    return String(s ?? "").trim().toUpperCase();
}

function MethodTick(props: any) {
    const { x, y, payload } = props;
    const v = String(payload?.value ?? "");
    const isBoth = v.includes("+");
    const dx = isBoth ? 8 : 0;

    return (
        <g transform={`translate(${x + dx},${y})`}>
            <text
                x={0}
                y={0}
                dy={16}
                textAnchor="end"
                transform="rotate(-18)"
                className="fill-muted-foreground"
                fontSize={12}
            >
                {v}
            </text>
        </g>
    );
}


export function DetectionMethodBarChart({
                                            items,
                                            height,
                                            loading,
                                        }: {
    items: any[];
    height: number;
    loading?: boolean;
}) {
    const data = useMemo(() => {
        const cleaned = (items ?? [])
            .map((x) => {
                const raw = x.method ?? x.detectionMethod;
                const key = normalizeKey(raw);
                return {
                    key,
                    name: LABEL[key] ?? key.replaceAll("_", " "),
                    value: Number(x.count ?? 0),
                };
            })
            .filter((x) => x.key && Number.isFinite(x.value) && x.value >= 0);

        // stable order
        const order = ["RULES", "ML", "ML_AND_RULES"];
        cleaned.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
        return cleaned;
    }, [items]);

    if (loading && !data.length) {
        return <div className="h-[260px] animate-pulse rounded-lg bg-muted/40" />;
    }
    if (!data.length) {
        return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">No data</div>;
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{ top: 8, right: 12, left: 12, bottom: 28 }}
                    barCategoryGap={24}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="name"
                        interval={0}
                        height={44}
                        tickMargin={8}
                        tick={<MethodTick />}
                    />
                    <YAxis allowDecimals={false} width={40} />
                    <Tooltip
                        formatter={(v: any) => [Number(v ?? 0), "count"]}
                        contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
