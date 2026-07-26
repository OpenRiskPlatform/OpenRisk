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
