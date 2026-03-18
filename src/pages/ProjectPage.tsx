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
import { Project } from "../../src-tauri/bindings/Project";

export async function ProjectPage() {
  const backendClient = useBackendClient();
  const [error, setError] = useState<string | null>(null);
  
  let project = await backendClient.getActiveProject();

  return (
    <MainLayout projectDir={project.id}>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {project?.name || "No project selected"}
          </p>
          <h1 className="text-3xl font-semibold">
            {project?.name || "Project overview"}
          </h1>
          <p className="text-muted-foreground">
            {project
              ? "Project details loaded from local database."
              : "Select or create a project to begin."}
          </p>
        </header>

        {project && (
          <Card>
            <CardHeader>
              <CardTitle>Project details</CardTitle>
              <CardDescription>Information stored in project.db</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && <p className="text-sm text-red-600">{error}</p>}
              {project && !error && (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoItem label="Project name" value={project.name} />
                  <InfoItem label="Project ID" value={project.id} />
                  {/* <InfoItem
                    label="Audit"
                    value={project.audit ?? "Not configured"}
                  /> */}
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
