import type {
  PdfExportReceipt,
  PdfExportSelection,
  PluginEntrypointSelection,
  PluginRecord,
  PluginRegistryRecord,
  ProjectLockStatus,
  ProjectSettingsPayload,
  ProjectSettingsRecord,
  ProjectSummary,
  ReportProfile,
  ScanDetailRecord,
  ScanEntrypointInput,
  ScanSummaryRecord,
  SettingValue,
} from "@/core/backend/bindings";

export interface OpenRiskClient {
  pluginInstallationEnabled(): Promise<boolean>;
  createProject(name: string, projectPath: string): Promise<ProjectSummary>;
  openProject(projectPath: string, password: string | null): Promise<ProjectSummary>;
  closeProject(): Promise<void>;

  loadSettings(): Promise<ProjectSettingsPayload>;
  updateProjectSettings(
    name: string | null,
    theme: string | null,
    advancedMode: boolean | null,
    interruptedScanPolicy: string | null,
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
  exportScanPdf(
    scanId: string,
    destPath: string,
    profile: ReportProfile,
    selection: PdfExportSelection | null,
  ): Promise<PdfExportReceipt>;
  updateScanDraft(
    scanId: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
  ): Promise<ScanSummaryRecord>;
  runScan(
    scanId: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
  ): Promise<ScanSummaryRecord>;
  updateScanPreview(scanId: string, preview: string): Promise<ScanSummaryRecord>;
  setScanArchived(scanId: string, archived: boolean): Promise<ScanSummaryRecord>;
  reorderScans(orderedScanIds: string[]): Promise<ScanSummaryRecord[]>;

  createPreviewProject(destPath: string): Promise<void>;
  getProjectLockStatus(projectPath: string): Promise<ProjectLockStatus>;
  setProjectPassword(newPassword: string): Promise<ProjectLockStatus>;
  changeProjectPassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ProjectLockStatus>;
  removeProjectPassword(currentPassword: string): Promise<ProjectLockStatus>;
}
