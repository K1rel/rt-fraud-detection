import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    SEVERITIES,
    type AlertsFiltersState,
    type Severity,
} from "@/types/alert_types";
import { toIsoOrEmptyFromDatetimeLocal } from "@/lib/alerts";

type Props = {
    value: AlertsFiltersState;
    onChange: (next: AlertsFiltersState) => void;
    knownDetectionMethods?: string[];
    compact?: boolean;
};

function toggleSeverity(list: Severity[], sev: Severity): Severity[] {
    if (list.includes(sev)) return list.filter((s) => s !== sev);
    return [...list, sev];
}

function createResetFilters(): AlertsFiltersState {
    return {
        scoreMin: 0,
        scoreMax: 1,
        severities: [],
        detectionMethod: "ALL",
        reviewStatus: "ALL",
        escalationStatus: "ALL",
        since: "",
        until: "",
    };
}

export function AlertsFilters({
                                  value,
                                  onChange,
                                  knownDetectionMethods,
                                  compact = false,
                              }: Props) {
    const methods = useMemo(() => {
        const base = (
            knownDetectionMethods ?? ["ML", "RULES", "ML_AND_RULES"]
        ).map((m) => m.toUpperCase());

        return Array.from(new Set(base)).sort();
    }, [knownDetectionMethods]);

    const activeCount =
        (value.scoreMin > 0 ? 1 : 0) +
        (value.scoreMax < 1 ? 1 : 0) +
        (value.severities.length ? 1 : 0) +
        (value.detectionMethod !== "ALL" ? 1 : 0) +
        (value.reviewStatus !== "ALL" ? 1 : 0) +
        (value.escalationStatus !== "ALL" ? 1 : 0) +
        (value.since ? 1 : 0) +
        (value.until ? 1 : 0);

    const resetFilters = () => onChange(createResetFilters());

    if (compact) {
        return (
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Filters
                        </div>
                        {activeCount > 0 ? (
                            <Badge
                                variant="secondary"
                                className="h-5 rounded-md px-1.5 text-[10px]"
                            >
                                {activeCount} active
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="h-5 rounded-md px-1.5 text-[10px]"
                            >
                                none
                            </Badge>
                        )}
                    </div>

                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={resetFilters}
                    >
                        Reset
                    </Button>
                </div>

                <div className="overflow-x-auto pb-1">
                    <div className="grid min-w-[1080px] gap-2 xl:grid-cols-[180px_210px_140px_150px_150px_250px]">
                        <div className="rounded-md border bg-background px-2.5 py-2">
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Score
                            </div>

                            <div className="mb-1 flex items-center justify-between">
                                <Badge
                                    variant="outline"
                                    className="h-5 rounded-md px-1.5 text-[10px]"
                                >
                                    {value.scoreMin.toFixed(2)}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="h-5 rounded-md px-1.5 text-[10px]"
                                >
                                    {value.scoreMax.toFixed(2)}
                                </Badge>
                            </div>

                            <div className="space-y-1">
                                <input
                                    className="h-4 w-full"
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={value.scoreMin}
                                    onChange={(e) => {
                                        const n = Number(e.target.value);
                                        onChange({
                                            ...value,
                                            scoreMin: Math.min(n, value.scoreMax),
                                        });
                                    }}
                                />
                                <input
                                    className="h-4 w-full"
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={value.scoreMax}
                                    onChange={(e) => {
                                        const n = Number(e.target.value);
                                        onChange({
                                            ...value,
                                            scoreMax: Math.max(n, value.scoreMin),
                                        });
                                    }}
                                />
                            </div>
                        </div>

                        <div className="rounded-md border bg-background px-2.5 py-2">
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Severity
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                                {SEVERITIES.map((sev) => {
                                    const active = value.severities.includes(sev);

                                    return (
                                        <Button
                                            key={sev}
                                            size="sm"
                                            variant={active ? "secondary" : "outline"}
                                            className="h-7 px-2 text-[11px]"
                                            onClick={() =>
                                                onChange({
                                                    ...value,
                                                    severities: toggleSeverity(
                                                        value.severities,
                                                        sev
                                                    ),
                                                })
                                            }
                                        >
                                            {sev}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-md border bg-background px-2.5 py-2">
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Method
                            </div>

                            <Select
                                value={value.detectionMethod}
                                onValueChange={(v) =>
                                    onChange({ ...value, detectionMethod: v })
                                }
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="ALL" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">ALL</SelectItem>
                                    {methods.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-md border bg-background px-2.5 py-2">
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Review
                            </div>

                            <Select
                                value={value.reviewStatus}
                                onValueChange={(v) =>
                                    onChange({
                                        ...value,
                                        reviewStatus:
                                            v as AlertsFiltersState["reviewStatus"],
                                    })
                                }
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="ALL" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">ALL</SelectItem>
                                    <SelectItem value="OPEN">OPEN</SelectItem>
                                    <SelectItem value="FALSE_POSITIVE">
                                        FALSE_POSITIVE
                                    </SelectItem>
                                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-md border bg-background px-2.5 py-2">
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Escalation
                            </div>

                            <Select
                                value={value.escalationStatus}
                                onValueChange={(v) =>
                                    onChange({
                                        ...value,
                                        escalationStatus:
                                            v as AlertsFiltersState["escalationStatus"],
                                    })
                                }
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="ALL" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">ALL</SelectItem>
                                    <SelectItem value="NONE">NONE</SelectItem>
                                    <SelectItem value="ESCALATED">
                                        ESCALATED
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-md border bg-background px-2.5 py-2">
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Time window
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-muted-foreground">
                                        Since
                                    </div>
                                    <Input
                                        className="h-8 text-xs"
                                        type="datetime-local"
                                        value={value.since ? value.since.slice(0, 16) : ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...value,
                                                since: toIsoOrEmptyFromDatetimeLocal(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="text-[10px] text-muted-foreground">
                                        Until
                                    </div>
                                    <Input
                                        className="h-8 text-xs"
                                        type="datetime-local"
                                        value={value.until ? value.until.slice(0, 16) : ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...value,
                                                until: toIsoOrEmptyFromDatetimeLocal(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold">Filters</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        Narrow the queue by score, severity, method, review state,
                        escalation, and time.
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {activeCount > 0 ? (
                        <Badge variant="secondary">{activeCount} active</Badge>
                    ) : (
                        <Badge variant="outline">No active filters</Badge>
                    )}

                    <Button size="sm" variant="outline" onClick={resetFilters}>
                        Reset all
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.9fr_1.2fr]">
                <div className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Score range
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Badge variant="outline">{value.scoreMin.toFixed(2)}</Badge>
                            <Badge variant="outline">{value.scoreMax.toFixed(2)}</Badge>
                        </div>

                        <div className="space-y-2">
                            <input
                                className="w-full"
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={value.scoreMin}
                                onChange={(e) => {
                                    const n = Number(e.target.value);
                                    onChange({
                                        ...value,
                                        scoreMin: Math.min(n, value.scoreMax),
                                    });
                                }}
                            />

                            <input
                                className="w-full"
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={value.scoreMax}
                                onChange={(e) => {
                                    const n = Number(e.target.value);
                                    onChange({
                                        ...value,
                                        scoreMax: Math.max(n, value.scoreMin),
                                    });
                                }}
                            />
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Show alerts whose fraud score stays inside the selected band.
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Severity
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {SEVERITIES.map((sev) => {
                            const active = value.severities.includes(sev);

                            return (
                                <Button
                                    key={sev}
                                    size="sm"
                                    variant={active ? "secondary" : "outline"}
                                    onClick={() =>
                                        onChange({
                                            ...value,
                                            severities: toggleSeverity(
                                                value.severities,
                                                sev
                                            ),
                                        })
                                    }
                                >
                                    {sev}
                                </Button>
                            );
                        })}
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                        {value.severities.length
                            ? `${value.severities.length} selected`
                            : "All severities"}
                    </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Detection method
                    </div>

                    <Select
                        value={value.detectionMethod}
                        onValueChange={(v) =>
                            onChange({ ...value, detectionMethod: v })
                        }
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="ALL" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">ALL</SelectItem>
                            {methods.map((m) => (
                                <SelectItem key={m} value={m}>
                                    {m}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="mt-3 text-xs text-muted-foreground">
                        Limit results to a specific detection source.
                    </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Review status
                    </div>

                    <Select
                        value={value.reviewStatus}
                        onValueChange={(v) =>
                            onChange({
                                ...value,
                                reviewStatus: v as AlertsFiltersState["reviewStatus"],
                            })
                        }
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="ALL" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">ALL</SelectItem>
                            <SelectItem value="OPEN">OPEN</SelectItem>
                            <SelectItem value="FALSE_POSITIVE">
                                FALSE_POSITIVE
                            </SelectItem>
                            <SelectItem value="CLOSED">CLOSED</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="mt-3 text-xs text-muted-foreground">
                        Filter analyst-reviewed false positives and closed alerts
                        separately from open alerts.
                    </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Escalation
                    </div>

                    <Select
                        value={value.escalationStatus}
                        onValueChange={(v) =>
                            onChange({
                                ...value,
                                escalationStatus:
                                    v as AlertsFiltersState["escalationStatus"],
                            })
                        }
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="ALL" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">ALL</SelectItem>
                            <SelectItem value="NONE">NONE</SelectItem>
                            <SelectItem value="ESCALATED">ESCALATED</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="mt-3 text-xs text-muted-foreground">
                        Separate escalated alerts from the normal queue.
                    </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Time window
                    </div>

                    <div className="grid gap-3">
                        <div className="grid gap-1.5">
                            <div className="text-xs text-muted-foreground">Since</div>
                            <Input
                                type="datetime-local"
                                value={value.since ? value.since.slice(0, 16) : ""}
                                onChange={(e) =>
                                    onChange({
                                        ...value,
                                        since: toIsoOrEmptyFromDatetimeLocal(
                                            e.target.value
                                        ),
                                    })
                                }
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <div className="text-xs text-muted-foreground">Until</div>
                            <Input
                                type="datetime-local"
                                value={value.until ? value.until.slice(0, 16) : ""}
                                onChange={(e) =>
                                    onChange({
                                        ...value,
                                        until: toIsoOrEmptyFromDatetimeLocal(
                                            e.target.value
                                        ),
                                    })
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}