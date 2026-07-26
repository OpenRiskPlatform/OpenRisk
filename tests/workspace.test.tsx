import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { Workspace } from "@/investigations/Workspace";
import {
  completedScan,
  completedScanDetail,
  createClient,
  projectSettings,
} from "./fixtures";

describe("Workspace investigation flow", () => {
  it("does not write while editing and runs exactly one scan per click", async () => {
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

    expect(client.createScan).not.toHaveBeenCalled();
    expect(client.runScan).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Run investigation" }),
    );

    await waitFor(() => {
      expect(client.createScan).toHaveBeenCalledTimes(1);
      expect(client.createScan).toHaveBeenCalledWith("Ada Lovelace");
      expect(client.runScan).toHaveBeenCalledTimes(1);
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
});
