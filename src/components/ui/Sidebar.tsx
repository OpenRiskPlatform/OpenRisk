import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart2, Calendar, FileText, Printer, Search } from "lucide-react";

interface SidebarProps {
  projectDir?: string;
  selectedScanId?: string | null;
}

export function Sidebar({ projectDir, selectedScanId }: SidebarProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const navItems = [
    { icon: FileText, label: "Project", route: "/project" as const },
    { icon: Search, label: "Search", route: "/scans" as const },
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

          return (
            <button
              key={item.route}
              onClick={() => {
                if (!projectDir) {
                  void navigate({ to: "/", search: { mode: undefined } });
                  return;
                }
                void navigate({
                  to: item.route,
                  search: buildSearch(item.route),
                });
              }}
              className={`
                w-full h-12 rounded-lg flex items-center justify-center
                transition-colors duration-150
                ${isActive
                  ? "border-2 border-foreground/40 text-foreground"
                  : "text-muted-foreground hover:bg-accent"
                }
              `}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
        <Calendar className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}
