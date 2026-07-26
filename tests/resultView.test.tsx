import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
  it("deduplicates inputs and hides technical entity details in normal mode", () => {
    const detail: ScanDetailRecord = {
      ...completedScanDetail,
      inputs: [
        ...completedScanDetail.inputs,
        { ...completedScanDetail.inputs[0], entrypointId: "second-check" },
      ],
      results: [
        {
          ...completedScanDetail.results[0],
          output: {
            ...completedScanDetail.results[0].output,
            logs: [{ level: "info", message: "technical log" }],
            dataJson: JSON.stringify([
              {
                $entity: "entity.person",
                $id: "demo:ada",
                $props: {
                  name: [{ $type: "string", value: "Ada Lovelace" }],
                  birthDate: [{ $type: "date", value: "1815-12-10" }],
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
    expect(screen.getByText("birthDate")).toBeInTheDocument();
    expect(screen.getByText("pepStatus: false")).toBeInTheDocument();
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
    expect(screen.getByText("adverseActivityDetected")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
    expect(
      screen.getByText("No relevant information was found."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    expect(screen.queryByText("topic:political")).not.toBeInTheDocument();
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

  it("paginates large result sets instead of rendering every card", async () => {
    const user = userEvent.setup();
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

    expect(screen.getByText("25 results")).toBeInTheDocument();
    expect(screen.queryByText("Result 21")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getAllByText("Result 21").length).toBeGreaterThan(0);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
});
