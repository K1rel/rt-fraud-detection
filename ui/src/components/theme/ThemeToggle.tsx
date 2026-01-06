import { useMemo } from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "light" | "dark" | "system";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const mode = (theme ?? "system") as Mode;

    const nextMode = useMemo<Mode>(() => {
        if (mode === "system") return "dark";
        if (mode === "dark") return "light";
        return "system";
    }, [mode]);

    const Icon = mode === "dark" ? MoonIcon : mode === "light" ? SunIcon : MonitorIcon;

    return (
        <Button
            variant="outline"
            size="icon"
            aria-label={`Theme: ${mode}. Switch to ${nextMode}`}
            title={`Theme: ${mode}. Switch to ${nextMode}`}
            onClick={() => setTheme(nextMode)}
        >
            <Icon />
        </Button>
    );
}
