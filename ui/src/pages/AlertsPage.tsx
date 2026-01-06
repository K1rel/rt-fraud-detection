import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AlertsPage() {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Alert>
                        <AlertTitle>Placeholder</AlertTitle>
                        <AlertDescription>
                            This is the navigation target to prove layout + nav works. Real alerts wiring stays in later tickets.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
