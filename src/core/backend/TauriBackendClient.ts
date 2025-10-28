/**
 * Tauri Backend Client (Future Implementation)
 * Will use Tauri IPC for communication with backend
 */

import { BackendClient } from "./types";
import type {
  BackendEvent,
  PluginExecutionResponse,
  PluginStatusResponse,
} from "./types";

export class TauriBackendClient extends BackendClient {
  // TODO: Implement Tauri IPC integration

  executePlugin(
    pluginId: string,
    inputs: Record<string, unknown>
  ): Promise<PluginExecutionResponse> {
    console.log("TauriBackendClient.executePlugin not yet implemented", {
      pluginId,
      inputs,
    });
    throw new Error("TauriBackendClient not yet implemented");
  }

  subscribeToEvents(callback: (event: BackendEvent) => void): void {
    console.log("TauriBackendClient.subscribeToEvents not yet implemented", {
      callback,
    });
    throw new Error("TauriBackendClient not yet implemented");
  }

  async getPluginStatus(pluginId: string): Promise<PluginStatusResponse> {
    console.log("TauriBackendClient.getPluginStatus not yet implemented", {
      pluginId,
    });
    throw new Error("TauriBackendClient not yet implemented");
  }

  unsubscribe(): void {
    throw new Error("TauriBackendClient not yet implemented");
  }
}
