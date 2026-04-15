import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Archive, Power, Download, RefreshCw } from "lucide-react";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type {
    PluginRecord,
    RegistryPluginRecord,
} from "@/core/backend/bindings";

const REGISTRY_BASE =
    "https://raw.githubusercontent.com/OpenRiskPlatform/plugins/main";

interface ManagePluginsProps {
    projectDir?: string;
    plugins: PluginRecord[];
    loading: boolean;
    error?: string | null;
    onPluginUpdated: (plugin: PluginRecord) => void;
}

export function ManagePlugins({
    projectDir,
    plugins,
    loading,
    error,
    onPluginUpdated,
}: ManagePluginsProps) {
    const backendClient = useBackendClient();
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Registry state
    const [registry, setRegistry] = useState<RegistryPluginRecord[] | null>(null);
    const [registryLoading, setRegistryLoading] = useState(false);
    const [registryError, setRegistryError] = useState<string | null>(null);
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [selectedRegistryVersions, setSelectedRegistryVersions] = useState<Record<string, string>>({});

    const fetchRegistry = async () => {
        setRegistryLoading(true);
        setRegistryError(null);
        try {
            const data = await unwrap(backendClient.getPluginRegistry());
            setRegistry(data.plugins);
            setSelectedRegistryVersions((prev) => {
                const next: Record<string, string> = { ...prev };
                for (const plugin of data.plugins) {
                    if (!next[plugin.id]) {
                        const versions = plugin.versions ?? [];
                        const firstAvailable = versions[0] ?? plugin.version;
                        next[plugin.id] = firstAvailable;
                    }
                }
                return next;
            });
        } catch (err) {
            setRegistryError(err instanceof Error ? err.message : String(err));
        } finally {
            setRegistryLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistry();
    }, []);

    const installFromRegistry = async (rp: RegistryPluginRecord, version: string) => {
        if (!projectDir) return;
        setImportError(null);
        setInstallingId(rp.id);
        try {
            const manifestUrl = `${REGISTRY_BASE}/${rp.id}/${version}/plugin.json`;
            const payload = await unwrap(backendClient.installPluginFromUrl(manifestUrl));
            onPluginUpdated(payload);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setInstallingId(null);
        }
    };

    const pickAndImportPlugin = async () => {
        if (!projectDir) return;
        setImportError(null);
        const selected = await open({
            directory: true,
            multiple: false,
            title: "Select plugin folder",
        });
        if (!selected || Array.isArray(selected)) return;
        setImporting(true);
        try {
            const payload = await unwrap(backendClient.upsertProjectPluginFromDir(selected));
            onPluginUpdated(payload);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setImporting(false);
        }
    };

    const pickAndImportPluginZip = async () => {
        if (!projectDir) return;
        setImportError(null);
        const selected = await open({
            directory: false,
            multiple: false,
            filters: [{ name: "Plugin Archive", extensions: ["zip"] }],
            title: "Select plugin archive (.zip)",
        });
        if (!selected || Array.isArray(selected)) return;
        setImporting(true);
        try {
            const payload = await unwrap(backendClient.upsertProjectPluginFromZip(selected));
            onPluginUpdated(payload);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setImporting(false);
        }
    };

    const toggleEnabled = async (plugin: PluginRecord) => {
        setTogglingId(plugin.id);
        try {
            const updated = await unwrap(
                backendClient.setPluginEnabled(plugin.id, !plugin.enabled),
            );
            onPluginUpdated(updated);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 gap-6">
            <div className="flex-shrink-0">
                <h2 className="text-2xl font-semibold mb-1">Manage Plugins</h2>
                <p className="text-sm text-muted-foreground">
                    Install plugins and enable or disable them for this project.
                </p>
            </div>

            {!projectDir && (
                <div className="text-center py-12 text-muted-foreground">
                    Open or create a project to manage plugins.
                </div>
            )}

            {projectDir && loading && (
                <div className="text-center py-12 text-muted-foreground">
                    Loading plugins...
                </div>
            )}

            {projectDir && !loading && error && (
                <div className="text-center py-12 text-red-600 text-sm">{error}</div>
            )}

            {projectDir && !loading && !error && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="button"
                            size="sm"
                            onClick={pickAndImportPlugin}
                            disabled={importing}
                        >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            {importing ? "Loading..." : "Load Folder"}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={pickAndImportPluginZip}
                            disabled={importing}
                        >
                            <Archive className="h-4 w-4 mr-2" />
                            Load ZIP
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Load from folder or .zip archive. Existing plugin IDs are updated in place.
                        </p>
                    </div>

                    {importError ? (
                        <p className="text-sm text-red-600">{importError}</p>
                    ) : null}

                    {plugins.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No plugins installed in this project yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {plugins.map((plugin) => (
                                <div
                                    key={plugin.id}
                                    className="flex items-center justify-between border rounded-lg px-4 py-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Power
                                            className={`h-4 w-4 flex-shrink-0 ${plugin.enabled ? "text-green-500" : "text-muted-foreground"}`}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{plugin.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {plugin.id} · v{plugin.version}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={plugin.enabled}
                                        disabled={togglingId === plugin.id}
                                        onCheckedChange={() => toggleEnabled(plugin)}
                                        className="flex-shrink-0 ml-4"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Registry */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="text-base font-semibold">Available from Registry</h3>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={fetchRegistry}
                                disabled={registryLoading}
                                className="h-6 w-6 p-0"
                                title="Refresh"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${registryLoading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>

                        {registryLoading && (
                            <p className="text-sm text-muted-foreground">Fetching registry…</p>
                        )}
                        {registryError && (
                            <p className="text-sm text-red-600">
                                Could not load registry: {registryError}
                            </p>
                        )}
                        {!registryLoading && !registryError && registry && (
                            <div className="space-y-2">
                                {registry.map((rp) => {
                                    const installed = plugins.find((p) => p.id === rp.id);
                                    const isInstalling = installingId === rp.id;
                                    const versionOptions = (rp.versions ?? []).length > 0
                                        ? (rp.versions ?? [])
                                        : [rp.version];
                                    const selectedVersion = selectedRegistryVersions[rp.id]
                                        ?? versionOptions[0]
                                        ?? rp.version;
                                    const authors = rp.authors ?? [];
                                    return (
                                        <div
                                            key={rp.id}
                                            className="flex items-start justify-between border rounded-lg px-4 py-3 gap-4"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                    <p className="text-sm font-medium">{rp.name}</p>
                                                    <span className="text-xs text-muted-foreground">latest v{rp.version}</span>
                                                    {rp.license && (
                                                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                                            {rp.license}
                                                        </Badge>
                                                    )}
                                                    {installed && (
                                                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600 border-green-600">
                                                            Installed v{installed.version}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {rp.description}
                                                </p>
                                                {authors.length > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        by {authors.map((a) => a.name).join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Select
                                                    value={selectedVersion}
                                                    onValueChange={(version) => {
                                                        setSelectedRegistryVersions((prev) => ({
                                                            ...prev,
                                                            [rp.id]: version,
                                                        }));
                                                    }}
                                                    disabled={isInstalling}
                                                >
                                                    <SelectTrigger className="w-[130px] h-8">
                                                        <SelectValue placeholder="Version" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {versionOptions.map((version) => (
                                                            <SelectItem key={`${rp.id}-${version}`} value={version}>
                                                                v{version}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={installed ? "outline" : "default"}
                                                    disabled={!projectDir || isInstalling}
                                                    onClick={() => installFromRegistry(rp, selectedVersion)}
                                                    className="flex-shrink-0"
                                                >
                                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                                    {isInstalling
                                                        ? "Installing…"
                                                        : installed
                                                            ? "Reinstall"
                                                            : "Install"}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
