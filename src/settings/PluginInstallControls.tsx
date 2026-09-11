import { useState } from "react";
import type { RegistryPluginRecord } from "@/core/backend/bindings";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { displayName } from "@/shared/humanizeIdentifier";
import { pluginVersionAction } from "./pluginVersions";

interface PluginInstallControlsProps {
  plugin: RegistryPluginRecord;
  installedVersion?: string | null;
  disabled?: boolean;
  installing?: boolean;
  className?: string;
  onInstall: (version: string) => void;
}

export function PluginInstallControls({
  plugin,
  installedVersion = null,
  disabled = false,
  installing = false,
  className,
  onInstall,
}: PluginInstallControlsProps) {
  const [selectedVersion, setSelectedVersion] = useState(plugin.version);
  const pluginName = displayName(plugin.name, plugin.id);
  const versions = Array.from(
    new Set([
      plugin.version,
      ...(plugin.versions ?? []),
      ...(installedVersion ? [installedVersion] : []),
    ]),
  );
  const actionLabel = pluginVersionAction(
    installedVersion,
    plugin.version,
    selectedVersion,
  );

  return (
    <div
      className={cn(
        "grid grid-cols-[10.5rem_auto] items-center gap-3",
        className,
      )}
    >
      <Select
        value={selectedVersion}
        disabled={disabled}
        onValueChange={setSelectedVersion}
      >
        <SelectTrigger aria-label={`${pluginName} version`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {versions.map((version) => (
              <SelectItem key={version} value={version}>
                v{version}
                {version === plugin.version ? " · Latest" : ""}
                {version === installedVersion ? " · Installed" : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={disabled}
        onClick={() => onInstall(selectedVersion)}
      >
        {installing ? "Installing…" : actionLabel}
      </Button>
    </div>
  );
}
