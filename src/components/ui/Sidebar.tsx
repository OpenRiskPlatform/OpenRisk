import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart2, Clock, FileText, Lock, Printer, Search, LogOut } from "lucide-react";
import { Button } from "./button";

interface SidebarProps {
  projectDir?: string;
  selectedScanId?: string | null;
  onQuitClick?: () => void | null;
  hasPlugins?: boolean;
}

export function Sidebar({ projectDir, selectedScanId, onQuitClick, hasPlugins = true }: SidebarProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const navItems = [
    { icon: FileText, label: "Project", route: "/project" as const },
    { icon: Search, label: "Search", route: "/scans" as const },
    { icon: Clock, label: "Scan History", route: "/history" as const },
    { icon: BarChart2, label: "Stats", route: "/report" as const },
    { icon: Printer, label: "Print", route: "/print" as const },
  ];

  const buildSearch = (route: (typeof navItems)[number]["route"]) => {
    if (route === "/project") {
      return { dir: projectDir ?? undefined };
    }
    return {
      dir: projectDir ?? undefined,
      scan: selectedScanId ?? undefined,
    };
  };

  return (
    <div
      data-app-chrome
      className="w-16 shrink-0 bg-background flex flex-col items-center py-4 border-r border-border"
    >
      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.route;
          const isLocked = !hasPlugins && item.route !== "/project";

          return (
            <div key={item.route} className="relative group">
              <button
                disabled={isLocked}
                onClick={() => {
                  if (!projectDir) {
                    void navigate({ to: "/", search: { mode: undefined } });
                    return;
                  }
                  if (isLocked) return;
                  void navigate({
                    to: item.route,
                    search: buildSearch(item.route),
                  });
                }}
                className={`
                  w-full h-12 rounded-lg flex items-center justify-center
                  transition-colors duration-150
                  ${isLocked
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : isActive
                    ? "border-2 border-foreground/40 text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                  }
                `}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                {isLocked ? (
                  <Lock className="absolute bottom-1 right-1 w-2.5 h-2.5 text-amber-500" />
                ) : null}
              </button>

              {/* Hover tooltip for locked items */}
              {isLocked ? (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 px-3 py-2 shadow-lg">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Install a plugin to unlock {item.label}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <Button
      variant="ghost"
      size="icon"
      onClick={onQuitClick}
      >
        <LogOut />
      </Button>
    </div>
  );
}
