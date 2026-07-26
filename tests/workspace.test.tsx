import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { Workspace } from "@/investigations/Workspace";
import type { ScanSummaryRecord } from "@/core/backend/bindings";
import {
  completedScan,
  completedScanDetail,
  createClient,
  draftScan,
  draftScanDetail,
  projectSettings,
} from "./fixtures";

describe("Workspace investigation flow", () => {
  it("persists partial input as a Draft and reuses it when Run is pressed", async () => {
    const user = userEvent.setup();
    const client = createClient();

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[]}
        onCloseProject={async () => undefined}
      />,
    );

    await user.click(screen.getByLabelText("Plugin"));
    await user.click(screen.getByRole("option", { name: "Demo Registry" }));
    await user.click(screen.getByRole("checkbox"));
    await user.type(await screen.findByLabelText(/Name/), "Ada Lovelace");

    expect(client.runScan).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(client.createScan).toHaveBeenCalledTimes(1);
      expect(client.createScan).toHaveBeenCalledWith(null);
      expect(client.updateScanDraft).toHaveBeenCalledWith(
        draftScan.id,
        [{ pluginId: "demo", entrypointId: "person-search" }],
        [
          {
            pluginId: "demo",
            entrypointId: "person-search",
            fieldName: "name",
            value: { type: "string", value: "Ada Lovelace" },
          },
        ],
      );
    });
    expect(screen.queryByText("Untitled")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Run investigation" }),
    );

    await waitFor(() => {
      expect(client.createScan).toHaveBeenCalledTimes(1);
      expect(client.runScan).toHaveBeenCalledTimes(1);
      expect(client.runScan).toHaveBeenCalledWith(
        draftScan.id,
        [{ pluginId: "demo", entrypointId: "person-search" }],
        expect.any(Array),
      );
      expect(client.updateScanDraft).toHaveBeenCalledTimes(1);
    });
  });

  it("loads a history result only after the user selects it", async () => {
    const user = userEvent.setup();
    const client = createClient({
      getScan: vi.fn(async () => completedScanDetail),
    });

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[completedScan]}
        onCloseProject={async () => undefined}
      />,
    );

    expect(client.getScan).not.toHaveBeenCalled();
    await user.click(screen.getByText("Ada Lovelace"));

    await waitFor(() => expect(client.getScan).toHaveBeenCalledTimes(1));
  });

  it("keeps history usable while another investigation is running", async () => {
    const user = userEvent.setup();
    const existingScan = {
      ...completedScan,
      preview: "Existing investigation",
    };
    const existingDetail = {
      ...completedScanDetail,
      preview: existingScan.preview,
    };
    let finishRun: (() => void) | undefined;
    const runPending = new Promise<ScanSummaryRecord>((resolve) => {
      finishRun = () => resolve({ ...draftScan, status: "Completed" });
    });
    const getScan = vi.fn(async (scanId: string) =>
      scanId === existingScan.id
        ? existingDetail
        : { ...draftScanDetail, status: "Completed" },
    );
    const client = createClient({
      getScan,
      listScans: vi.fn(async () => [existingScan, draftScan]),
      runScan: vi.fn(() => runPending),
    });

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[existingScan]}
        onCloseProject={async () => undefined}
      />,
    );

    await user.click(screen.getByLabelText("Plugin"));
    await user.click(screen.getByRole("option", { name: "Demo Registry" }));
    await user.click(screen.getByRole("checkbox"));
    await user.type(await screen.findByLabelText(/Name/), "Running scan");
    await waitFor(() => expect(client.updateScanDraft).toHaveBeenCalled());
    await user.click(
      screen.getByRole("button", { name: "Run investigation" }),
    );
    await waitFor(() => expect(client.runScan).toHaveBeenCalledTimes(1));

    await user.click(screen.getByText("Existing investigation"));

    await waitFor(() =>
      expect(getScan).toHaveBeenCalledWith(existingScan.id),
    );
    expect(
      await screen.findByRole("heading", { name: "Existing investigation" }),
    ).toBeInTheDocument();

    finishRun?.();
  });

  it("opens a persisted Draft back in the same form", async () => {
    const user = userEvent.setup();
    const client = createClient({
      getScan: vi.fn(async () => draftScanDetail),
    });

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[draftScan]}
        onCloseProject={async () => undefined}
      />,
    );

    await user.click(screen.getByText("Untitled"));

    expect(await screen.findByDisplayValue("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("Draft saved");
  });

  it("keeps a manually renamed Draft name independent from its inputs", async () => {
    const user = userEvent.setup();
    let currentSummary = draftScan;
    const updateScanDraft = vi.fn(async () => currentSummary);
    const client = createClient({
      getScan: vi.fn(async () => ({
        ...draftScanDetail,
        preview: currentSummary.preview,
      })),
      updateScanPreview: vi.fn(async (_scanId, preview) => {
        currentSummary = { ...currentSummary, preview };
        return currentSummary;
      }),
      updateScanDraft,
    });

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[draftScan]}
        onCloseProject={async () => undefined}
      />,
    );

    await user.click(screen.getByText("Untitled"));
    await user.click(screen.getByRole("button", { name: "Rename Untitled" }));
    const nameInput = screen.getByLabelText("Investigation name");
    await user.clear(nameInput);
    await user.type(nameInput, "Manual case name");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    const targetInput = await screen.findByDisplayValue("Grace Hopper");
    await user.clear(targetInput);
    await user.type(targetInput, "Different target");
    await waitFor(() => expect(updateScanDraft).toHaveBeenCalled());

    expect(screen.getByText("Manual case name")).toBeInTheDocument();
    expect(updateScanDraft.mock.calls[0]).toHaveLength(3);
  });

  it("collapses history and supports rename, archive, and restore", async () => {
    const user = userEvent.setup();
    const renamedScan = { ...completedScan, preview: "Renamed case" };
    const archivedScan = { ...renamedScan, isArchived: true };
    const client = createClient({
      updateScanPreview: vi.fn(async () => renamedScan),
      setScanArchived: vi.fn(async (_scanId, archived) => ({
        ...renamedScan,
        isArchived: archived,
      })),
    });

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[completedScan]}
        onCloseProject={async () => undefined}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Rename Ada Lovelace" }),
    );
    const nameInput = screen.getByLabelText("Investigation name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed case");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() =>
      expect(client.updateScanPreview).toHaveBeenCalledWith(
        completedScan.id,
        "Renamed case",
      ),
    );
    expect(screen.getByText("Renamed case")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Archive Renamed case" }),
    );
    await waitFor(() =>
      expect(client.setScanArchived).toHaveBeenCalledWith(
        completedScan.id,
        true,
      ),
    );
    expect(screen.queryByText("Renamed case")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archived (1)" }));
    expect(screen.getByText("Renamed case")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Restore Renamed case" }),
    );
    await waitFor(() =>
      expect(client.setScanArchived).toHaveBeenLastCalledWith(
        archivedScan.id,
        false,
      ),
    );

    await user.click(screen.getByTitle("Hide history"));
    expect(screen.queryByPlaceholderText("Search history")).not.toBeInTheDocument();
    await user.click(screen.getByTitle("Show history"));
    expect(screen.getByPlaceholderText("Search history")).toBeInTheDocument();
  });

  it("flushes a pending Draft before closing the project", async () => {
    const user = userEvent.setup();
    const onCloseProject = vi.fn(async () => undefined);
    const client = createClient();

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[]}
        onCloseProject={onCloseProject}
      />,
    );

    await user.click(screen.getByLabelText("Plugin"));
    await user.click(screen.getByRole("option", { name: "Demo Registry" }));
    await user.click(screen.getByRole("checkbox"));
    await user.type(await screen.findByLabelText(/Name/), "Saved on close");
    await user.click(screen.getByRole("button", { name: "Close project" }));

    await waitFor(() => {
      expect(client.updateScanDraft).toHaveBeenCalledWith(
        draftScan.id,
        expect.any(Array),
        expect.any(Array),
      );
      expect(onCloseProject).toHaveBeenCalledTimes(1);
    });
    expect(
      vi.mocked(client.updateScanDraft).mock.invocationCallOrder[0],
    ).toBeLessThan(onCloseProject.mock.invocationCallOrder[0]);
  });

  it("persists explicit scan reordering", async () => {
    const user = userEvent.setup();
    const secondScan = {
      ...completedScan,
      id: "scan-2",
      preview: "Second case",
      sortOrder: 1,
    };
    const reordered = [
      { ...secondScan, sortOrder: 0 },
      { ...completedScan, sortOrder: 1 },
    ];
    const client = createClient({
      reorderScans: vi.fn(async () => reordered),
    });

    render(
      <Workspace
        client={client}
        initialSettings={projectSettings}
        initialScans={[completedScan, secondScan]}
        onCloseProject={async () => undefined}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Reorder Ada Lovelace" }),
    );
    await user.keyboard("{ArrowDown}");

    await waitFor(() =>
      expect(client.reorderScans).toHaveBeenCalledWith([
        secondScan.id,
        completedScan.id,
      ]),
    );
  });
});
