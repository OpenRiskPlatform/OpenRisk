import { createFileRoute } from "@tanstack/react-router";
import { EntryPage } from "../pages/EntryPage";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode:
      typeof search.mode === "string" &&
        (search.mode === "create" || search.mode === "open")
        ? (search.mode as "create" | "open")
        : undefined,
  }),
  component: IndexRoute,
});

function IndexRoute() {
  const { mode } = Route.useSearch();
  return <EntryPage initialMode={mode} />;
}
