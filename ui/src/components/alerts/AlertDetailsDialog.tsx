
import type { AlertItem } from "@/types/alert_types";
import { AlertDetail } from "./AlertDetail";

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    alert: AlertItem | null;
    hasPrev?: boolean;
    hasNext?: boolean;
    onPrev?: () => void;
    onNext?: () => void;
};

export function AlertDetailsDialog(props: Props) {
    return <AlertDetail {...props} />;
}
