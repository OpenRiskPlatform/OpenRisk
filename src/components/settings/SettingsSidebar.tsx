/**
 * Settings Sidebar - Category navigation
 */

import { Settings, Puzzle, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsCategory } from "./SettingsDialog";

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}

const categories = [
  { id: "general" as const, label: "General", icon: Settings },
  { id: "plugins" as const, label: "Plugins", icon: Puzzle },
  { id: "appearance" as const, label: "Appearance", icon: Palette },
];

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
}: SettingsSidebarProps) {
  return (
    <div className="w-56 border-r-2 bg-muted/20 p-4">
      <div className="space-y-1">
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
      </div>
    </div>
  );
}
