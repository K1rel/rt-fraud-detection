import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
    children: React.ReactNode;
};

type State = {
    error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error) {
        console.error("[ui] error boundary caught:", error);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTitle>UI crashed</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <div className="text-sm">
                            Something threw an exception and the page was stopped to prevent a blank screen.
                        </div>
                        <div className="rounded-md border bg-background p-3 font-mono text-xs overflow-auto">
                            {this.state.error.message}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => window.location.reload()}
                                variant="default"
                            >
                                Reload
                            </Button>
                            <Button
                                onClick={() => this.setState({ error: null })}
                                variant="outline"
                            >
                                Try recover
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
}
