import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GeneralSettingsPanel } from "@/settings/GeneralSettingsPanel";
import { createClient, projectSettings } from "./fixtures";

describe("general settings", () => {
  it("persists Advanced mode only after the user toggles it", async () => {
    const user = userEvent.setup();
    const client = createClient();

    render(
      <GeneralSettingsPanel
        client={client}
        settings={projectSettings}
        onSettingsReloaded={() => undefined}
      />,
    );

    expect(client.updateProjectSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole("switch", { name: "Advanced mode" }));

    await waitFor(() =>
      expect(client.updateProjectSettings).toHaveBeenCalledWith(
        null,
        null,
        true,
      ),
    );
  });
});
