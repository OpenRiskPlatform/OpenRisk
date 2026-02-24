import { createFileRoute } from "@tanstack/react-router";
import { ReportPage } from "@/pages/ReportPage";

export const Route = createFileRoute("/report")({
  component: ReportPage,
});
