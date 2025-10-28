/**
 * General Settings Panel
 */

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/core/settings/SettingsContext";

export function GeneralSettings() {
  const { globalSettings, updateGlobalSettings } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">General Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your application preferences
        </p>
      </div>

      <div className="space-y-4">
        {/* Theme */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Theme</Label>
            <p className="text-sm text-muted-foreground">
              Select your preferred color scheme
            </p>
          </div>
          <Select
            value={globalSettings.theme}
            onValueChange={(value: "light" | "dark" | "system") =>
              updateGlobalSettings({ theme: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto Save */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto Save</Label>
            <p className="text-sm text-muted-foreground">
              Automatically save your work
            </p>
          </div>
          <Switch
            checked={globalSettings.autoSave}
            onCheckedChange={(checked) =>
              updateGlobalSettings({ autoSave: checked })
            }
          />
        </div>

        {/* Compact Mode */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Compact Mode</Label>
            <p className="text-sm text-muted-foreground">
              Use a more compact interface
            </p>
          </div>
          <Switch
            checked={globalSettings.compactMode}
            onCheckedChange={(checked) =>
              updateGlobalSettings({ compactMode: checked })
            }
          />
        </div>
      </div>
    </div>
  );
}
