import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {HealthState } from "@/hooks/useHealth";
import { AlertsTable } from "@/components/alerts/AlertsTable";

export function DashboardPage({health} : {health: HealthState}) {

    return (
        <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-muted-foreground">API Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {health.loading ? (
                            <>
                                <Skeleton className="h-7 w-32" />
                                <Skeleton className="h-4 w-52" />
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <Badge variant={health.data?.status === "ok" ? "default" : "destructive"}>
                                        {health.data?.status === "ok" ? "OK" : "DOWN"}
                                    </Badge>
                                    <Badge variant={health.data?.es === "up" ? "secondary" : "outline"}>
                                        ES: {health.data?.es ?? "?"}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    last health:{" "}
                                    <span className="font-mono">{health.data?.timestamp ?? "—"}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Operational Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert>
                            <AlertTitle>Local-only</AlertTitle>
                            <AlertDescription>
                                Configure <code>VITE_API_BASE_URL</code> (see <code>.env.example</code>). Current health:{" "}
                                <code>{health.data?.status ?? (health.loading ? "loading" : "unknown")}</code>
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>

            <AlertsTable />
        </div>
    );
}
