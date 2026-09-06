import type {
  ProjectSettingsPayload,
  ProjectSummary,
  ScanSummaryRecord,
} from "@/core/backend/bindings";

export type AppState =
  | {
      status: "launcher";
      pending: boolean;
      error: string | null;
    }
  | {
      status: "unlock";
      pending: boolean;
      error: string | null;
      projectPath: string;
    }
  | {
      status: "workspace";
      pending: false;
      error: null;
      project: ProjectSummary;
      settings: ProjectSettingsPayload;
      scans: ScanSummaryRecord[];
      pluginInstallationEnabled: boolean;
    };

export type AppAction =
  | { type: "project-operation-started" }
  | { type: "project-unlock-required"; projectPath: string }
  | { type: "project-unlock-started" }
  | { type: "project-unlock-failed"; error: string }
  | { type: "project-unlock-cancelled" }
  | { type: "project-operation-failed"; error: string }
  | {
      type: "workspace-loaded";
      project: ProjectSummary;
      settings: ProjectSettingsPayload;
      scans: ScanSummaryRecord[];
      pluginInstallationEnabled: boolean;
    }
  | { type: "project-closed" };

export const initialAppState: AppState = {
  status: "launcher",
  pending: false,
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "project-operation-started":
      return { status: "launcher", pending: true, error: null };
    case "project-unlock-required":
      return {
        status: "unlock",
        pending: false,
        error: null,
        projectPath: action.projectPath,
      };
    case "project-unlock-started":
      if (state.status !== "unlock") {
        return state;
      }
      return { ...state, pending: true, error: null };
    case "project-unlock-failed":
      if (state.status !== "unlock") {
        return state;
      }
      return { ...state, pending: false, error: action.error };
    case "project-unlock-cancelled":
      return initialAppState;
    case "project-operation-failed":
      return {
        status: "launcher",
        pending: false,
        error: action.error,
      };
    case "workspace-loaded":
      return {
        status: "workspace",
        pending: false,
        error: null,
        project: action.project,
        settings: action.settings,
        scans: action.scans,
        pluginInstallationEnabled: action.pluginInstallationEnabled,
      };
    case "project-closed":
      return initialAppState;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
