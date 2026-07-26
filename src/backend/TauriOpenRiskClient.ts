import { commands } from "@/core/backend/bindings";
import { unwrap } from "@/lib/utils";
import type { OpenRiskClient } from "./OpenRiskClient";

export const tauriOpenRiskClient: OpenRiskClient = {
  createProject: (name, projectPath) =>
    unwrap(commands.createProject(name, projectPath)),
  openProject: (projectPath, password) =>
    unwrap(commands.openProject(projectPath, password)),
  closeProject: async () => {
    await unwrap(commands.closeProject());
  },

  loadSettings: () => unwrap(commands.loadSettings()),
  updateProjectSettings: (name, theme, advancedMode) =>
    unwrap(commands.updateProjectSettings(name, theme, advancedMode)),

  setPluginSetting: (pluginId, settingName, value) =>
    unwrap(commands.setPluginSetting(pluginId, settingName, value)),
  upsertProjectPluginFromDir: (pluginDir) =>
    unwrap(commands.upsertProjectPluginFromDir(pluginDir)),
  upsertProjectPluginFromZip: (zipPath) =>
    unwrap(commands.upsertProjectPluginFromZip(zipPath)),
  installPluginFromUrl: (manifestUrl) =>
    unwrap(commands.installPluginFromUrl(manifestUrl)),
  setPluginEnabled: (pluginId, enabled) =>
    unwrap(commands.setPluginEnabled(pluginId, enabled)),
  refreshPluginMetrics: (pluginId) =>
    unwrap(commands.refreshPluginMetrics(pluginId)),
  getPluginRegistry: () => unwrap(commands.getPluginRegistry()),

  createScan: (preview) => unwrap(commands.createScan(preview)),
  listScans: () => unwrap(commands.listScans()),
  getScan: (scanId) => unwrap(commands.getScan(scanId)),
  updateScanDraft: (scanId, selectedPlugins, inputs) =>
    unwrap(commands.updateScanDraft(scanId, selectedPlugins, inputs)),
  runScan: (scanId, selectedPlugins, inputs) =>
    unwrap(commands.runScan(scanId, selectedPlugins, inputs)),
  updateScanPreview: (scanId, preview) =>
    unwrap(commands.updateScanPreview(scanId, preview)),
  setScanArchived: (scanId, archived) =>
    unwrap(commands.setScanArchived(scanId, archived)),
  reorderScans: (orderedScanIds) =>
    unwrap(commands.reorderScans(orderedScanIds)),

  createPreviewProject: async (destPath) => {
    await unwrap(commands.createPreviewProject(destPath));
  },
  getProjectLockStatus: (projectPath) =>
    unwrap(commands.getProjectLockStatus(projectPath)),
  setProjectPassword: (newPassword) =>
    unwrap(commands.setProjectPassword(newPassword)),
  changeProjectPassword: (currentPassword, newPassword) =>
    unwrap(commands.changeProjectPassword(currentPassword, newPassword)),
  removeProjectPassword: (currentPassword) =>
    unwrap(commands.removeProjectPassword(currentPassword)),
};
