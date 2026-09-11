import { useEffect, useState } from "react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import type {
  PluginRecord,
  RegistryPluginRecord,
} from "@/core/backend/bindings";
import { displayName } from "@/shared/humanizeIdentifier";
import { PluginInstallControls } from "./PluginInstallControls";
import { pluginManifestUrl } from "./pluginVersions";

interface AvailablePluginPanelProps {
  client: OpenRiskClient;
  pluginId: string;
  installationEnabled: boolean;
  onPluginUpdated: (plugin: PluginRecord) => void;
}

export function AvailablePluginPanel({
  client,
  pluginId,
  installationEnabled,
  onPluginUpdated,
}: AvailablePluginPanelProps) {
  const [plugin, setPlugin] = useState<RegistryPluginRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPlugin(null);
    setLoading(true);
    setError(null);

    void client
      .getPluginRegistry()
      .then((registry) => {
        if (cancelled) return;
        const availablePlugin = registry.plugins.find(
          (item) => item.id === pluginId,
        );
        if (!availablePlugin) {
          throw new Error(
            `Plugin “${pluginId}” is not published in the registry.`,
          );
        }
        setPlugin(availablePlugin);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : String(loadError),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, pluginId]);

  const install = async (version: string) => {
    setInstalling(true);
    setError(null);
    try {
      onPluginUpdated(
        await client.installPluginFromUrl(pluginManifestUrl(pluginId, version)),
      );
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : String(installError),
      );
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">
            {displayName(plugin?.name, pluginId)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {plugin?.description ??
              "Install this available plugin to configure and use it."}
          </p>
        </div>
        {plugin ? (
          <PluginInstallControls
            plugin={plugin}
            disabled={!installationEnabled || installing}
            installing={installing}
            onInstall={(version) => void install(version)}
          />
        ) : null}
      </header>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading plugin details…
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
