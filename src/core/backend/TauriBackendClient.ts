import { invoke } from "@tauri-apps/api/core";
import { BackendClient } from "./types";
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

export class TauriBackendClient extends BackendClient {
  async createProject(name: string, directory: string): Promise<ProjectSummary> {
    try {
      const result = await invoke<string>("create_project", {
        name,
        dirPath: directory,
      });
      return JSON.parse(result) as ProjectSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] createProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to create project");
    }
  }

  async openProject(directory: string, password?: string): Promise<ProjectSummary> {
    try {
      const result = await invoke<string>("open_project", {
        dirPath: directory,
        password: password ?? null,
      });
      return JSON.parse(result) as ProjectSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] openProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to open project");
    }
  }

  async closeProject(): Promise<void> {
    try {
      await invoke("close_project");
    } catch (error: any) {
      console.error("[TauriBackendClient] closeProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to close project");
    }
  }

  async loadSettings(): Promise<ProjectSettingsPayload> {
    try {
      const result = await invoke<string>("load_settings");
      return JSON.parse(result) as ProjectSettingsPayload;
    } catch (error: any) {
      console.error("[TauriBackendClient] loadSettings error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to load settings");
    }
  }

  async updateProjectSettings(
    patch: { theme?: "light" | "dark" | "system" }
  ): Promise<ProjectSettingsRecord> {
    try {
      const result = await invoke<string>("update_project_settings", {
        theme: patch.theme,
      });
      return JSON.parse(result) as ProjectSettingsRecord;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateProjectSettings error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to update project settings"
      );
    }
  }

  async updateProjectName(name: string): Promise<ProjectSummary> {
    try {
      const result = await invoke<string>("update_project_name", { name });
      return JSON.parse(result) as ProjectSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateProjectName error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to update project name");
    }
  }

  async updateProjectPluginSettings(
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<PluginSettingsDescriptor> {
    try {
      const result = await invoke<string>("update_project_plugin_settings", {
        pluginId,
        settingsJson: JSON.stringify(settings),
      });
      return JSON.parse(result) as PluginSettingsDescriptor;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateProjectPluginSettings error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to update plugin settings"
      );
    }
  }

  async createScan(preview?: string): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("create_scan", { preview });
      return JSON.parse(result) as ScanSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] createScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to create scan");
    }
  }

  async listScans(): Promise<ScanSummary[]> {
    try {
      const result = await invoke<string>("list_scans");
      return JSON.parse(result) as ScanSummary[];
    } catch (error: any) {
      console.error("[TauriBackendClient] listScans error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to list scans");
    }
  }

  async getScan(scanId: string): Promise<ScanDetail> {
    try {
      const result = await invoke<string>("get_scan", { scanId });
      return JSON.parse(result) as ScanDetail;
    } catch (error: any) {
      console.error("[TauriBackendClient] getScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to get scan");
    }
  }

  async runScan(
    scanId: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: Record<string, unknown>
  ): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("run_scan", {
        scanId,
        selectedPluginsJson: JSON.stringify(selectedPlugins),
        inputsJson: JSON.stringify(inputs),
      });
      return JSON.parse(result) as ScanSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] runScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to run scan");
    }
  }

  async checkPluginReadiness(
    pluginId: string,
    settingsJson?: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await invoke<string>("check_plugin_readiness", {
        pluginId,
        settingsJson,
      });
      return JSON.parse(result) as { ok: boolean; error?: string };
    } catch (error: any) {
      console.error("[TauriBackendClient] checkPluginReadiness error:", error);
      return { ok: false, error: error?.message ?? error?.toString() ?? "Readiness check failed" };
    }
  }

  async updateScanPreview(scanId: string, preview: string): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("update_scan_preview", { scanId, preview });
      return JSON.parse(result) as ScanSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateScanPreview error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to rename scan");
    }
  }

  async upsertProjectPluginFromDir(
    pluginDir: string,
    replacePluginId?: string
  ): Promise<PluginSettingsDescriptor> {
    try {
      const result = await invoke<string>("upsert_project_plugin_from_dir", {
        pluginDir,
        replacePluginId,
      });
      return JSON.parse(result) as PluginSettingsDescriptor;
    } catch (error: any) {
      console.error("[TauriBackendClient] upsertProjectPluginFromDir error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to load plugin from folder"
      );
    }
  }

  async getProjectLockStatus(directory: string): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("get_project_lock_status", {
        dirPath: directory,
      });
      return JSON.parse(result) as ProjectLockStatus;
    } catch (error: any) {
      console.error("[TauriBackendClient] getProjectLockStatus error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to read lock status");
    }
  }

  async setProjectPassword(newPassword: string): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("set_project_password", { newPassword });
      return JSON.parse(result) as ProjectLockStatus;
    } catch (error: any) {
      console.error("[TauriBackendClient] setProjectPassword error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to set project password");
    }
  }

  async changeProjectPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("change_project_password", {
        currentPassword,
        newPassword,
      });
      return JSON.parse(result) as ProjectLockStatus;
    } catch (error: any) {
      console.error("[TauriBackendClient] changeProjectPassword error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to change project password"
      );
    }
  }

  async removeProjectPassword(currentPassword: string): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("remove_project_password", { currentPassword });
      return JSON.parse(result) as ProjectLockStatus;
    } catch (error: any) {
      console.error("[TauriBackendClient] removeProjectPassword error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to remove project password"
      );
    }
  }
}
