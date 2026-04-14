import { createFileRoute } from "@tanstack/react-router";
import { PrintPage } from "@/pages/PrintPage";

export const Route = createFileRoute("/print")({
  validateSearch: (search: Record<string, unknown>) => ({
    dir: typeof search.dir === "string" ? search.dir : undefined,
    scan: typeof search.scan === "string" ? search.scan : undefined,
  }),
  component: PrintRoute,
});

function PrintRoute() {
  const { dir, scan } = Route.useSearch();
  return <PrintPage projectDir={dir} routeScanId={scan} />;
}
