import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/pages/SearchPage";

export const Route = createFileRoute("/scans")({
  validateSearch: (search: Record<string, unknown>) => ({
    dir: typeof search.dir === "string" ? search.dir : undefined,
    scan: typeof search.scan === "string" ? search.scan : undefined,
  }),
  component: SearchRoute,
});

function SearchRoute() {
  const { dir, scan } = Route.useSearch();
  return <SearchPage projectDir={dir} routeScanId={scan} />;
}
