import {
  AlertTriangle,
  FilePenLine,
  LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanStatusIndicatorProps {
  status: string;
  hasFailures?: boolean;
  showLabel?: boolean;
  className?: string;
}

const presentations = {
  Completed: {
    icon: null,
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
  hasFailures = false,
  showLabel = true,
  className,
}: ScanStatusIndicatorProps) {
  const effectiveStatus = presentedScanStatus(status, hasFailures);

  if (!effectiveStatus) {
    return null;
  }

  const presentation =
    presentations[effectiveStatus as keyof typeof presentations] ??
    presentations.Failed;
  const Icon = presentation.icon;

  return (
    <span
      aria-label={showLabel ? undefined : effectiveStatus}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        presentation.className,
        className,
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            effectiveStatus === "Running" && "animate-spin",
          )}
        />
      ) : null}
      {showLabel ? effectiveStatus : null}
    </span>
  );
}

function presentedScanStatus(
  status: string,
  hasFailures: boolean,
): keyof typeof presentations | null {
  switch (status.toLowerCase()) {
    case "running":
      return "Running";
    case "draft":
      return "Draft";
    case "failed":
    case "error":
      return "Failed";
    case "completed":
    case "complete":
    case "success":
      return hasFailures ? "Failed" : null;
    default:
      return "Failed";
  }
}
