import { createFileRoute } from "@tanstack/react-router";
import { PrintPage } from "@/pages/PrintPage";

export const Route = createFileRoute("/print")({
  component: PrintPage,
});
