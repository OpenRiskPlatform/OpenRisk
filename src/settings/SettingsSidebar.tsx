import { LockKeyhole, PackagePlus, Settings } from "lucide-react";
import type { PluginRecord } from "@/core/backend/bindings";
import { cn } from "@/lib/utils";
import { displayName } from "@/shared/humanizeIdentifier";

export type SettingsCategory =
  | "general"
  | "plugins"
  | "security"
  | `plugin:${string}`;

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  plugins: PluginRecord[];
  readOnly: boolean;
  onCategoryChange: (category: SettingsCategory) => void;
}

const categories = [
  { id: "general" as const, label: "General", icon: Settings },
  { id: "plugins" as const, label: "Community plugins", icon: PackagePlus },
  { id: "security" as const, label: "Security", icon: LockKeyhole },
];

export function SettingsSidebar({
  activeCategory,
  plugins,
  readOnly,
  onCategoryChange,
}: SettingsSidebarProps) {
  const enabledPlugins = plugins.filter((plugin) => plugin.enabled);

  return (
    <aside className="flex min-h-0 w-52 shrink-0 flex-col border-r bg-muted/20 p-2.5">
      <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Settings
      </p>
      <nav className="space-y-1">
        {categories
          .filter((category) => !readOnly || category.id === "general")
          .map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategoryChange(category.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                  activeCategory === category.id
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {category.label}
              </button>
            );
          })}
      </nav>

      {!readOnly ? (
        <>
          <p className="px-3 pb-2 pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plugin options
          </p>
          <nav className="min-h-0 space-y-1 overflow-y-auto">
            {enabledPlugins.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No enabled plugins
              </p>
            ) : (
              enabledPlugins.map((plugin) => (
                <button
                  key={plugin.id}
                  type="button"
                  onClick={() => onCategoryChange(`plugin:${plugin.id}`)}
                  className={cn(
                    "flex w-full items-center rounded-md py-1.5 pl-9 pr-3 text-left text-sm transition-colors",
                    activeCategory === `plugin:${plugin.id}`
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                  )}
                >
                  <span className="truncate">
                    {displayName(plugin.name, plugin.id)}
                  </span>
                </button>
              ))
            )}
          </nav>
        </>
      ) : null}
    </aside>
  );
}
