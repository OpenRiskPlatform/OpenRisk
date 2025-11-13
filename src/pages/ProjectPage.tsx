import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBackendClient } from "@/hooks/useBackendClient";
import type { ProjectSummary } from "@/core/backend/types";

interface ProjectPageProps {
  projectDir?: string;
}

export function ProjectPage({ projectDir }: ProjectPageProps) {
  const backendClient = useBackendClient();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!projectDir) {
      setProject(null);
      return;
    }

    setLoading(true);
    setError(null);

    backendClient
      .openProject(projectDir)
      .then((summary) => {
        if (!cancelled) {
          setProject(summary);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setProject(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectDir, backendClient]);

  return (
    <MainLayout projectDir={projectDir}>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {projectDir || "No project selected"}
          </p>
          <h1 className="text-3xl font-semibold">
            {project?.name || "Project overview"}
          </h1>
          <p className="text-muted-foreground">
            {project
              ? "Project details loaded from local database."
              : projectDir
              ? "Loading project information..."
              : "Select or create a project to begin."}
          </p>
        </header>

        {!projectDir && (
          <Card>
            <CardHeader>
              <CardTitle>No project selected</CardTitle>
              <CardDescription>
                Use the entry page to create or open a project before visiting this screen.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {projectDir && (
          <Card>
            <CardHeader>
              <CardTitle>Project details</CardTitle>
              <CardDescription>Information stored in project.db</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && <p className="text-sm text-muted-foreground">Loading project…</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {project && !loading && !error && (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoItem label="Project name" value={project.name} />
                  <InfoItem label="Project ID" value={project.id} />
                  <InfoItem label="Directory" value={project.directory} />
                  <InfoItem
                    label="Audit"
                    value={project.audit ?? "Not configured"}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words mt-1">{value}</p>
    </div>
  );
}
