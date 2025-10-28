/**
 * Add Plugin Button - Dropdown menu to add plugins
 */

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePlugins } from "@/hooks/usePlugins";

export function AddPluginButton() {
  const { availablePlugins, addPlugin } = usePlugins();

  const handleAddPlugin = (plugin: (typeof availablePlugins)[0]) => {
    try {
      addPlugin(plugin);
    } catch (error) {
      console.error("Failed to add plugin:", error);
      alert(error instanceof Error ? error.message : "Failed to add plugin");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Plugin
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Available Plugins</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availablePlugins.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            All plugins installed
          </div>
        ) : (
          availablePlugins.map((plugin) => (
            <DropdownMenuItem
              key={plugin.name}
              onClick={() => handleAddPlugin(plugin)}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-medium">{plugin.name}</span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {plugin.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
