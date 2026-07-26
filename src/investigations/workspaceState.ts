import type {
  ProjectSettingsPayload,
  ScanDetailRecord,
  ScanSummaryRecord,
} from "@/core/backend/bindings";

export interface WorkspaceState {
  settings: ProjectSettingsPayload;
  scans: ScanSummaryRecord[];
  view: "new" | "result";
  selectedScanId: string | null;
  detail: ScanDetailRecord | null;
  pending: "idle" | "loading-result" | "running";
  error: string | null;
}

export type WorkspaceAction =
  | { type: "new-investigation-selected" }
  | { type: "result-loading"; scanId: string }
  | { type: "result-loaded"; detail: ScanDetailRecord }
  | { type: "run-started" }
  | {
      type: "run-completed";
      detail: ScanDetailRecord;
      scans: ScanSummaryRecord[];
      settings: ProjectSettingsPayload;
    }
  | { type: "operation-failed"; error: string }
  | { type: "scans-replaced"; scans: ScanSummaryRecord[] }
  | { type: "settings-replaced"; settings: ProjectSettingsPayload };

export function sortScans(scans: ScanSummaryRecord[]): ScanSummaryRecord[] {
  return [...scans].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function createWorkspaceState(
  settings: ProjectSettingsPayload,
  scans: ScanSummaryRecord[],
): WorkspaceState {
  return {
    settings,
    scans: sortScans(scans),
    view: "new",
    selectedScanId: null,
    detail: null,
    pending: "idle",
    error: null,
  };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "new-investigation-selected":
      return {
        ...state,
        view: "new",
        selectedScanId: null,
        detail: null,
        pending: "idle",
        error: null,
      };
    case "result-loading":
      return {
        ...state,
        view: "result",
        selectedScanId: action.scanId,
        detail: null,
        pending: "loading-result",
        error: null,
      };
    case "result-loaded":
      return {
        ...state,
        view: "result",
        selectedScanId: action.detail.id,
        detail: action.detail,
        pending: "idle",
        error: null,
      };
    case "run-started":
      return { ...state, pending: "running", error: null };
    case "run-completed":
      return {
        ...state,
        settings: action.settings,
        scans: sortScans(action.scans),
        view: "result",
        selectedScanId: action.detail.id,
        detail: action.detail,
        pending: "idle",
        error: null,
      };
    case "operation-failed":
      return { ...state, pending: "idle", error: action.error };
    case "scans-replaced":
      return { ...state, scans: sortScans(action.scans) };
    case "settings-replaced":
      return { ...state, settings: action.settings };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
