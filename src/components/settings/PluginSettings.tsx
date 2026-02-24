/**
 * Plugin Settings Panel
 */

import type {
  PluginSettingsDescriptor,
  ProjectSettingsRecord,
} from "@/core/backend/types";

interface PluginSettingsProps {
  projectDir?: string;
  projectSettings: ProjectSettingsRecord | null;
  plugins: PluginSettingsDescriptor[];
  loading: boolean;
  error?: string | null;
}

export function PluginSettings({
  projectDir,
  projectSettings,
  plugins,
  loading,
  error,
}: PluginSettingsProps) {
  return (
    <div className="flex flex-col h-full min-h-0 gap-6">
      <div className="flex-shrink-0">
        <h2 className="text-2xl font-semibold mb-1">Project Plugins</h2>
        <p className="text-sm text-muted-foreground">
          View plugins provisioned for this project and their default settings.
        </p>
        {projectSettings && (
          <p className="text-xs text-muted-foreground mt-2">
            Locale: {projectSettings.locale} • Project settings ID: {projectSettings.id}
          </p>
        )}
      </div>

      {!projectDir && (
        <div className="text-center py-12 text-muted-foreground">
          Open or create a project to inspect plugin settings.
        </div>
      )}

      {projectDir && loading && (
        <div className="text-center py-12 text-muted-foreground">
          Loading plugins from project database…
        </div>
      )}

      {projectDir && !loading && error && (
        <div className="text-center py-12 text-red-600 text-sm">{error}</div>
      )}

      {projectDir && !loading && !error && plugins.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No plugins found in this project.
        </div>
      )}

      {projectDir && !loading && !error && plugins.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
          {plugins.map((plugin) => (
            <PluginSettingsCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      )}
    </div>
  );
}

function PluginSettingsCard({
  plugin,
}: {
  plugin: PluginSettingsDescriptor;
}) {
  const manifestSettings = Array.isArray(
    (plugin.manifest as any)?.settings
  )
    ? ((plugin.manifest as any).settings as Array<any>)
    : [];
  const config = (plugin.settings ?? {}) as Record<string, unknown>;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium text-lg">{plugin.name}</p>
          <p className="text-sm text-muted-foreground">ID: {plugin.id}</p>
        </div>
        <p className="text-sm text-muted-foreground">v{plugin.version}</p>
      </div>

      {manifestSettings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This plugin does not declare configurable settings.
        </p>
      ) : (
        <div className="space-y-3">
          {manifestSettings.map((setting: any) => {
            const key: string = setting?.name ?? "";
            const label: string = setting?.title ?? key;
            const description: string | undefined = setting?.description;
            const defaultValue =
              setting?.default !== undefined ? setting.default : null;
            const currentValue =
              key && config[key] !== undefined ? config[key] : defaultValue;
            return (
              <div key={`${plugin.id}-${key}`} className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    {description && (
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {formatSettingValue(currentValue)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Type: {setting?.type ?? "unknown"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatSettingValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "object";
    }
  }
  return String(value);
}
