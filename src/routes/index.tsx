import { createFileRoute } from "@tanstack/react-router";
import { EntryPage } from "@/pages/EntryPage";

export const Route = createFileRoute("/")({
  component: EntryPage,
});
