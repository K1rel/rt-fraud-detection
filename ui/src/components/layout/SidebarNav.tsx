import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NavItem = {
    key: string;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
};

type Props = {
    items: NavItem[];
    activeKey: string;
    onNavigate: (key: string) => void;
    className?: string;
};

export function SidebarNav({ items, activeKey, onNavigate, className }: Props) {
    return (
        <aside className={cn("rounded-xl border bg-card/50 p-2", className)}>
            <div className="px-2 py-2 text-xs font-medium text-muted-foreground">
                Navigation
            </div>
            <div className="flex flex-col gap-1">
                {items.map((it) => {
                    const active = it.key === activeKey;
                    return (
                        <Button
                            key={it.key}
                            variant={active ? "secondary" : "ghost"}
                            className={cn(
                                "justify-start gap-2",
                                active ? "border border-border" : ""
                            )}
                            onClick={() => onNavigate(it.key)}
                            disabled={it.disabled}
                        >
                            {it.icon}
                            <span className="truncate">{it.label}</span>
                        </Button>
                    );
                })}
            </div>
        </aside>
    );
}
