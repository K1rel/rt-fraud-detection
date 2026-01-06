import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InfoIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Trend = {
    pct: number | null;
    label?: string;
};

type Props = {
    title: string;
    help?: string;
    icon: ReactNode;

    value: string;
    subvalue?: string;

    trend?: Trend;
    sparkline?: number[];

    rightVisual?: ReactNode;
    className?: string;
};

function Sparkline({ points, className }: { points: number[]; className?: string }) {
    const w = 160;
    const h = 36;

    if (!points.length) return <div className={cn("h-9 w-[160px]", className)} />;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(1e-9, max - min);

    const step = points.length <= 1 ? w : w / (points.length - 1);
    const d = points
        .map((v, i) => {
            const x = i * step;
            const y = h - ((v - min) / span) * h;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cn("text-muted-foreground", className)}>
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={d}
                opacity={0.9}
            />
        </svg>
    );
}

function formatTrend(pct: number | null | undefined) {
    if (pct == null) return null;

    if (pct === Infinity) return { text: "NEW", dir: 0 as const };

    if (pct === -Infinity) return null;

    if (!Number.isFinite(pct)) return null;

    const text =
        new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, signDisplay: "always" }).format(pct) + "%";

    const dir = pct > 0 ? 1 : pct < 0 ? -1 : 0;
    return { text, dir };
}


export function StatsCard({
                              title,
                              help,
                              icon,
                              value,
                              subvalue,
                              trend,
                              sparkline,
                              rightVisual,
                              className,
                          }: Props) {


    const trendFmt = formatTrend(trend?.pct);

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md border bg-muted/30 p-2">
                {icon}
              </span>
                            <span className="truncate">{title}</span>

                            {help ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button type="button" className="inline-flex items-center rounded-sm" aria-label="Help">
                                            <InfoIcon className="size-4 text-muted-foreground/80" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>{help}</TooltipContent>
                                </Tooltip>
                            ) : null}
                        </CardTitle>
                    </div>

                    {rightVisual ? <div className="shrink-0">{rightVisual}</div> : null}
                </div>
            </CardHeader>

            <CardContent>
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
                        {subvalue ? <div className="text-xs text-muted-foreground mt-1">{subvalue}</div> : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {trendFmt ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums cursor-default">
                                        {trendFmt.dir > 0 ? <TrendingUpIcon className="size-3.5" /> : trendFmt.dir < 0 ? <TrendingDownIcon className="size-3.5" /> : null}
                                        <span>{trendFmt.text}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>{trend?.label ?? ""}</TooltipContent>
                            </Tooltip>
                        ) : null}

                        <Sparkline points={sparkline ?? []} className="text-muted-foreground" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function StatsCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-8 w-10 rounded-md" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between gap-3">
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-9 w-[160px]" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
