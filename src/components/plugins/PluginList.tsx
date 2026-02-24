/**
 * Plugin List - Display installed plugins with scroll
 */

import type { InstalledPlugin } from "@/core/plugin-system/types";
import { PluginCard } from "./PluginCard";

interface PluginListProps {
  plugins: InstalledPlugin[];
}

export function PluginList({ plugins }: PluginListProps) {
  return (
    <div className="space-y-3">
      {plugins.map((plugin) => (
        <PluginCard key={plugin.id} plugin={plugin} />
      ))}
    </div>
  );
}
