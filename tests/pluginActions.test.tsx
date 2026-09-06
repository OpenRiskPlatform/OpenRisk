import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PluginSettingsForm } from "@/plugins/PluginSettingsForm";
import { PluginManagerPanel } from "@/settings/PluginManagerPanel";
import { pluginVersionAction } from "@/settings/pluginVersions";
import { createClient, demoPlugin, projectSettings } from "./fixtures";

describe("plugin actions", () => {
  it("labels registry actions from installed, latest, and selected versions", () => {
    expect(pluginVersionAction(null, "1.2.0", "1.2.0")).toBe("Install");
    expect(pluginVersionAction("1.1.0", "1.2.0", "1.2.0")).toBe("Update");
    expect(pluginVersionAction("1.2.0", "1.2.0", "1.2.0")).toBe(
      "Reinstall",
    );
    expect(pluginVersionAction("1.2.0", "1.2.0", "1.1.0")).toBe(
      "Change version",
    );
  });

  it("does not load the registry until requested", async () => {
    const user = userEvent.setup();
    const client = createClient();

    render(
      <PluginManagerPanel
        client={client}
        settings={projectSettings}
        installationEnabled
        onPluginUpdated={() => undefined}
      />,
    );

    expect(client.getPluginRegistry).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Browse plugins" }));
    expect(client.getPluginRegistry).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Load registry" }));
    await waitFor(() =>
      expect(client.getPluginRegistry).toHaveBeenCalledTimes(1),
    );
  });

  it("removes plugin installation actions when the build disables them", () => {
    const client = createClient();

    render(
      <PluginManagerPanel
        client={client}
        settings={projectSettings}
        installationEnabled={false}
        onPluginUpdated={() => undefined}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Browse plugins" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Install from file" }),
    ).toBeNull();
    expect(screen.getByText("Demo Registry")).toBeVisible();
  });

  it("writes plugin settings only after Save settings", async () => {
    const user = userEvent.setup();
    const client = createClient();

    render(
      <PluginSettingsForm
        client={client}
        plugin={demoPlugin}
        readOnly={false}
        onPluginUpdated={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText(/API key/), "secret");
    expect(client.setPluginSetting).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() =>
      expect(client.setPluginSetting).toHaveBeenCalledTimes(1),
    );
  });

  it("does not write plugin settings when nothing changed", async () => {
    const user = userEvent.setup();
    const client = createClient();

    render(
      <PluginSettingsForm
        client={client}
        plugin={demoPlugin}
        readOnly={false}
        onPluginUpdated={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(client.setPluginSetting).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No changes");
  });
});
