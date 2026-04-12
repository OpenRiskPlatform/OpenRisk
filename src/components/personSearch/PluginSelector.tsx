/**
 * PluginSelector – card grid for choosing which plugin to run a search with.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InstalledPlugin } from "@/core/plugin-system/types";

const TOKEN_LIMIT = 500;

interface PluginSelectorProps {
  installedPlugins: InstalledPlugin[];
  selectedPlugin: string | null;
  pluginTokens?: Record<string, number>;
  onSelect: (id: string) => void;
}

export function PluginSelector({
  installedPlugins,
  selectedPlugin,
  pluginTokens = {},
  onSelect,
}: PluginSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Plugin</CardTitle>
        <CardDescription>
          Choose which plugin to use for the person search.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {installedPlugins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No plugins installed. Go to Settings to install a plugin.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {installedPlugins.map((plugin: InstalledPlugin) => {
                const used = pluginTokens[plugin.id] ?? 0;
                const pct = Math.min((used / TOKEN_LIMIT) * 100, 100);
                const isWarning = pct >= 80;
                const isSelected = selectedPlugin === plugin.id;

                return (
                  <Card
                    key={plugin.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? "ring-2 ring-primary border-primary" : ""
                    }`}
                    onClick={() => onSelect(plugin.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        {plugin.icon && (
                          <img
                            src={plugin.icon}
                            alt={`${plugin.name} icon`}
                            className="w-9 h-9 rounded"
                          />
                        )}
                        <div>
                          <CardTitle className="text-base">{plugin.name}</CardTitle>
                          <CardDescription className="text-xs">
                            v{plugin.version}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {plugin.description}
                      </p>

                      {/* Token usage */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Tokens used</span>
                          <span
                            className={`font-medium ${
                              isWarning ? "text-red-600 dark:text-red-400" : "text-foreground"
                            }`}
                          >
                            {used} / {TOKEN_LIMIT}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isWarning ? "bg-red-600 dark:bg-red-500" : "bg-green-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <Badge
                        className="mt-1"
                        variant={isSelected ? "default" : "outline"}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Each trigger for search spends one token for selected plugin. If search results in error, no token will be deducted.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
