import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBackendClient } from "@/hooks/useBackendClient";
import { usePersonSearchContext } from "@/core/personSearch/PersonSearchContext";
import { usePlugins } from "@/hooks/usePlugins";
import { FolderOpen, Hash, Lock, Coins, CheckCircle2, XCircle, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import type { ProjectSummary } from "@/core/backend/types";

const TOKEN_PRICE = 0.1;
const TOKEN_LIMIT = 500;

// Per-plugin token price overrides (€ per token). Falls back to TOKEN_PRICE.
const PLUGIN_TOKEN_PRICE: Record<string, number> = {
  adversea: 0.15,
  opensanctions: 0.1,
};

function getPluginPrice(pluginId: string): number {
  return PLUGIN_TOKEN_PRICE[pluginId] ?? TOKEN_PRICE;
}

interface ProjectPageProps {
  projectDir?: string;
}

export function ProjectPage({ projectDir }: ProjectPageProps) {
  const backendClient = useBackendClient();
  const { switchProject, pluginTokens, pluginStats } = usePersonSearchContext();
  const { installedPlugins } = usePlugins();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Reset search state only when switching to a different project
  useEffect(() => {
    switchProject(projectDir);
  }, [projectDir]);

  useEffect(() => {
    let cancelled = false;
    if (!projectDir) {
      setProject(null);
      return;
    }

    setLoading(true);
    setError(null);

    backendClient
      .openProject(projectDir)
      .then((summary) => {
        if (!cancelled) {
          setProject(summary);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setProject(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectDir, backendClient]);

  const totalTokens = Object.values(pluginTokens).reduce((a, b) => a + b, 0);
  const totalCost = Object.entries(pluginTokens)
    .reduce((sum, [id, tokens]) => sum + tokens * getPluginPrice(id), 0)
    .toFixed(2);

  return (
    <MainLayout projectDir={projectDir}>
      <div className="px-6 py-6 max-w-screen-xl mx-auto space-y-4">
        {/* Header */}
        <header className="space-y-0.5">
          <h1 className="text-2xl font-bold">
            {project?.name || "Project Overview"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {project
              ? "Overview of your current project."
              : projectDir
              ? "Loading…"
              : "Select or create a project to begin."}
          </p>
        </header>

        {!projectDir && (
          <Card>
            <CardHeader>
              <CardTitle>No project selected</CardTitle>
              <CardDescription>
                Use the entry page to create or open a project before visiting this
                screen.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {projectDir && loading && (
          <p className="text-sm text-muted-foreground">Loading project…</p>
        )}
        {projectDir && error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {projectDir && project && !loading && !error && (
          <>
            {/* Top row: Project Details + Search Statistics side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Project Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Project Details</CardTitle>
                  <CardDescription className="text-xs">Information stored in the local project database.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <InfoItem icon={<Hash className="h-3.5 w-3.5" />} label="Project Name" value={project.name} />
                  <InfoItem icon={<Hash className="h-3.5 w-3.5" />} label="Project ID" value={project.id} />
                  <InfoItem icon={<FolderOpen className="h-3.5 w-3.5" />} label="Directory" value={project.directory} mono />
                  <div className="border rounded-lg p-3 flex flex-col gap-1 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      Password Lock
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs">Not locked</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Search Statistics */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Search Statistics
                  </CardTitle>
                  <CardDescription className="text-xs">Overall search activity in this session.</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const allStats = Object.values(pluginStats);
                    const overallSuccess = allStats.reduce((s, p) => s + p.success, 0);
                    const overallError = allStats.reduce((s, p) => s + p.error, 0);
                    const overallTotal = overallSuccess + overallError;
                    return (
                      <div className="flex flex-col gap-3 h-full">
                        <div className="flex flex-col items-center justify-center rounded-lg bg-muted py-4 px-3">
                          <Search className="h-5 w-5 text-muted-foreground mb-1.5" />
                          <span className="text-3xl font-bold">{overallTotal}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total Searches</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 flex-1">
                          <div className="flex flex-col items-center justify-center rounded-lg bg-green-500/10 py-4 px-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mb-1.5" />
                            <span className="text-3xl font-bold text-green-600 dark:text-green-400">{overallSuccess}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Success</span>
                          </div>
                          <div className="flex flex-col items-center justify-center rounded-lg bg-destructive/10 py-4 px-3">
                            <XCircle className="h-5 w-5 text-destructive mb-1.5" />
                            <span className="text-3xl font-bold text-destructive">{overallError}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Failed</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Token Usage — full width */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" />
                      Token Usage
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Each successful search consumes tokens.
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total estimated cost</p>
                    <p className="text-xl font-bold">€{totalCost}</p>
                    <p className="text-xs text-muted-foreground">{totalTokens} token{totalTokens !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {installedPlugins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No plugins installed.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {installedPlugins.map((plugin) => {
                      const used = pluginTokens[plugin.id] ?? 0;
                      const remaining = TOKEN_LIMIT - used;
                      const pct = Math.min((used / TOKEN_LIMIT) * 100, 100);
                      const isWarning = pct >= 80;
                      const price = getPluginPrice(plugin.id);
                      const cost = (used * price).toFixed(2);
                      return (
                        <div key={plugin.id} className="rounded-lg border px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-medium">{plugin.name}</p>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                  €{price.toFixed(2)}/token
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {used} / {TOKEN_LIMIT} &nbsp;·&nbsp; {remaining} left
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold">€{cost}</p>
                              <p className={`text-xs ${isWarning ? "text-destructive" : "text-muted-foreground"}`}>
                                {pct.toFixed(0)}%
                              </p>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isWarning ? "bg-destructive" : "bg-green-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} projectDir={projectDir} />
    </MainLayout>
  );
}

function InfoItem({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={`text-sm font-medium break-all mt-1 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
