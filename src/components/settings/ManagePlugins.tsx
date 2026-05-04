import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Archive, Download, RefreshCw, Package } from "lucide-react";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Spinner } from "../ui/spinner";

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
            setSelectedRegistryVersions((prev) => {
                const next = { ...prev };
                delete next[rp.id];
                return next;
            });
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
                    {plugins.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/60" aria-hidden="true" />
                            No plugins installed in this project yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {plugins.map((plugin) => (
                                <div
                                    key={plugin.id}
                                    className="flex items-center border rounded-lg px-4 py-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Switch
                                            checked={plugin.enabled}
                                            disabled={togglingId === plugin.id}
                                            onCheckedChange={() => toggleEnabled(plugin)}
                                            className="flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{plugin.name}</p>
                                            <p className="text-xs text-base truncate">
                                                {plugin.id} · v{plugin.version}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <h3 className="text-base font-semibold">Import external plugins</h3>

                    {importError ? (
                        <p className="text-sm text-red-600">{importError}</p>
                    ) : null}

                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={pickAndImportPlugin}
                            disabled={importing}
                            className="flex-1"
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
                            className="flex-1"
                        >
                            <Archive className="h-4 w-4 mr-2" />
                            Load ZIP
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Load from folder or .zip archive. Existing plugin IDs are updated in place.
                        </p>
                    </div>

                    <div className="flex justify-center text-xs text-muted-foreground">
                        <div className="flex items-center gap-3 w-full max-w-sm">
                            <Separator className="flex-1" />
                            <span className="uppercase tracking-wide">or</span>
                            <Separator className="flex-1" />
                        </div>
                    </div>

                    {/* Registry */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="text-base font-semibold">Install from Registry</h3>
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
                            <div className="flex justify-center gap-2 text-muted-foreground">
                                <Spinner />
                                Fetching registry...
                            </div>
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
                                    const latestVersion = rp.version;
                                    const versionOptions = Array.from(
                                        new Set([
                                            ...(((rp.versions ?? []).length > 0 ? rp.versions ?? [] : [rp.version]).filter(Boolean)),
                                            ...(installed?.version ? [installed.version] : []),
                                        ]),
                                    );
                                    const selectedVersion = selectedRegistryVersions[rp.id]
                                        ?? installed?.version
                                        ?? latestVersion;
                                    const installedVersion = installed?.version
                                    const authors = rp.authors ?? [];
                                    return (
                                        <div
                                            key={rp.id}
                                            className="flex items-start justify-between border rounded-lg px-4 py-3 gap-4"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-medium">{rp.name}</p>
                                                    {installed && (
                                                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600 border-green-600">
                                                            Installed
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                                    <p className="text-xs text-base">
                                                    {installed
                                                    ? `${installed.id} · v${installed.version}${installed.version === latestVersion ? " (latest)" : ""}`
                                                    : `${rp.id}`}</p>
                                                    {rp.license && (
                                                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                                            {rp.license}
                                                        </Badge>
                                                    )}
                                                </div>

                                                {authors.map((author) => (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Publisher: {author.name}
                                                    </p>
                                                ))}

                                                <p className="text-xs text-muted-foreground mt-4 line-clamp-2">
                                                    {rp.description}
                                                </p>
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
                                                                v{version}{version === latestVersion ? " (latest)" : version === installedVersion ? " (current)" : ""}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={selectedVersion === installedVersion ? "outline" : "default"}
                                                    disabled={!projectDir || isInstalling}
                                                    onClick={() => installFromRegistry(rp, selectedVersion)}
                                                    className="justify-center"
                                                >
                                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                                    {isInstalling
                                                        ? "Installing…"
                                                        : selectedVersion === installedVersion
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
