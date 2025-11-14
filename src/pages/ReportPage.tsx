// FULL ReportPage file with plugin cards

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useSettings } from "@/core/settings/SettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

import { usePlugins } from "@/hooks/usePlugins";
import { InstalledPlugin } from "@/core/plugin-system/types";

interface OpenSanctionsEntity {
  id: string;
  schema: string;
  caption?: string;
  properties: any;
  datasets?: string[];
  target?: boolean;
}

interface PluginResult {
  success: boolean;
  query: string;
  total?: {
    value: number;
    relation: string;
  };
  results?: OpenSanctionsEntity[];
  timestamp?: string;
  logs?: string[];
}

export function ReportPage() {
  const backendClient = useBackendClient();
  const { getPluginSettings } = useSettings();
  const { installedPlugins } = usePlugins();

  const [name, setName] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PluginResult | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "json" | "logs">(
    "table"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlugin) {
      setError("Please select a plugin first.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter a name to search");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const settings = getPluginSettings(selectedPlugin);

      const response = await backendClient.executePlugin(
        selectedPlugin,
        { name },
        settings
      );

      if (response.success) {
        setResult(response.data as PluginResult);
      } else {
        setError(response.error || "Plugin execution failed");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <h1 className="text-3xl font-bold mb-6">Risk Analysis Report</h1>

        {/* Plugin List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Installed Plugins</CardTitle>
            <CardDescription>
              Choose a plugin to run a risk or sanctions analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {installedPlugins.map((plugin: InstalledPlugin) => (
                <Card
                  key={plugin.name}
                  className={`border shadow-sm cursor-pointer transition ${
                    selectedPlugin === plugin.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedPlugin(plugin.id)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      {plugin.icon && (
                        <img
                          src={plugin.icon}
                          alt={`${plugin.name} icon`}
                          className="w-10 h-10 rounded"
                        />
                      )}
                      <div>
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        <CardDescription className="text-xs">
                          v{plugin.version}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm mb-3">{plugin.description}</p>

                    {plugin.authors?.length > 0 && (
                      <div className="text-xs text-muted-foreground mb-3">
                        By: {plugin.authors.map((a: any) => a.name).join(", ")}
                      </div>
                    )}

                    <Button
                      variant={
                        selectedPlugin === plugin.name ? "default" : "outline"
                      }
                      size="sm"
                    >
                      {selectedPlugin === plugin.name ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search Form */}
        {selectedPlugin && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Run Plugin: {selectedPlugin}</CardTitle>
              <CardDescription>
                Enter parameters required by this plugin (demo: name search)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Running..." : "Run Analysis"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive font-medium">Error: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    Found {result.total?.value || 0} matches for "{result.query}"
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "table" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                  >
                    Table View
                  </Button>
                  <Button
                    variant={viewMode === "json" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("json")}
                  >
                    JSON View
                  </Button>
                  {result.logs && result.logs.length > 0 && (
                    <Button
                      variant={viewMode === "logs" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("logs")}
                    >
                      Logs ({result.logs.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "table" ? (
                <EntityTable entities={result.results || []} />
              ) : viewMode === "logs" ? (
                <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px]">
                  <div className="space-y-1 font-mono text-xs">
                    {result.logs?.map((log, i) => (
                      <div key={i} className="text-foreground">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

function EntityTable({ entities }: { entities: OpenSanctionsEntity[] }) {
  if (entities.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">No results found</p>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Countries</TableHead>
            <TableHead>Topics</TableHead>
            <TableHead>Datasets</TableHead>
            <TableHead>Birth Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entities.map((entity) => {
            const properties = entity?.properties || {};
            const name = entity?.caption || properties.name?.[0] || "Unknown";
            const alias = properties.alias || [];
            const countries = properties.country || [];
            const topics = properties.topics || [];
            const birthDate = properties.birthDate?.[0] || "-";
            const datasets = entity?.datasets || [];

            return (
              <TableRow key={entity.id}>
                <TableCell className="font-medium">
                  <div>
                    <div>{name}</div>
                    {alias.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        aka: {alias.slice(0, 2).join(", ")}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{entity.schema || "Unknown"}</TableCell>
                <TableCell>
                  {countries.map((c: any) => (
                    <Badge key={c} variant="outline" className="mr-1">
                      {c.toUpperCase()}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {topics.slice(0, 3).map((topic: string) => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic.replace("role.", "").replace("sanction", "sanctioned")}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {datasets.slice(0, 2).join(", ")}
                </TableCell>
                <TableCell className="text-sm">{birthDate}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
