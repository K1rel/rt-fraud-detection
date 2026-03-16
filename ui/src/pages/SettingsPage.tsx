import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ALERT_THRESHOLD_PRESETS,
    presetSummary,
    useAppSettings,
    type AlertThresholdPresetKey,
    type CardMaskMode,
    type PageSizeOption,
    type TimestampFormat,
} from "@/lib/settings";
import type { EscalationStatus, ReviewStatus } from "@/types/alert_types";

function BoolButtons({
                         value,
                         onChange,
                     }: {
    value: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <Button
                size="sm"
                variant={value ? "secondary" : "outline"}
                onClick={() => onChange(true)}
            >
                On
            </Button>
            <Button
                size="sm"
                variant={!value ? "secondary" : "outline"}
                onClick={() => onChange(false)}
            >
                Off
            </Button>
        </div>
    );
}

function SettingBlock({
                          title,
                          hint,
                          children,
                      }: {
    title: string;
    hint: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <div className="mb-1 text-sm font-medium">{title}</div>
            <div className="mb-3 text-xs text-muted-foreground">{hint}</div>
            {children}
        </div>
    );
}

export function SettingsPage() {
    const { settings, updateSettings, resetSettings } = useAppSettings();

    const presetKey = settings.thresholdDefaults.defaultPreset;
    const presetMeta =
        presetKey === "CUSTOM" ? null : ALERT_THRESHOLD_PRESETS[presetKey];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                        <CardTitle>Settings</CardTitle>
                        <div className="mt-1 text-sm text-muted-foreground">
                            Investigation defaults and local operator preferences.
                        </div>
                    </div>

                    <Badge variant="outline">Saved locally in this browser</Badge>
                </CardHeader>

                <CardContent className="space-y-4">
                    <Alert>
                        <AlertTitle>Local preferences only</AlertTitle>
                        <AlertDescription>
                            Theme stays in the header. These settings control alert
                            workflow, realtime behavior, presets, and table display.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Alert workflow defaults</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-2">
                    <SettingBlock
                        title="Default review filter"
                        hint="Used when the alerts queue loads."
                    >
                        <Select
                            value={settings.workflowDefaults.defaultReviewFilter}
                            onValueChange={(value) =>
                                updateSettings({
                                    workflowDefaults: {
                                        defaultReviewFilter: value as "ALL" | ReviewStatus,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
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
                    </SettingBlock>

                    <SettingBlock
                        title="Default escalation filter"
                        hint="Start with the full queue or only escalated work."
                    >
                        <Select
                            value={settings.workflowDefaults.defaultEscalationFilter}
                            onValueChange={(value) =>
                                updateSettings({
                                    workflowDefaults: {
                                        defaultEscalationFilter:
                                            value as "ALL" | EscalationStatus,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">ALL</SelectItem>
                                <SelectItem value="NONE">NONE</SelectItem>
                                <SelectItem value="ESCALATED">ESCALATED</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingBlock>

                    <SettingBlock
                        title="Default page size"
                        hint="How many rows to load in the alerts queue."
                    >
                        <Select
                            value={String(settings.workflowDefaults.defaultPageSize)}
                            onValueChange={(value) =>
                                updateSettings({
                                    workflowDefaults: {
                                        defaultPageSize: Number(value) as PageSizeOption,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="200">200</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingBlock>

                    <SettingBlock
                        title="Auto-open newest alert"
                        hint="When live mode receives a new alert, open its details dialog."
                    >
                        <BoolButtons
                            value={settings.workflowDefaults.autoOpenNewestAlert}
                            onChange={(next) =>
                                updateSettings({
                                    workflowDefaults: {
                                        autoOpenNewestAlert: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>

                    <SettingBlock
                        title="Confirm before false positive / closed / escalated"
                        hint="Safer for demos and analyst review flows."
                    >
                        <BoolButtons
                            value={settings.workflowDefaults.confirmWorkflowActions}
                            onChange={(next) =>
                                updateSettings({
                                    workflowDefaults: {
                                        confirmWorkflowActions: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Realtime behavior</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-2">
                    <SettingBlock
                        title="Sound on HIGH / CRITICAL"
                        hint="Persist the alert beep preference."
                    >
                        <BoolButtons
                            value={settings.realtime.soundOnHighCritical}
                            onChange={(next) =>
                                updateSettings({
                                    realtime: {
                                        soundOnHighCritical: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>

                    <SettingBlock
                        title="Auto-scroll live alerts"
                        hint="Jump to the newest row as alerts arrive."
                    >
                        <BoolButtons
                            value={settings.realtime.autoScrollLiveAlerts}
                            onChange={(next) =>
                                updateSettings({
                                    realtime: {
                                        autoScrollLiveAlerts: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>

                    <SettingBlock
                        title="Live mode on initial page load"
                        hint="Start the alerts page in live mode by default."
                    >
                        <BoolButtons
                            value={settings.realtime.liveModeOnInitialPageLoad}
                            onChange={(next) =>
                                updateSettings({
                                    realtime: {
                                        liveModeOnInitialPageLoad: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>

                    <SettingBlock
                        title="Flash new rows animation"
                        hint="Highlight new incoming alerts in the queue."
                    >
                        <BoolButtons
                            value={settings.realtime.flashNewRows}
                            onChange={(next) =>
                                updateSettings({
                                    realtime: {
                                        flashNewRows: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Threshold presets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={presetKey === "CUSTOM" ? "secondary" : "outline"}
                            onClick={() =>
                                updateSettings({
                                    thresholdDefaults: { defaultPreset: "CUSTOM" },
                                })
                            }
                        >
                            Custom
                        </Button>

                        {(
                            [
                                "HIGH_SENSITIVITY",
                                "BALANCED",
                                "CRITICAL_ONLY",
                            ] as const
                        ).map((key) => (
                            <Button
                                key={key}
                                variant={presetKey === key ? "secondary" : "outline"}
                                onClick={() =>
                                    updateSettings({
                                        thresholdDefaults: {
                                            defaultPreset: key as AlertThresholdPresetKey,
                                        },
                                    })
                                }
                            >
                                {ALERT_THRESHOLD_PRESETS[key].label}
                            </Button>
                        ))}
                    </div>

                    <div className="rounded-xl border bg-background p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="text-sm font-medium">Default preset</div>
                            <Badge variant="outline">
                                {presetKey === "CUSTOM"
                                    ? "Custom"
                                    : ALERT_THRESHOLD_PRESETS[presetKey].label}
                            </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground">
                            {presetKey === "CUSTOM"
                                ? "No preset is forcing the queue shape. Workflow defaults still apply."
                                : presetMeta?.description}
                        </div>

                        <div className="mt-3 text-xs text-muted-foreground">
                            {presetSummary(presetKey)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Data display preferences</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-2">
                    <SettingBlock
                        title="Timestamp format"
                        hint="Affects the alerts table, details, and timeline."
                    >
                        <Select
                            value={settings.display.timestampFormat}
                            onValueChange={(value) =>
                                updateSettings({
                                    display: {
                                        timestampFormat: value as TimestampFormat,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LOCAL">LOCAL</SelectItem>
                                <SelectItem value="UTC">UTC</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingBlock>

                    <SettingBlock
                        title="Card masking mode"
                        hint="Useful for demo mode versus operator mode."
                    >
                        <Select
                            value={settings.display.cardMaskMode}
                            onValueChange={(value) =>
                                updateSettings({
                                    display: {
                                        cardMaskMode: value as CardMaskMode,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LAST4">LAST4</SelectItem>
                                <SelectItem value="MASKED">MASKED</SelectItem>
                                <SelectItem value="FULL">FULL (demo only)</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingBlock>

                    <SettingBlock
                        title="Compact table rows"
                        hint="Tighter density for larger review sessions."
                    >
                        <BoolButtons
                            value={settings.display.compactTableRows}
                            onChange={(next) =>
                                updateSettings({
                                    display: {
                                        compactTableRows: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>

                    <SettingBlock
                        title="Show raw IDs in table"
                        hint="Alert IDs stop truncating in the queue."
                    >
                        <BoolButtons
                            value={settings.display.showRawIdsInTable}
                            onChange={(next) =>
                                updateSettings({
                                    display: {
                                        showRawIdsInTable: next,
                                    },
                                })
                            }
                        />
                    </SettingBlock>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button variant="outline" onClick={resetSettings}>
                    Reset all local preferences
                </Button>
            </div>
        </div>
    );
}