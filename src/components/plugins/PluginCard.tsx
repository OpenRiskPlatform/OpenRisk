/**
 * Plugin Card - Display individual plugin info
 */

import type { InstalledPlugin } from "@/core/plugin-system/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, Settings } from "lucide-react";
import { usePlugins } from "@/hooks/usePlugins";
import { useState } from "react";
import { PluginSettingsForm } from "./PluginSettingsForm";

interface PluginCardProps {
  plugin: InstalledPlugin;
}

export function PluginCard({ plugin }: PluginCardProps) {
  const { removePlugin, togglePlugin } = usePlugins();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{plugin.name}</CardTitle>
            <CardDescription>{plugin.description}</CardDescription>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>v{plugin.version}</span>
              <span>•</span>
              <span>{plugin.authors.map((a) => a.name).join(", ")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={plugin.enabled}
              onCheckedChange={() => togglePlugin(plugin.id)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Remove ${plugin.name}?`)) {
                  removePlugin(plugin.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {showSettings && plugin.settings.length > 0 && (
        <CardContent>
          <PluginSettingsForm plugin={plugin} />
        </CardContent>
      )}
    </Card>
  );
}
