/**
 * Info Settings Panel
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/core/backend/bindings";

interface InfoSettingsProps {
    projectDir?: string;
    project: ProjectSummary | null;
}

export function InfoSettings({ projectDir, project }: InfoSettingsProps) {
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
