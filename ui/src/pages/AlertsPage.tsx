import { AlertsTable } from "@/components/alerts/AlertsTable";

export function AlertsPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <div className="text-2xl font-semibold tracking-tight">Alerts</div>
                <div className="text-sm text-muted-foreground">
                    Investigation workbench for live and historical fraud alerts
                </div>
            </div>

            <AlertsTable />
        </div>
    );
}