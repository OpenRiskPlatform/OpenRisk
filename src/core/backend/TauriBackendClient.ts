import { BackendClient } from "./types";
import { commands } from "./bindings";
import type {
  PluginEntrypointSelection,
  ScanDetail,
  ScanSummary,
  PluginSettingsDescriptor,
  ProjectSettingsRecord,
  ProjectLockStatus,
  ProjectSummary,
  ProjectSettingsPayload,
} from "./types";

/** Unwrap a tauri-specta result, throwing on error. */
async function unwrap<T>(
  call: Promise<{ status: "ok"; data: T } | { status: "error"; error: string }>
): Promise<T> {
  const result = await call;
  if (result.status === "error") throw new Error(result.error);
  return result.data;
}

export class TauriBackendClient extends BackendClient {
  async createProject(name: string, projectPath: string): Promise<ProjectSummary> {
    return unwrap(commands.createProject(name, projectPath));
  }

  async openProject(projectPath: string, password?: string): Promise<ProjectSummary> {
    return unwrap(commands.openProject(projectPath, password ?? null));
  }

  async closeProject(): Promise<void> {
    await unwrap(commands.closeProject());
  }

  async loadSettings(): Promise<ProjectSettingsPayload> {
    return unwrap(commands.loadSettings()) as Promise<ProjectSettingsPayload>;
  }

  async updateProjectSettings(
    patch: { theme?: "light" | "dark" | "system" }
  ): Promise<ProjectSettingsRecord> {
    return unwrap(commands.updateProjectSettings(patch.theme ?? null)) as unknown as Promise<ProjectSettingsRecord>;
  }

  async updateProjectName(name: string): Promise<ProjectSummary> {
    return unwrap(commands.updateProjectName(name));
  }

  async updateProjectPluginSettings(
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<PluginSettingsDescriptor> {
    return unwrap(commands.updateProjectPluginSettings(pluginId, settings as any)) as Promise<PluginSettingsDescriptor>;
  }

  async createScan(preview?: string): Promise<ScanSummary> {
    return unwrap(commands.createScan(preview ?? null)) as unknown as Promise<ScanSummary>;
  }

  async listScans(): Promise<ScanSummary[]> {
    return unwrap(commands.listScans()) as Promise<ScanSummary[]>;
  }

  async getScan(scanId: string): Promise<ScanDetail> {
    return unwrap(commands.getScan(scanId)) as unknown as Promise<ScanDetail>;
  }

  async runScan(
    scanId: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: Record<string, unknown>
  ): Promise<ScanSummary> {
    return unwrap(commands.runScan(scanId, selectedPlugins, inputs as any)) as unknown as Promise<ScanSummary>;
  }

  async checkPluginReadiness(
    pluginId: string,
    settingsJson?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const settings = settingsJson ? JSON.parse(settingsJson) : null;
    const result = await unwrap(commands.checkPluginReadiness(pluginId, settings as any));
    return result as unknown as { ok: boolean; error?: string };
  }

  async updateScanPreview(scanId: string, preview: string): Promise<ScanSummary> {
    return unwrap(commands.updateScanPreview(scanId, preview)) as unknown as Promise<ScanSummary>;
  }

  async upsertProjectPluginFromDir(
    pluginDir: string,
    replacePluginId?: string
  ): Promise<PluginSettingsDescriptor> {
    return unwrap(commands.upsertProjectPluginFromDir(pluginDir, replacePluginId ?? null)) as Promise<PluginSettingsDescriptor>;
  }

  async getProjectLockStatus(projectPath: string): Promise<ProjectLockStatus> {
    return unwrap(commands.getProjectLockStatus(projectPath));
  }

  async setProjectPassword(newPassword: string): Promise<ProjectLockStatus> {
    return unwrap(commands.setProjectPassword(newPassword));
  }

  async changeProjectPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ProjectLockStatus> {
    return unwrap(commands.changeProjectPassword(currentPassword, newPassword));
  }

  async removeProjectPassword(currentPassword: string): Promise<ProjectLockStatus> {
    return unwrap(commands.removeProjectPassword(currentPassword));
  }
}

