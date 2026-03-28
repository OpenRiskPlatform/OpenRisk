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

  async openProject(directory: string): Promise<ProjectSummary> {
    try {
      const result = await invoke<string>("open_project", {
        dirPath: directory,
      });
      return JSON.parse(result) as ProjectSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] openProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to open project");
    }
  }

  async loadSettings(directory: string): Promise<ProjectSettingsPayload> {
    try {
      const result = await invoke<string>("load_settings", {
        dirPath: directory,
      });
      return JSON.parse(result) as ProjectSettingsPayload;
    } catch (error: any) {
      console.error("[TauriBackendClient] loadSettings error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to load settings");
    }
  }

  async updateProjectSettings(
    directory: string,
    patch: { theme?: "light" | "dark" | "system" }
  ): Promise<ProjectSettingsRecord> {
    try {
      const result = await invoke<string>("update_project_settings", {
        dirPath: directory,
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

  async updateProjectName(directory: string, name: string): Promise<ProjectSummary> {
    try {
      const result = await invoke<string>("update_project_name", {
        dirPath: directory,
        name,
      });
      return JSON.parse(result) as ProjectSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateProjectName error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to update project name");
    }
  }

  async updateProjectPluginSettings(
    directory: string,
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<PluginSettingsDescriptor> {
    try {
      const result = await invoke<string>("update_project_plugin_settings", {
        dirPath: directory,
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

  async createScan(directory: string, preview?: string): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("create_scan", {
        dirPath: directory,
        preview,
      });
      return JSON.parse(result) as ScanSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] createScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to create scan");
    }
  }

  async listScans(directory: string): Promise<ScanSummary[]> {
    try {
      const result = await invoke<string>("list_scans", {
        dirPath: directory,
      });
      return JSON.parse(result) as ScanSummary[];
    } catch (error: any) {
      console.error("[TauriBackendClient] listScans error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to list scans");
    }
  }

  async getScan(directory: string, scanId: string): Promise<ScanDetail> {
    try {
      const result = await invoke<string>("get_scan", {
        dirPath: directory,
        scanId,
      });
      return JSON.parse(result) as ScanDetail;
    } catch (error: any) {
      console.error("[TauriBackendClient] getScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to get scan");
    }
  }

  async runScan(
    directory: string,
    scanId: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: Record<string, unknown>
  ): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("run_scan", {
        dirPath: directory,
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

  async updateScanPreview(
    directory: string,
    scanId: string,
    preview: string
  ): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("update_scan_preview", {
        dirPath: directory,
        scanId,
        preview,
      });
      return JSON.parse(result) as ScanSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateScanPreview error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to rename scan");
    }
  }

  async upsertProjectPluginFromDir(
    directory: string,
    pluginDir: string,
    replacePluginId?: string
  ): Promise<PluginSettingsDescriptor> {
    try {
      const result = await invoke<string>("upsert_project_plugin_from_dir", {
        dirPath: directory,
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

  async unlockProject(directory: string, password: string): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("unlock_project", {
        dirPath: directory,
        password,
      });
      return JSON.parse(result) as ProjectLockStatus;
    } catch (error: any) {
      console.error("[TauriBackendClient] unlockProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to unlock project");
    }
  }

  async setProjectPassword(
    directory: string,
    newPassword: string
  ): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("set_project_password", {
        dirPath: directory,
        newPassword,
      });
      return JSON.parse(result) as ProjectLockStatus;
    } catch (error: any) {
      console.error("[TauriBackendClient] setProjectPassword error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to set project password");
    }
  }

  async changeProjectPassword(
    directory: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("change_project_password", {
        dirPath: directory,
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

  async removeProjectPassword(
    directory: string,
    currentPassword: string
  ): Promise<ProjectLockStatus> {
    try {
      const result = await invoke<string>("remove_project_password", {
        dirPath: directory,
        currentPassword,
      });
      return JSON.parse(result) as ProjectLockStatus;
    } catch (error: any) {
      console.error("[TauriBackendClient] removeProjectPassword error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to remove project password"
      );
    }
  }
}
