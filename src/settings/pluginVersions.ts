const REGISTRY_BASE =
  "https://raw.githubusercontent.com/OpenRiskPlatform/plugins/main";

export function pluginManifestUrl(pluginId: string, version: string): string {
  return `${REGISTRY_BASE}/${pluginId}/${version}/plugin.json`;
}

export function pluginVersionAction(
  installedVersion: string | null,
  latestVersion: string,
  selectedVersion: string,
): "Install" | "Update" | "Reinstall" | "Change version" {
  if (!installedVersion) {
    return "Install";
  }
  if (selectedVersion === installedVersion) {
    return "Reinstall";
  }
  if (selectedVersion === latestVersion) {
    return "Update";
  }
  return "Change version";
}
