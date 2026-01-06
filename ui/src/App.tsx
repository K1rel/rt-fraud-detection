import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { NavItem } from "@/components/layout/SidebarNav";
import { LayoutDashboardIcon, BellIcon, SettingsIcon, BarChart3Icon } from "lucide-react";
import { DashboardPage } from "@/pages/DashboardPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useHealth } from "./hooks/useHealth";
import { StatsPage } from "./pages/StatsPage";

export default function App() {
    const [active, setActive] = useState<string>("dashboard");
    const health = useHealth({pollMs: 5000});

    const navItems = useMemo<NavItem[]>(
        () => [
            { key: "dashboard", label: "Dashboard", icon: <LayoutDashboardIcon className="size-4" /> },
            {key: "stats", label: "Stats", icon: <BarChart3Icon className="size-4" /> },
            { key: "alerts", label: "Alerts", icon: <BellIcon className="size-4" /> },
            { key: "settings", label: "Settings", icon: <SettingsIcon className="size-4" /> },
        ],
        []
    );

    return (
        <AppLayout
            title="RT Fraud Dashboard"
            health={health}
            navItems={navItems}
            activeNavKey={active}
            onNavigate={setActive}
        >
            {active === "dashboard" ? <DashboardPage health={health} /> : null}
            {active === "stats" ? <StatsPage/>: null}
            {active === "alerts" ? <AlertsPage /> : null}
            {active === "settings" ? <SettingsPage /> : null}
        </AppLayout>
    );
}
