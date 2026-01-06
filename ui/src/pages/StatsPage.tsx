import { StatsGrid } from "@/components/stats/StatsGrid";

export function StatsPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <div className="text-2xl font-semibold tracking-tight">Statistics</div>
                <div className="text-sm text-muted-foreground">
                    Auto-refresh every 10 seconds • Times shown in UTC
                </div>
            </div>

            <StatsGrid layout="wide" />
        </div>
    );
}
