import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { LayoutDashboardIcon, BellIcon, SettingsIcon, BarChart3Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { Header } from "@/components/layout/Header";
import { SidebarNav, type NavItem } from "@/components/layout/SidebarNav";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {HealthState, useHealth } from "@/hooks/useHealth";

type Props = {
    children: ReactNode;
    title?: string;

    health: HealthState;

    navItems?: NavItem[];
    activeNavKey?: string;
    onNavigate?: (key: string) => void;

    className?: string;
};

export function AppLayout({
                              children,
                              title = "RT Fraud Dashboard",
                              health,
                              navItems,
                              activeNavKey,
                              onNavigate,
                              className,
                          }: Props) {
    const [online, setOnline] = useState<boolean>(() => navigator.onLine);

    useEffect(() => {
        const onUp = () => setOnline(true);
        const onDown = () => setOnline(false);
        window.addEventListener("online", onUp);
        window.addEventListener("offline", onDown);
        return () => {
            window.removeEventListener("online", onUp);
            window.removeEventListener("offline", onDown);
        };
    }, []);

    const items = useMemo<NavItem[]>(
        () =>
            navItems ?? [
                { key: "dashboard", label: "Dashboard", icon: <LayoutDashboardIcon className="size-4" /> },
                { key: "stats", label: "Stats", icon: <BarChart3Icon className="size-4" /> },
                { key: "alerts", label: "Alerts", icon: <BellIcon className="size-4" /> },
                { key: "settings", label: "Settings", icon: <SettingsIcon className="size-4" /> },
            ],
        [navItems]
    );

    const activeKey = activeNavKey ?? items[0]?.key ?? "dashboard";

    const mobileNav = onNavigate ? (
        <Tabs value={activeKey} onValueChange={(v) => onNavigate(v)}>
            <TabsList className="w-full">
                {items.map((it) => (
                    <TabsTrigger key={it.key} value={it.key} className="flex-1" disabled={it.disabled}>
                        {it.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    ) : null;

    return (
        <div className={cn("min-h-screen bg-background", className)}>
            <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
                <Header title={title} health={health} online={online} mobileNav={mobileNav} />

                <div className="container flex-1 py-6">
                    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
                        {onNavigate ? (
                            <SidebarNav
                                items={items}
                                activeKey={activeKey}
                                onNavigate={onNavigate}
                                className="hidden md:block"
                            />
                        ) : (
                            <div className="hidden md:block" />
                        )}

                        <main className="min-w-0">{children}</main>
                    </div>
                </div>

            </div>
        </div>
    );
}
