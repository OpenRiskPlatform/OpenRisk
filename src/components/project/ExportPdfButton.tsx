import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanDetailRecord } from "@/core/backend/bindings";
import { exportScanPdf } from "@/utils/exportPdf";
import { toast } from "sonner";
import { openPath } from "@tauri-apps/plugin-opener";

interface ExportPdfButtonProps {
    scanDetail: ScanDetailRecord | null;
    scanTitle: string;
    performedAt: string;
    pluginNameById: Record<string, string>;
    variant?: "default" | "outline" | "secondary" | "ghost";
    size?: "sm" | "default" | "lg";
    label?: string;
    className?: string;
}

export function ExportPdfButton({
    scanDetail,
    scanTitle,
    performedAt,
    pluginNameById,
    variant = "outline",
    size = "sm",
    label = "Save PDF",
    className,
}: ExportPdfButtonProps) {
    const [busy, setBusy] = useState(false);

    const canExport =
        scanDetail !== null &&
        (scanDetail.status === "Completed" || scanDetail.status === "Failed");

    const handleClick = async () => {
        if (!scanDetail || !canExport) return;
        setBusy(true);
        try {
            const savedPath = await exportScanPdf({
                scanTitle,
                performedAt,
                detail: scanDetail,
                pluginNameById,
            });
            if (savedPath) {
                toast.success("PDF saved", {
                    description: savedPath,
                    action: {
                        label: "Open file",
                        onClick: () => void openPath(savedPath),
                    },
                });
            }
        } catch (err) {
            toast.error("Failed to save PDF", {
                description: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={className}>
            <Button
                type="button"
                variant={variant}
                size={size}
                onClick={() => void handleClick()}
                disabled={!canExport || busy}
            >
                {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                )}
                {busy ? "Saving..." : label}
            </Button>
        </div>
    );
}
