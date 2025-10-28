/**
 * Settings Dialog - Main settings modal (Obsidian-style)
 */

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import { SettingsSidebar } from "./SettingsSidebar";
import { GeneralSettings } from "./GeneralSettings";
import { PluginSettings } from "./PluginSettings";

export type SettingsCategory = "general" | "plugins" | "appearance";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <SettingsSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 p-6">
            {activeCategory === "general" && <GeneralSettings />}
            {activeCategory === "plugins" && <PluginSettings />}
            {activeCategory === "appearance" && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Appearance</h2>
                <p className="text-muted-foreground">
                  Appearance settings coming soon...
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
