import type {
  PluginEntrypointSelection,
  PluginRecord,
  PluginRegistryRecord,
  ProjectLockStatus,
  ProjectSettingsPayload,
  ProjectSettingsRecord,
  ProjectSummary,
  ScanDetailRecord,
  ScanEntrypointInput,
  ScanSummaryRecord,
  SettingValue,
} from "@/core/backend/bindings";

export interface OpenRiskClient {
  createProject(name: string, projectPath: string): Promise<ProjectSummary>;
  openProject(projectPath: string, password: string | null): Promise<ProjectSummary>;
  closeProject(): Promise<void>;

  loadSettings(): Promise<ProjectSettingsPayload>;
  updateProjectSettings(
    name: string | null,
    theme: string | null,
    advancedMode: boolean | null,
  ): Promise<ProjectSettingsRecord>;

  setPluginSetting(
    pluginId: string,
    settingName: string,
    value: SettingValue,
  ): Promise<PluginRecord>;
  upsertProjectPluginFromDir(pluginDir: string): Promise<PluginRecord>;
  upsertProjectPluginFromZip(zipPath: string): Promise<PluginRecord>;
  installPluginFromUrl(manifestUrl: string): Promise<PluginRecord>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<PluginRecord>;
  refreshPluginMetrics(pluginId: string): Promise<PluginRecord>;
  getPluginRegistry(): Promise<PluginRegistryRecord>;

  createScan(preview: string | null): Promise<ScanSummaryRecord>;
  listScans(): Promise<ScanSummaryRecord[]>;
  getScan(scanId: string): Promise<ScanDetailRecord>;
  runScan(
    scanId: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
  ): Promise<ScanSummaryRecord>;
  setScanArchived(scanId: string, archived: boolean): Promise<ScanSummaryRecord>;

  createPreviewProject(destPath: string): Promise<void>;
  getProjectLockStatus(projectPath: string): Promise<ProjectLockStatus>;
  setProjectPassword(newPassword: string): Promise<ProjectLockStatus>;
  changeProjectPassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ProjectLockStatus>;
  removeProjectPassword(currentPassword: string): Promise<ProjectLockStatus>;
}
