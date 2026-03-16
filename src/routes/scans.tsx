import { createFileRoute } from "@tanstack/react-router";
import { PersonSearchPage } from "@/pages/PersonSearchPage";

export const Route = createFileRoute("/scans")({
  component: PersonSearchPage,
});
