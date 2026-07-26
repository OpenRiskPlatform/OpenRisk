import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Package,
} from "lucide-react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import type {
  PluginRecord,
  ProjectSettingsPayload,
  RegistryPluginRecord,
} from "@/core/backend/bindings";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { pluginVersionAction } from "./pluginVersions";

const REGISTRY_BASE =
  "https://raw.githubusercontent.com/OpenRiskPlatform/plugins/main";

type PluginView = "installed" | "registry" | "manual";

interface PluginManagerPanelProps {
  client: OpenRiskClient;
  settings: ProjectSettingsPayload;
  onPluginUpdated: (plugin: PluginRecord) => void;
  onConfigurePlugin?: (pluginId: string) => void;
}

export function PluginManagerPanel({
  client,
  settings,
  onPluginUpdated,
  onConfigurePlugin,
}: PluginManagerPanelProps) {
  const [view, setView] = useState<PluginView>("installed");
  const [registry, setRegistry] = useState<RegistryPluginRecord[] | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<
    Record<string, string>
  >({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = settings.project.is_preview;

  const runAction = async (
    actionName: string,
    action: () => Promise<PluginRecord>,
  ) => {
    setPendingAction(actionName);
    setError(null);
    try {
      onPluginUpdated(await action());
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : String(actionError),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const loadRegistry = async () => {
    setPendingAction("registry");
    setError(null);
    try {
      const response = await client.getPluginRegistry();
      setRegistry(response.plugins);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : String(actionError),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const importDirectory = async () => {
    const pluginDirectory = await open({
      title: "Select plugin directory",
      directory: true,
      multiple: false,
    });
    if (typeof pluginDirectory !== "string") {
      return;
    }
    await runAction("directory", () =>
      client.upsertProjectPluginFromDir(pluginDirectory),
    );
  };

  const importZip = async () => {
    const zipPath = await open({
      title: "Select plugin ZIP",
      directory: false,
      multiple: false,
      filters: [{ name: "Plugin archive", extensions: ["zip"] }],
    });
    if (typeof zipPath !== "string") {
      return;
    }
    await runAction("zip", () => client.upsertProjectPluginFromZip(zipPath));
  };

  const installRegistryPlugin = async (plugin: RegistryPluginRecord) => {
    const version = selectedVersions[plugin.id] ?? plugin.version;
    const manifestUrl = `${REGISTRY_BASE}/${plugin.id}/${version}/plugin.json`;
    await runAction(`registry:${plugin.id}`, () =>
      client.installPluginFromUrl(manifestUrl),
    );
  };

  const header = (
    title: string,
    description: string,
    canGoBack = false,
  ) => (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          {canGoBack ? (
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 h-8 w-8"
              aria-label="Back to installed plugins"
              onClick={() => setView("installed")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Package className="h-5 w-5" />
          )}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <p className={canGoBack ? "mt-1 pl-8 text-sm text-muted-foreground" : "mt-1 text-sm text-muted-foreground"}>
          {description}
        </p>
      </div>
      {view === "installed" && !readOnly ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView("registry")}>
            Browse plugins
          </Button>
          <Button variant="outline" onClick={() => setView("manual")}>
            Install from file
          </Button>
        </div>
      ) : null}
    </header>
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-7">
      {view === "installed"
        ? header(
            "Plugins",
            "Choose which integrations are available in this project.",
          )
        : view === "registry"
          ? header(
              "Browse plugins",
              "Install a published plugin from the OpenRisk registry.",
              true,
            )
          : header(
              "Install from file",
              "Import a local plugin folder or ZIP archive.",
              true,
            )}

      {error ? (
        <div role="alert" className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {view === "installed" ? (
        settings.plugins.length === 0 ? (
          <p className="border-y py-10 text-center text-sm text-muted-foreground">
            No plugins installed.
          </p>
        ) : (
          <ul className="border-t">
            {settings.plugins.map((plugin) => (
              <li
                key={plugin.id}
                className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{plugin.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {plugin.manifest.description || plugin.id}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    v{plugin.version}
                    {plugin.status ? ` · ${plugin.status}` : ""}
                  </p>
                </div>
                <Switch
                  aria-label={`Enable ${plugin.name}`}
                  checked={plugin.enabled}
                  disabled={readOnly || pendingAction !== null}
                  onCheckedChange={() =>
                    void runAction(`toggle:${plugin.id}`, () =>
                      client.setPluginEnabled(plugin.id, !plugin.enabled),
                    )
                  }
                />
                {plugin.enabled && onConfigurePlugin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Configure ${plugin.name}`}
                    onClick={() => onConfigurePlugin(plugin.id)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="h-9 w-9" />
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {view === "registry" ? (
        registry === null ? (
          <div className="border-y py-10 text-center">
            <p className="text-sm text-muted-foreground">
              The registry is loaded only when requested.
            </p>
            <Button
              className="mt-4 gap-2"
              disabled={pendingAction !== null}
              onClick={() => void loadRegistry()}
            >
              <Download className="h-4 w-4" />
              {pendingAction === "registry"
                ? "Loading…"
                : "Load registry"}
            </Button>
          </div>
        ) : registry.length === 0 ? (
          <p className="border-y py-10 text-center text-sm text-muted-foreground">
            The registry has no plugins.
          </p>
        ) : (
          <ul className="border-t">
            {registry.map((plugin) => {
              const installed = settings.plugins.find(
                (item) => item.id === plugin.id,
              );
              const versions = Array.from(
                new Set([
                  plugin.version,
                  ...(plugin.versions ?? []),
                  ...(installed ? [installed.version] : []),
                ]),
              );
              const selectedVersion =
                selectedVersions[plugin.id] ?? plugin.version;
              const actionLabel = pluginVersionAction(
                installed?.version ?? null,
                plugin.version,
                selectedVersion,
              );

              return (
                <li
                  key={plugin.id}
                  className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_10.5rem_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{plugin.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {plugin.description}
                    </p>
                    {installed ? (
                      <p className="mt-1 text-xs">
                        <span className="text-muted-foreground">
                          Installed v{installed.version}
                        </span>
                        <span className="text-muted-foreground"> · </span>
                        {installed.version === plugin.version ? (
                          <span className="text-emerald-700 dark:text-emerald-300">
                            Up to date
                          </span>
                        ) : (
                          <span className="font-medium text-amber-700 dark:text-amber-300">
                            Latest v{plugin.version}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Latest v{plugin.version}
                      </p>
                    )}
                  </div>
                  <Select
                    value={selectedVersion}
                    disabled={pendingAction !== null}
                    onValueChange={(version) =>
                      setSelectedVersions((current) => ({
                        ...current,
                        [plugin.id]: version,
                      }))
                    }
                  >
                    <SelectTrigger aria-label={`${plugin.name} version`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((version) => (
                        <SelectItem key={version} value={version}>
                          v{version}
                          {version === plugin.version ? " · Latest" : ""}
                          {version === installed?.version ? " · Installed" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={pendingAction !== null}
                    onClick={() => void installRegistryPlugin(plugin)}
                  >
                    {pendingAction === `registry:${plugin.id}`
                      ? "Installing…"
                      : actionLabel}
                  </Button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {view === "manual" ? (
        <div className="border-y">
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void importDirectory()}
            className="flex w-full items-center gap-3 border-b py-4 text-left disabled:opacity-50"
          >
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium">Plugin folder</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Select a directory containing plugin.json.
              </span>
            </span>
          </button>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void importZip()}
            className="flex w-full items-center gap-3 py-4 text-left disabled:opacity-50"
          >
            <Archive className="h-5 w-5 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium">ZIP archive</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Select a packaged plugin archive.
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
