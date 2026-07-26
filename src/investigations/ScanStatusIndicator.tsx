import {
  AlertTriangle,
  CheckCircle2,
  FilePenLine,
  LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanStatusIndicatorProps {
  status: string;
  showLabel?: boolean;
  className?: string;
}

const presentations = {
  Completed: {
    icon: CheckCircle2,
    className: "text-emerald-700 dark:text-emerald-300",
  },
  Running: {
    icon: LoaderCircle,
    className: "text-blue-700 dark:text-blue-300",
  },
  Draft: {
    icon: FilePenLine,
    className: "text-muted-foreground",
  },
  Failed: {
    icon: AlertTriangle,
    className: "text-destructive",
  },
};

export function ScanStatusIndicator({
  status,
  showLabel = true,
  className,
}: ScanStatusIndicatorProps) {
  const presentation =
    presentations[status as keyof typeof presentations] ??
    presentations.Failed;
  const Icon = presentation.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        presentation.className,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("h-4 w-4", status === "Running" && "animate-spin")}
      />
      {showLabel ? status : null}
    </span>
  );
}
