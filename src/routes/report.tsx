import { createFileRoute } from "@tanstack/react-router";
import { ReportPage } from "@/pages/ReportPage";

export const Route = createFileRoute("/report")({
  validateSearch: (search: Record<string, unknown>) => ({
    dir: typeof search.dir === "string" ? search.dir : undefined,
    scan: typeof search.scan === "string" ? search.scan : undefined,
  }),
  component: ReportRoute,
});

function ReportRoute() {
  const { dir, scan } = Route.useSearch();
  return <ReportPage projectDir={dir} routeScanId={scan} />;
}
