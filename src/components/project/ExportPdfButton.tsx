import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanDetailRecord } from "@/core/backend/bindings";
import { exportScanPdf } from "@/utils/exportPdf";

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
    label = "Export PDF",
    className,
}: ExportPdfButtonProps) {
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const canExport =
        scanDetail !== null &&
        (scanDetail.status === "Completed" || scanDetail.status === "Failed");

    const handleClick = async () => {
        if (!scanDetail || !canExport) return;
        setBusy(true);
        setError(null);
        setFeedback(null);
        try {
            const path = await exportScanPdf({
                scanTitle,
                performedAt,
                detail: scanDetail,
                pluginNameById,
            });
            if (path) {
                setFeedback(`Saved: ${path}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
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
                {busy ? "Exporting..." : label}
            </Button>
            {feedback ? (
                <p className="mt-1 text-xs text-green-700">{feedback}</p>
            ) : null}
            {error ? (
                <p className="mt-1 text-xs text-red-600">{error}</p>
            ) : null}
        </div>
    );
}

