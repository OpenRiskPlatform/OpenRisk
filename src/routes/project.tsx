import { createFileRoute } from "@tanstack/react-router";
import { ProjectPage } from "@/pages/ProjectPage";

export const Route = createFileRoute("/project")({
  validateSearch: (search: Record<string, unknown>) => ({
    dir: typeof search.dir === "string" ? search.dir : undefined,
  }),
  component: ProjectRoute,
});

function ProjectRoute() {
  const { dir } = Route.useSearch();
  return <ProjectPage projectDir={dir} />;
}
