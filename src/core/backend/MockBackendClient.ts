/**
 * Mock Backend Client Implementation
 * Simulates backend communication for development/testing
 */

import { BackendClient, PluginStatus } from "./types";
import type {
  BackendEvent,
  PluginExecutionResponse,
  PluginStatusResponse,
} from "./types";

export class MockBackendClient extends BackendClient {
  private eventCallbacks: Array<(event: BackendEvent) => void> = [];
  private pluginStatuses: Map<string, PluginStatus> = new Map();

  executePlugin(
    pluginId: string,
    inputs: Record<string, unknown>
  ): Promise<PluginExecutionResponse> {
    // Simulate async execution
    return new Promise((resolve) => {
      this.pluginStatuses.set(pluginId, PluginStatus.Running);

      // Emit started event
      this.emitEvent({
        type: "plugin.execution.started",
        timestamp: new Date(),
        payload: { pluginId, inputs },
      });

      // Simulate processing delay
      setTimeout(() => {
        // Mock success response with sample data
        const mockData = {
          pluginId,
          results: [
            {
              name: `${inputs.name || "Unknown"}`,
              riskScore: Math.floor(Math.random() * 100),
              matches: Math.floor(Math.random() * 5),
              timestamp: new Date().toISOString(),
            },
          ],
        };

        this.pluginStatuses.set(pluginId, PluginStatus.Completed);

        // Emit completed event
        this.emitEvent({
          type: "plugin.execution.completed",
          timestamp: new Date(),
          payload: { pluginId, data: mockData },
        });

        resolve({
          success: true,
          data: mockData,
        });
      }, 1500); // 1.5 second delay
    });
  }

  subscribeToEvents(callback: (event: BackendEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  async getPluginStatus(pluginId: string): Promise<PluginStatusResponse> {
    const status = this.pluginStatuses.get(pluginId) || PluginStatus.Idle;

    return {
      pluginId,
      status,
      lastExecuted: status !== PluginStatus.Idle ? new Date() : undefined,
    };
  }

  unsubscribe(): void {
    this.eventCallbacks = [];
    this.pluginStatuses.clear();
  }

  private emitEvent(event: BackendEvent): void {
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in event callback:", error);
      }
    });
  }
}
