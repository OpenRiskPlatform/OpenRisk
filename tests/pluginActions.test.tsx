import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PluginSettingsForm } from "@/plugins/PluginSettingsForm";
import { AvailablePluginPanel } from "@/settings/AvailablePluginPanel";
import { PluginManagerPanel } from "@/settings/PluginManagerPanel";
import { pluginVersionAction } from "@/settings/pluginVersions";
import { createClient, demoPlugin, projectSettings } from "./fixtures";

const adverseaRegistryPlugin = {
  id: "adversea",
  name: "Adversea",
  version: "0.2.4",
  versions: ["0.2.3"],
  path: "adversea/0.2.4",
  description: "Screen entities with Adversea.",
  authors: [],
  license: "",
  main: "index.js",
};

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

  it("installs a selected version from the plugin marketplace", async () => {
    const user = userEvent.setup();
    const client = createClient({
      getPluginRegistry: async () => ({
        generatedAt: "2026-09-11T10:00:00Z",
        plugins: [adverseaRegistryPlugin],
      }),
    });

    render(
      <PluginManagerPanel
        client={client}
        settings={projectSettings}
        installationEnabled
        onPluginUpdated={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Browse plugins" }));
    await user.click(screen.getByRole("button", { name: "Load registry" }));
    await user.click(
      await screen.findByRole("combobox", { name: "Adversea version" }),
    );
    await user.click(screen.getByRole("option", { name: "v0.2.3" }));
    await user.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() =>
      expect(client.installPluginFromUrl).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/OpenRiskPlatform/plugins/main/adversea/0.2.3/plugin.json",
      ),
    );
  });

  it("installs an available plugin from Plugin Options", async () => {
    const user = userEvent.setup();
    const client = createClient({
      getPluginRegistry: async () => ({
        generatedAt: "2026-09-11T10:00:00Z",
        plugins: [adverseaRegistryPlugin],
      }),
    });

    render(
      <AvailablePluginPanel
        client={client}
        pluginId="adversea"
        installationEnabled
        onPluginUpdated={() => undefined}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Adversea" }),
    ).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "Adversea version" }));
    await user.click(screen.getByRole("option", { name: "v0.2.3" }));
    await user.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() =>
      expect(client.installPluginFromUrl).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/OpenRiskPlatform/plugins/main/adversea/0.2.3/plugin.json",
      ),
    );
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
