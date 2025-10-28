/**
 * Plugin Settings Form - Configure individual plugin settings
 */

import type { InstalledPlugin } from "@/core/plugin-system/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/core/settings/SettingsContext";

interface PluginSettingsFormProps {
  plugin: InstalledPlugin;
}

export function PluginSettingsForm({ plugin }: PluginSettingsFormProps) {
  const { getPluginSettings, updatePluginSettings } = useSettings();
  const settings = getPluginSettings(plugin.id);

  const handleChange = (name: string, value: string | number | boolean) => {
    updatePluginSettings(plugin.id, {
      ...settings,
      [name]: value,
    });
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <h4 className="font-medium text-sm">Plugin Configuration</h4>
      {plugin.settings.map((setting) => (
        <div key={setting.name} className="space-y-2">
          <Label htmlFor={`${plugin.id}-${setting.name}`}>
            {setting.title}
          </Label>
          <p className="text-xs text-muted-foreground">{setting.description}</p>

          {setting.type === "boolean" ? (
            <Switch
              id={`${plugin.id}-${setting.name}`}
              checked={(settings[setting.name] as boolean) ?? setting.default}
              onCheckedChange={(checked) => handleChange(setting.name, checked)}
            />
          ) : setting.type === "number" ? (
            <Input
              id={`${plugin.id}-${setting.name}`}
              type="number"
              value={
                (settings[setting.name] as number) ?? setting.default ?? ""
              }
              onChange={(e) =>
                handleChange(setting.name, parseFloat(e.target.value))
              }
            />
          ) : (
            <Input
              id={`${plugin.id}-${setting.name}`}
              type="text"
              value={
                (settings[setting.name] as string) ?? setting.default ?? ""
              }
              onChange={(e) => handleChange(setting.name, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
