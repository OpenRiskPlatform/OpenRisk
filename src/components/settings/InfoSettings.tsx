/**
 * Info Settings Panel
 */

import { useState } from "react";
import { Check, Copy, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/core/backend/bindings";

interface InfoSettingsProps {
    projectDir?: string;
    project: ProjectSummary | null;
    isPreview?: boolean;
    exportingPreview?: boolean;
    exportPreviewError?: string | null;
    onExportAsPreview?: () => void;
}

export function InfoSettings({ projectDir, project, isPreview, exportingPreview, exportPreviewError, onExportAsPreview }: InfoSettingsProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold mb-1">Info</h2>
                <p className="text-sm text-muted-foreground">
                    Project metadata and storage details.
                </p>
            </div>

            {!projectDir && (
                <p className="text-sm text-muted-foreground">
                    Open or create a project to view project information.
                </p>
            )}

            {projectDir && !project && (
                <p className="text-sm text-muted-foreground">Loading project info...</p>
            )}

            {projectDir && project && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem label="Project Name" value={project.name} />
                    <InfoItem label="Project ID" value={project.id} />
                    <InfoItem label="Directory" value={project.directory} full />
                    <InfoItem label="Audit" value={project.audit ?? "Not configured"} />
                </div>
            )}

            {projectDir && !isPreview && (
                <div className="space-y-2">
                    <h3 className="text-base font-medium">Export as Preview</h3>
                    <p className="text-sm text-muted-foreground">
                        Creates a copy of this project that can be shared safely. The recipient
                        can run all plugins but cannot view or change any credentials or settings.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onExportAsPreview}
                        disabled={exportingPreview}
                    >
                        {exportingPreview
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <Eye className="mr-2 h-4 w-4" />}
                        Export as Preview
                    </Button>
                    {exportPreviewError && (
                        <p className="text-sm text-destructive">{exportPreviewError}</p>
                    )}
                </div>
            )}
        </div>
    );
}

function InfoItem({
    label,
    value,
    full,
}: {
    label: string;
    value: string;
    full?: boolean;
}) {
    const [copied, setCopied] = useState(false);

    const copyValue = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className={`rounded-lg bg-card p-1 ${full ? "sm:col-span-2" : ""}`}>
            <div className="flex items-center gap-1">
                <p className="text-xs uppercase text-muted-foreground">{label}</p>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyValue}
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    title={copied ? "Copied" : "Copy value"}
                    aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
                >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
            </div>
            <p className="mt-1 text-sm font-medium break-all">{value}</p>
        </div>
    );
}
