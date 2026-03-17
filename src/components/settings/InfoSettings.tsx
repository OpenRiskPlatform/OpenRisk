/**
 * Info Settings Panel
 */

import type { ProjectSummary } from "@/core/backend/types";

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
    return (
        <div className={`rounded-lg border bg-card p-3 ${full ? "sm:col-span-2" : ""}`}>
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-medium break-all">{value}</p>
        </div>
    );
}
