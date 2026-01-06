import { ActivityIcon, ShieldCheckIcon, WifiOffIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { HealthState } from "@/hooks/useHealth";

type Props = {
    title: string;
    health: HealthState;
    online: boolean;
    mobileNav?: React.ReactNode;
};

export function Header({ title, health, online, mobileNav }: Props) {
    const apiOk = online && health.data?.status === "ok";
    const esOk = apiOk && health.data?.es === "up";

    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="grid size-9 place-items-center rounded-lg border bg-muted/30">
                            <ShieldCheckIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate font-semibold tracking-tight">{title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                                local-only • fraud monitoring
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-2">
                    {health.loading ? (
                        <>
                            <Skeleton className="h-6 w-20" />
                            <Skeleton className="h-6 w-20" />
                        </>
                    ) : (
                        <>
                            <Badge variant={apiOk ? "default" : "destructive"}>
                                {apiOk ? "API OK" : "API DOWN"}
                            </Badge>
                            <Badge variant={esOk ? "secondary" : "outline"}>
                                {esOk ? "ES UP" : "ES ?"}
                            </Badge>
                        </>
                    )}

                    <div className="ml-2 flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full border px-3 py-1">
              <span className="relative flex size-2">
                <span
                    className={[
                        "absolute inline-flex h-full w-full rounded-full opacity-75",
                        apiOk ? "animate-ping bg-foreground/50" : "",
                    ].join(" ")}
                />
                <span
                    className={[
                        "relative inline-flex h-2 w-2 rounded-full",
                        apiOk ? "bg-foreground" : "bg-muted-foreground",
                    ].join(" ")}
                />
              </span>
                            <span className="text-xs font-medium">
                {online ? (apiOk ? "Live" : "Degraded") : "Offline"}
              </span>
                            {!online ? <WifiOffIcon className="size-4 text-muted-foreground" /> : <ActivityIcon className="size-4 text-muted-foreground" />}
                        </div>

                        <ThemeToggle />
                    </div>
                </div>

                {/* mobile  */}
                <div className="md:hidden flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>

            {/* mobile */}
            {mobileNav ? (
                <div className="border-t bg-background/60">
                    <div className="container py-2">{mobileNav}</div>
                </div>
            ) : null}
        </header>
    );
}
