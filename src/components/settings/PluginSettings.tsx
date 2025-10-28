/**
 * Plugin Settings Panel
 */

import { usePlugins } from "@/hooks/usePlugins";
import { PluginList } from "@/components/plugins/PluginList";
import { AddPluginButton } from "@/components/plugins/AddPluginButton";

export function PluginSettings() {
  const { installedPlugins } = usePlugins();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Plugins</h2>
          <p className="text-sm text-muted-foreground">
            Manage your installed plugins and add new ones
          </p>
        </div>
        <AddPluginButton />
      </div>

      {installedPlugins.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No plugins installed yet. Click "Add Plugin" above to get started.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          <PluginList plugins={installedPlugins} />
        </div>
      )}
    </div>
  );
}
