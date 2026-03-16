import { useCallback, useEffect, useState } from "react";
import type {
    AlertsFiltersState,
    EscalationStatus,
    ReviewStatus,
    Severity,
} from "@/types/alert_types";

export type AlertThresholdPresetKey =
    | "CUSTOM"
    | "HIGH_SENSITIVITY"
    | "BALANCED"
    | "CRITICAL_ONLY";

export type TimestampFormat = "LOCAL" | "UTC";
export type CardMaskMode = "LAST4" | "MASKED" | "FULL";
export type PageSizeOption = 25 | 50 | 100 | 200;

export type AppSettings = {
    workflowDefaults: {
        defaultReviewFilter: "ALL" | ReviewStatus;
        defaultEscalationFilter: "ALL" | EscalationStatus;
        defaultPageSize: PageSizeOption;
        autoOpenNewestAlert: boolean;
        confirmWorkflowActions: boolean;
    };
    realtime: {
        soundOnHighCritical: boolean;
        autoScrollLiveAlerts: boolean;
        liveModeOnInitialPageLoad: boolean;
        flashNewRows: boolean;
    };
    thresholdDefaults: {
        defaultPreset: AlertThresholdPresetKey;
    };
    display: {
        timestampFormat: TimestampFormat;
        cardMaskMode: CardMaskMode;
        compactTableRows: boolean;
        showRawIdsInTable: boolean;
    };
};

type SettingsPatch = Partial<{
    workflowDefaults: Partial<AppSettings["workflowDefaults"]>;
    realtime: Partial<AppSettings["realtime"]>;
    thresholdDefaults: Partial<AppSettings["thresholdDefaults"]>;
    display: Partial<AppSettings["display"]>;
}>;

type ThresholdPresetDef = {
    label: string;
    description: string;
    filters: Partial<AlertsFiltersState>;
};

const STORAGE_KEY = "rt-fraud-dashboard-settings";
const SETTINGS_EVENT = "app:settings-updated";

export const DEFAULT_APP_SETTINGS: AppSettings = {
    workflowDefaults: {
        defaultReviewFilter: "ALL",
        defaultEscalationFilter: "ALL",
        defaultPageSize: 50,
        autoOpenNewestAlert: false,
        confirmWorkflowActions: true,
    },
    realtime: {
        soundOnHighCritical: false,
        autoScrollLiveAlerts: true,
        liveModeOnInitialPageLoad: true,
        flashNewRows: true,
    },
    thresholdDefaults: {
        defaultPreset: "CUSTOM",
    },
    display: {
        timestampFormat: "LOCAL",
        cardMaskMode: "LAST4",
        compactTableRows: false,
        showRawIdsInTable: false,
    },
};

export const ALERT_THRESHOLD_PRESETS: Record<
    Exclude<AlertThresholdPresetKey, "CUSTOM">,
    ThresholdPresetDef
> = {
    HIGH_SENSITIVITY: {
        label: "High sensitivity",
        description:
            "Catches medium-plus risk earlier. Good for broad analyst triage.",
        filters: {
            scoreMin: 0.55,
            scoreMax: 1,
            severities: ["MEDIUM", "HIGH", "CRITICAL"] as Severity[],
            detectionMethod: "ALL",
            reviewStatus: "OPEN",
            escalationStatus: "ALL",
        },
    },
    BALANCED: {
        label: "Balanced",
        description:
            "Focus on stronger candidates without drowning the queue.",
        filters: {
            scoreMin: 0.75,
            scoreMax: 1,
            severities: ["HIGH", "CRITICAL"] as Severity[],
            detectionMethod: "ALL",
            reviewStatus: "OPEN",
            escalationStatus: "ALL",
        },
    },
    CRITICAL_ONLY: {
        label: "Critical only",
        description:
            "Highest urgency only. Best for demo mode or aggressive triage.",
        filters: {
            scoreMin: 0.9,
            scoreMax: 1,
            severities: ["CRITICAL"] as Severity[],
            detectionMethod: "ALL",
            reviewStatus: "OPEN",
            escalationStatus: "ALL",
        },
    },
};

function mergeSettings(base: AppSettings, patch: SettingsPatch): AppSettings {
    return {
        workflowDefaults: {
            ...base.workflowDefaults,
            ...(patch.workflowDefaults ?? {}),
        },
        realtime: {
            ...base.realtime,
            ...(patch.realtime ?? {}),
        },
        thresholdDefaults: {
            ...base.thresholdDefaults,
            ...(patch.thresholdDefaults ?? {}),
        },
        display: {
            ...base.display,
            ...(patch.display ?? {}),
        },
    };
}

function normalizeSettings(raw: unknown): AppSettings {
    const src = (raw ?? {}) as Partial<AppSettings>;

    return {
        workflowDefaults: {
            ...DEFAULT_APP_SETTINGS.workflowDefaults,
            ...(src.workflowDefaults ?? {}),
        },
        realtime: {
            ...DEFAULT_APP_SETTINGS.realtime,
            ...(src.realtime ?? {}),
        },
        thresholdDefaults: {
            ...DEFAULT_APP_SETTINGS.thresholdDefaults,
            ...(src.thresholdDefaults ?? {}),
        },
        display: {
            ...DEFAULT_APP_SETTINGS.display,
            ...(src.display ?? {}),
        },
    };
}

export function loadAppSettings(): AppSettings {
    if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_APP_SETTINGS;
        return normalizeSettings(JSON.parse(raw));
    } catch {
        return DEFAULT_APP_SETTINGS;
    }
}

function persistAppSettings(next: AppSettings) {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
        new CustomEvent(SETTINGS_EVENT, {
            detail: next,
        })
    );
}

export function createAlertsFiltersFromSettings(
    settings: AppSettings
): AlertsFiltersState {
    const preset =
        settings.thresholdDefaults.defaultPreset === "CUSTOM"
            ? null
            : ALERT_THRESHOLD_PRESETS[settings.thresholdDefaults.defaultPreset];

    const presetFilters = preset?.filters ?? {};

    return {
        scoreMin:
            typeof presetFilters.scoreMin === "number"
                ? presetFilters.scoreMin
                : 0,
        scoreMax:
            typeof presetFilters.scoreMax === "number"
                ? presetFilters.scoreMax
                : 1,
        severities: Array.isArray(presetFilters.severities)
            ? [...presetFilters.severities]
            : [],
        detectionMethod:
            typeof presetFilters.detectionMethod === "string"
                ? presetFilters.detectionMethod
                : "ALL",
        reviewStatus:
            settings.workflowDefaults.defaultReviewFilter !== "ALL"
                ? settings.workflowDefaults.defaultReviewFilter
                : (presetFilters.reviewStatus ?? "ALL"),
        escalationStatus:
            settings.workflowDefaults.defaultEscalationFilter !== "ALL"
                ? settings.workflowDefaults.defaultEscalationFilter
                : (presetFilters.escalationStatus ?? "ALL"),
        since: "",
        until: "",
    };
}

export function areAlertsFiltersEqual(
    a: AlertsFiltersState,
    b: AlertsFiltersState
): boolean {
    const sortList = (list: string[]) => [...list].sort().join("|");

    return (
        a.scoreMin === b.scoreMin &&
        a.scoreMax === b.scoreMax &&
        sortList(a.severities) === sortList(b.severities) &&
        a.detectionMethod === b.detectionMethod &&
        a.reviewStatus === b.reviewStatus &&
        a.escalationStatus === b.escalationStatus &&
        a.since === b.since &&
        a.until === b.until
    );
}

export function presetSummary(key: AlertThresholdPresetKey): string {
    if (key === "CUSTOM") return "No preset. Start from a fully open queue.";

    const preset = ALERT_THRESHOLD_PRESETS[key];
    const f = preset.filters;

    const severities = Array.isArray(f.severities) ? f.severities.join(", ") : "ALL";
    const review = f.reviewStatus ?? "ALL";
    const escalation = f.escalationStatus ?? "ALL";

    return `Score ${Number(f.scoreMin ?? 0).toFixed(2)}–${Number(
        f.scoreMax ?? 1
    ).toFixed(2)} • ${severities} • review ${review} • escalation ${escalation}`;
}

export function useAppSettings() {
    const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());

    useEffect(() => {
        if (typeof window === "undefined") return;

        const sync = () => {
            setSettings(loadAppSettings());
        };

        window.addEventListener("storage", sync);
        window.addEventListener(SETTINGS_EVENT, sync as EventListener);

        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener(SETTINGS_EVENT, sync as EventListener);
        };
    }, []);

    const updateSettings = useCallback(
        (patchOrUpdater: SettingsPatch | ((prev: AppSettings) => AppSettings)) => {
            setSettings((prev) => {
                const next =
                    typeof patchOrUpdater === "function"
                        ? normalizeSettings(patchOrUpdater(prev))
                        : normalizeSettings(mergeSettings(prev, patchOrUpdater));

                persistAppSettings(next);
                return next;
            });
        },
        []
    );

    const resetSettings = useCallback(() => {
        persistAppSettings(DEFAULT_APP_SETTINGS);
        setSettings(DEFAULT_APP_SETTINGS);
    }, []);

    return {
        settings,
        updateSettings,
        resetSettings,
    };
}