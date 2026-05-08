import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Clock, FileText, Lock, Search, LogOut } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger  } from "./tooltip";

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
            <Tooltip key={item.route}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="tab"
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
                    ${isLocked
                      ? "text-muted-foreground/30 cursor-not-allowed"
                      : isActive
                      ? "border-2 border-foreground/40 text-foreground"
                      : "text-muted-foreground"
                    }
                    relative
                  `}
                >
                  <Icon />
                  {isLocked ? (
                      <Lock className="absolute bottom-1 right-1 !h-4 !w-4 text-amber-500" />
                  ) : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isLocked ? (
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-medium">
                      Install a plugin to unlock {item.label}
                    </span>
                  </div>
                ) : (
                  <p>{item.label}</p>
                )}
              </TooltipContent>
            </Tooltip>

          );
        })}
      </nav>

      <Button
      variant="ghost"
      size="tab"
      onClick={onQuitClick}
      >
        <LogOut />
      </Button>
    </div>
  );
}
