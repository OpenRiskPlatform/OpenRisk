/**
 * Settings Sidebar - Category navigation
 */

import { Info, Settings, PackagePlus, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsCategory } from "./SettingsDialog";
import type { PluginRecord } from "@/core/backend/bindings";

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
  isPreview?: boolean;
  plugins?: PluginRecord[];
}

const appCategories = [
  { id: "info" as const, label: "Info", icon: Info },
  { id: "general" as const, label: "General", icon: Settings },
  { id: "manage-plugins" as const, label: "Manage Plugins", icon: PackagePlus },
];

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
  isPreview,
  plugins = [],
}: SettingsSidebarProps) {
  const categories = isPreview
    ? appCategories.filter((c) => c.id === "info")
    : appCategories;
  const enabledPlugins = plugins.filter((plugin) => plugin.enabled);
  return (
    <div className="w-56 border-r-2 bg-muted/20 p-4">
      <div className="space-y-1">
        <p className="px-3 text-xs font-semibold text-muted-foreground">
          App Settings
        </p>
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {category.label}
            </button>
          );
        })}
        {!isPreview && (
          <p className="pt-3 px-3 text-xs font-semibold text-muted-foreground">
            Enabled Plugins
          </p>
        )}
        {!isPreview && enabledPlugins.length === 0 && (
          <div className="px-3 text-xs text-muted-foreground">
            No enabled plugins
          </div>
        )}
        {!isPreview && enabledPlugins.map((plugin) => (
          <button
            key={`plugin-${plugin.id}`}
            onClick={() => onCategoryChange(`plugin:${plugin.id}`)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
              activeCategory === `plugin:${plugin.id}`
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Puzzle className="h-4 w-4 flex-shrink-0" />
            <p className="min-w-0 text-left text-sm font-medium truncate">
              {plugin.name}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
