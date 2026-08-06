import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ScanDetailRecord } from "@/core/backend/bindings";
import { ScanResultView } from "@/results/ScanResultView";
import { completedScanDetail } from "./fixtures";

function renderResult(detail: ScanDetailRecord, advancedMode: boolean) {
  return render(
    <ScanResultView
      detail={detail}
      pluginNameById={{ demo: "Demo Registry" }}
      entrypointNameByKey={{
        "demo::person-search": "Person search",
        "demo::topic-report": "Topic report",
        "demo::second-check": "Second check",
      }}
      inputNameByKey={{
        "demo::person-search::name": "Full name",
      }}
      advancedMode={advancedMode}
    />,
  );
}

describe("ScanResultView presentation modes", () => {
  it("offers PDF export for an eligible investigation", async () => {
    const user = userEvent.setup();
    const onExportPdf = vi.fn();

    render(
      <ScanResultView
        detail={completedScanDetail}
        pluginNameById={{ demo: "Demo Registry" }}
        entrypointNameByKey={{ "demo::person-search": "Person search" }}
        inputNameByKey={{ "demo::person-search::name": "Full name" }}
        advancedMode={false}
        onExportPdf={onExportPdf}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(onExportPdf).toHaveBeenCalledOnce();
  });

  it("deduplicates inputs and hides technical entity details in normal mode", () => {
    const detail: ScanDetailRecord = {
      ...completedScanDetail,
      inputs: [
        ...completedScanDetail.inputs,
        { ...completedScanDetail.inputs[0], entrypointId: "second-check" },
        {
          pluginId: "demo",
          entrypointId: "person-search",
          fieldName: "includeArchived",
          value: { type: "boolean", value: false },
        },
      ],
      results: [
        {
          ...completedScanDetail.results[0],
          output: {
            ...completedScanDetail.results[0].output,
            logs: [{ level: "info", message: "technical log" }],
            dataJson: JSON.stringify([
              {
                $modelVersion: "0.0.3",
                $entity: "entity.person",
                $id: "demo:ada",
                $props: {
                  name: [{ $type: "string", value: "Ada Lovelace" }],
                  birthDate: [
                    { $type: "date-iso8601", value: "1815-12-10" },
                  ],
                  custom_field: [{ $type: "string", value: "Preserved" }],
                  pepStatus: [{ $type: "boolean", value: false }],
                  sanctioned: [{ $type: "boolean", value: false }],
                },
                $extra: [
                  {
                    $type: "object",
                    value: { key: "Score", value: 0.95 },
                  },
                  {
                    $type: "object",
                    value: { key: "Dataset", value: "demo" },
                  },
                ],
              },
            ]),
          },
        },
      ],
    };

    renderResult(detail, false);

    expect(screen.getByText("Full name")).toBeInTheDocument();
    expect(screen.queryByText("name")).not.toBeInTheDocument();
    expect(screen.getByText("Birth Date")).toBeInTheDocument();
    expect(
      screen.getByText("No risk flags in completed checks"),
    ).toBeInTheDocument();
    expect(screen.queryByText("pepStatus: false")).not.toBeInTheDocument();
    expect(screen.queryByText("false")).not.toBeInTheDocument();
    expect(screen.getByText("Include Archived")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("custom_field")).toBeInTheDocument();
    expect(screen.queryByText("Custom Field")).not.toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("0.95")).toBeInTheDocument();
    expect(screen.queryByText("key")).not.toBeInTheDocument();
    expect(screen.queryByText("demo:ada")).not.toBeInTheDocument();
    expect(screen.queryByText("$props")).not.toBeInTheDocument();
    expect(screen.queryByText("technical log")).not.toBeInTheDocument();
  });

  it("shows technical containers and logs in Advanced mode", () => {
    const detail: ScanDetailRecord = {
      ...completedScanDetail,
      results: [
        {
          ...completedScanDetail.results[0],
          output: {
            ...completedScanDetail.results[0].output,
            logs: [{ level: "info", message: "technical log" }],
          },
        },
      ],
    };

    renderResult(detail, true);

    expect(screen.getByText("demo:ada")).toBeInTheDocument();
    expect(screen.getByText("$props")).toBeInTheDocument();
    expect(screen.getByText("technical log")).toBeInTheDocument();
  });

  it("renders risk topics as compact summaries in normal mode", async () => {
    const user = userEvent.setup();
    const detail: ScanDetailRecord = {
      ...completedScanDetail,
      results: [
        {
          ...completedScanDetail.results[0],
          entrypointId: "topic-report",
          output: {
            ...completedScanDetail.results[0].output,
            dataJson: JSON.stringify([
              {
                $entity: "entity.riskTopic",
                $id: "topic:political",
                $props: {
                  name: [{ $type: "string", value: "Ada Lovelace" }],
                  topicId: [{ $type: "string", value: "political_activity" }],
                  adverseActivityDetected: [
                    { $type: "boolean", value: false },
                  ],
                  summary: [
                    {
                      $type: "string",
                      value: "No relevant information was found.",
                    },
                  ],
                },
                $sources: [],
              },
            ]),
          },
        },
      ],
    };

    renderResult(detail, false);
    await user.click(screen.getByRole("tab", { name: "Topic report" }));

    expect(screen.getByText("political_activity")).toBeInTheDocument();
    expect(screen.getByText("No adverse activity found")).toBeInTheDocument();
    expect(
      screen.queryByText("adverseActivityDetected"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("false")).not.toBeInTheDocument();
    expect(
      screen.getByText("No relevant information was found."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    expect(screen.queryByText("topic:political")).not.toBeInTheDocument();
  });

  it("renders SDK typed values and risk flags in office-friendly language", () => {
    const detail: ScanDetailRecord = {
      ...completedScanDetail,
      results: [
        {
          ...completedScanDetail.results[0],
          output: {
            ...completedScanDetail.results[0].output,
            dataJson: JSON.stringify([
              {
                $modelVersion: "0.0.3",
                $entity: "entity.person",
                $id: "demo:rca",
                $props: {
                  name: [{ $type: "string", value: "Jane Example" }],
                  relativeCloseAssociates: [
                    {
                      $type: "relative-close-associate",
                      value: { name: "John Example", relation: "spouse" },
                    },
                  ],
                  isPepRca: [{ $type: "boolean", value: true }],
                  profile: [
                    {
                      $type: "url",
                      value: "https://example.com/profile",
                    },
                  ],
                },
                $sources: [
                  {
                    name: "Example Registry",
                    source: "https://example.com/source",
                  },
                ],
              },
            ]),
          },
        },
      ],
    };

    renderResult(detail, false);

    expect(screen.getByText("PEP associate")).toBeInTheDocument();
    expect(
      screen.getByText("Relatives and Close Associates"),
    ).toBeInTheDocument();
    expect(screen.getByText(/John Example/)).toHaveTextContent(
      "John Example — spouse",
    );
    expect(
      screen.getByRole("link", { name: /https:\/\/example.com\/profile/ }),
    ).toHaveAttribute("href", "https://example.com/profile");
    expect(
      screen.getByRole("link", { name: "Example Registry" }),
    ).toHaveAttribute("href", "https://example.com/source");
    expect(screen.queryByText("true")).not.toBeInTheDocument();
    expect(screen.queryByText("isPepRca")).not.toBeInTheDocument();
  });

  it("separates entrypoints into tabs", async () => {
    const user = userEvent.setup();
    const detail: ScanDetailRecord = {
      ...completedScanDetail,
      selectedPlugins: [
        ...completedScanDetail.selectedPlugins,
        { pluginId: "demo", entrypointId: "second-check" },
      ],
      results: [
        ...completedScanDetail.results,
        {
          ...completedScanDetail.results[0],
          entrypointId: "second-check",
          output: {
            ...completedScanDetail.results[0].output,
            dataJson: JSON.stringify([
              {
                $entity: "entity.person",
                $id: "demo:second",
                $props: {
                  name: [{ $type: "string", value: "Second result" }],
                },
              },
            ]),
          },
        },
      ],
    };

    renderResult(detail, false);

    expect(screen.getByRole("tab", { name: "Person search" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByText("Second result")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Second check" }));

    expect(screen.getByText("Second result")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Second check" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders the complete result list inside the active entrypoint tab", () => {
    const detail: ScanDetailRecord = {
      ...completedScanDetail,
      results: [
        {
          ...completedScanDetail.results[0],
          output: {
            ...completedScanDetail.results[0].output,
            dataJson: JSON.stringify(
              Array.from({ length: 25 }, (_, index) => ({
                $entity: "entity.person",
                $id: `demo:person-${index + 1}`,
                $props: {
                  name: [
                    { $type: "string", value: `Result ${index + 1}` },
                  ],
                },
              })),
            ),
          },
        },
      ],
    };

    renderResult(detail, false);

    expect(screen.getByText("Result 1")).toBeInTheDocument();
    expect(screen.getByText("Result 21")).toBeInTheDocument();
    expect(screen.getByText("Result 25")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
