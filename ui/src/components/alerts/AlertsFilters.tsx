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
import {SEVERITIES, type AlertsFiltersState, type Severity } from "@/types/alert_types";
import { toIsoOrEmptyFromDatetimeLocal } from "@/lib/alerts";

type Props = {
    value: AlertsFiltersState;
    onChange: (next: AlertsFiltersState) => void;
    knownDetectionMethods?: string[];
};

function toggleSeverity(list: Severity[], sev: Severity): Severity[] {
    if (list.includes(sev)) return list.filter((s) => s !== sev);
    return [...list, sev];
}

export function AlertsFilters({ value, onChange, knownDetectionMethods }: Props) {
    const methods = useMemo(() => {
        const base = (knownDetectionMethods ?? ["ML", "RULES", "ML_AND_RULES"]).map((m) => m.toUpperCase());
        return Array.from(new Set(base)).sort();
    }, [knownDetectionMethods]);

    return (
        <div className="rounded-xl border bg-card/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">Filters</div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() =>
                            onChange({
                                scoreMin: 0,
                                scoreMax: 1,
                                severities: [],
                                detectionMethod: "ALL",
                                since: "",
                                until: "",
                            })
                        }
                    >
                        Reset
                    </Button>
                </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {/* Score range */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Score range</div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">{value.scoreMin.toFixed(2)}</Badge>
                        <div className="flex-1 space-y-2">
                            <input
                                className="w-full"
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={value.scoreMin}
                                onChange={(e) => {
                                    const n = Number(e.target.value);
                                    onChange({ ...value, scoreMin: Math.min(n, value.scoreMax) });
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
                                    onChange({ ...value, scoreMax: Math.max(n, value.scoreMin) });
                                }}
                            />
                        </div>
                        <Badge variant="outline">{value.scoreMax.toFixed(2)}</Badge>
                    </div>
                </div>

                {/* Severities multi-select */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Severity</div>
                    <div className="flex flex-wrap gap-2">
                        {SEVERITIES.map((sev) => {
                            const active = value.severities.includes(sev);
                            return (
                                <Button
                                    key={sev}
                                    size="sm"
                                    variant={active ? "default" : "outline"}
                                    onClick={() => onChange({ ...value, severities: toggleSeverity(value.severities, sev) })}
                                >
                                    {sev}
                                </Button>
                            );
                        })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {value.severities.length ? `${value.severities.length} selected` : "All severities"}
                    </div>
                </div>

                {/* Detection method */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Detection method</div>
                    <Select
                        value={value.detectionMethod}
                        onValueChange={(v) => onChange({ ...value, detectionMethod: v })}
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
                </div>

                {/* Time range */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Time range</div>
                    <div className="grid gap-2">
                        <div className="grid gap-1">
                            <div className="text-[11px] text-muted-foreground">Since</div>
                            <Input
                                type="datetime-local"
                                value={value.since ? value.since.slice(0, 16) : ""}
                                onChange={(e) => onChange({ ...value, since: toIsoOrEmptyFromDatetimeLocal(e.target.value) })}
                            />
                        </div>
                        <div className="grid gap-1">
                            <div className="text-[11px] text-muted-foreground">Until</div>
                            <Input
                                type="datetime-local"
                                value={value.until ? value.until.slice(0, 16) : ""}
                                onChange={(e) => onChange({ ...value, until: toIsoOrEmptyFromDatetimeLocal(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
