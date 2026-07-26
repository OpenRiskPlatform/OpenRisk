import { useState } from "react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import type {
  PluginRecord,
  ProjectSettingsPayload,
} from "@/core/backend/bindings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PluginSettingsForm } from "@/plugins/PluginSettingsForm";
import { displayName } from "@/shared/humanizeIdentifier";
import { GeneralSettingsPanel } from "./GeneralSettingsPanel";
import { PluginManagerPanel } from "./PluginManagerPanel";
import { SecuritySettingsPanel } from "./SecuritySettingsPanel";
import {
  SettingsSidebar,
  type SettingsCategory,
} from "./SettingsSidebar";

interface SettingsDialogProps {
  open: boolean;
  client: OpenRiskClient;
  settings: ProjectSettingsPayload;
  onOpenChange: (open: boolean) => void;
  onPluginUpdated: (plugin: PluginRecord) => void;
  onSettingsReloaded: (settings: ProjectSettingsPayload) => void;
}

export function SettingsDialog({
  open,
  client,
  settings,
  onOpenChange,
  onPluginUpdated,
  onSettingsReloaded,
}: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");
  const pluginId = activeCategory.startsWith("plugin:")
    ? activeCategory.slice("plugin:".length)
    : null;
  const plugin = pluginId
    ? settings.plugins.find((item) => item.id === pluginId) ?? null
    : null;

  const content =
    activeCategory === "general" ? (
      <GeneralSettingsPanel
        client={client}
        settings={settings}
        onSettingsReloaded={onSettingsReloaded}
      />
    ) : activeCategory === "plugins" ? (
      <PluginManagerPanel
        client={client}
        settings={settings}
        onPluginUpdated={onPluginUpdated}
        onConfigurePlugin={(id) => setActiveCategory(`plugin:${id}`)}
      />
    ) : activeCategory === "security" ? (
      <SecuritySettingsPanel client={client} settings={settings} />
    ) : plugin ? (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <h2 className="text-xl font-semibold">
            {displayName(plugin.name, plugin.id)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plugin options are written only after Save settings.
          </p>
        </header>
        <PluginSettingsForm
          key={`${plugin.id}:${plugin.settingValues
            .map((item) => `${item.name}:${JSON.stringify(item.value)}`)
            .join("|")}`}
          client={client}
          plugin={plugin}
          readOnly={settings.project.is_preview}
          onPluginUpdated={onPluginUpdated}
        />
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">
        This plugin is disabled or no longer installed.
      </p>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[78vh] max-h-[720px] w-[88vw] max-w-[900px] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Project and plugin settings
        </DialogDescription>
        <div className="flex min-h-0 flex-1">
          <SettingsSidebar
            activeCategory={activeCategory}
            plugins={settings.plugins}
            readOnly={settings.project.is_preview}
            onCategoryChange={setActiveCategory}
          />
          <div className="min-w-0 flex-1 overscroll-contain overflow-y-auto p-6 pr-12">
            {content}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
