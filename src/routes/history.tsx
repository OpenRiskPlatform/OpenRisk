import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/pages/HistoryPage";

export const Route = createFileRoute("/history")({
  validateSearch: (search: Record<string, unknown>) => ({
    dir: typeof search.dir === "string" ? search.dir : undefined,
    scan: typeof search.scan === "string" ? search.scan : undefined,
  }),
  component: HistoryRoute,
});

function HistoryRoute() {
  const { dir, scan } = Route.useSearch();
  return <HistoryPage projectDir={dir} routeScanId={scan} />;
}

