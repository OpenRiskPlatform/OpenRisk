import type {
  ProjectSettingsPayload,
  ScanDetailRecord,
  ScanSummaryRecord,
} from "@/core/backend/bindings";

export interface WorkspaceState {
  settings: ProjectSettingsPayload;
  scans: ScanSummaryRecord[];
  view: "form" | "result";
  formGeneration: number;
  selectedScanId: string | null;
  detail: ScanDetailRecord | null;
  loadingScanId: string | null;
  runningScanIds: string[];
  draftSaveStatus: "idle" | "saving" | "saved";
  error: string | null;
}

export type WorkspaceAction =
  | { type: "new-investigation-selected" }
  | { type: "scan-loading"; scanId: string }
  | { type: "scan-loaded"; detail: ScanDetailRecord }
  | { type: "draft-save-started" }
  | {
      type: "draft-saved";
      summary: ScanSummaryRecord;
      detail: ScanDetailRecord;
      activate: boolean;
      reveal: boolean;
    }
  | {
      type: "run-started";
      summary: ScanSummaryRecord;
      detail: ScanDetailRecord;
      activate: boolean;
    }
  | {
      type: "run-completed";
      detail: ScanDetailRecord;
      scans: ScanSummaryRecord[];
      settings: ProjectSettingsPayload;
    }
  | {
      type: "run-failed";
      scanId: string;
      detail: ScanDetailRecord | null;
      scans: ScanSummaryRecord[];
      error: string;
    }
  | { type: "operation-failed"; error: string }
  | { type: "scan-summary-updated"; summary: ScanSummaryRecord }
  | { type: "scans-replaced"; scans: ScanSummaryRecord[] }
  | { type: "settings-replaced"; settings: ProjectSettingsPayload };

export function sortScans(scans: ScanSummaryRecord[]): ScanSummaryRecord[] {
  return [...scans].sort(
    (left, right) =>
      Number(left.isArchived) - Number(right.isArchived) ||
      left.sortOrder - right.sortOrder ||
      right.createdAt.localeCompare(left.createdAt),
  );
}

function upsertScan(
  scans: ScanSummaryRecord[],
  summary: ScanSummaryRecord,
): ScanSummaryRecord[] {
  const exists = scans.some((scan) => scan.id === summary.id);
  return sortScans(
    exists
      ? scans.map((scan) => (scan.id === summary.id ? summary : scan))
      : [summary, ...scans],
  );
}

export function createWorkspaceState(
  settings: ProjectSettingsPayload,
  scans: ScanSummaryRecord[],
): WorkspaceState {
  return {
    settings,
    scans: sortScans(scans),
    view: "form",
    formGeneration: 0,
    selectedScanId: null,
    detail: null,
    loadingScanId: null,
    runningScanIds: scans
      .filter((scan) => scan.status === "Running")
      .map((scan) => scan.id),
    draftSaveStatus: "idle",
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
        view: "form",
        formGeneration: state.formGeneration + 1,
        selectedScanId: null,
        detail: null,
        loadingScanId: null,
        draftSaveStatus: "idle",
        error: null,
      };
    case "scan-loading":
      return {
        ...state,
        selectedScanId: action.scanId,
        detail: null,
        loadingScanId: action.scanId,
        draftSaveStatus: "idle",
        error: null,
      };
    case "scan-loaded":
      return {
        ...state,
        view: action.detail.status === "Draft" ? "form" : "result",
        selectedScanId: action.detail.id,
        detail: action.detail,
        loadingScanId: null,
        draftSaveStatus:
          action.detail.status === "Draft" ? "saved" : "idle",
        error: null,
      };
    case "draft-save-started":
      return { ...state, draftSaveStatus: "saving", error: null };
    case "draft-saved":
      return {
        ...state,
        scans:
          action.reveal ||
          state.scans.some((scan) => scan.id === action.summary.id)
            ? upsertScan(state.scans, action.summary)
            : state.scans,
        ...(action.activate
          ? {
              view: "form" as const,
              selectedScanId: action.detail.id,
              detail: action.detail,
              draftSaveStatus: "saved" as const,
            }
          : {}),
      };
    case "run-started":
      return {
        ...state,
        scans: upsertScan(state.scans, action.summary),
        ...(action.activate
          ? {
              view: "result" as const,
              selectedScanId: action.detail.id,
              detail: action.detail,
              loadingScanId: null,
            }
          : {}),
        runningScanIds: Array.from(
          new Set([...state.runningScanIds, action.summary.id]),
        ),
        draftSaveStatus: "idle",
        error: null,
      };
    case "run-completed": {
      const selected = state.selectedScanId === action.detail.id;
      return {
        ...state,
        settings: action.settings,
        scans: sortScans(action.scans),
        ...(selected
          ? {
              view: "result" as const,
              detail: action.detail,
              loadingScanId: null,
            }
          : {}),
        runningScanIds: state.runningScanIds.filter(
          (scanId) => scanId !== action.detail.id,
        ),
        error: null,
      };
    }
    case "run-failed": {
      const selected = state.selectedScanId === action.scanId;
      return {
        ...state,
        scans: sortScans(action.scans),
        ...(selected && action.detail
          ? {
              view: "result" as const,
              detail: action.detail,
              loadingScanId: null,
            }
          : {}),
        runningScanIds: state.runningScanIds.filter(
          (scanId) => scanId !== action.scanId,
        ),
        error: selected ? action.error : state.error,
      };
    }
    case "operation-failed":
      return {
        ...state,
        loadingScanId: null,
        draftSaveStatus: "idle",
        error: action.error,
      };
    case "scan-summary-updated":
      return {
        ...state,
        scans: upsertScan(state.scans, action.summary),
        detail:
          state.detail?.id === action.summary.id
            ? { ...state.detail, preview: action.summary.preview }
            : state.detail,
        error: null,
      };
    case "scans-replaced":
      return {
        ...state,
        scans: sortScans(action.scans),
        runningScanIds: action.scans
          .filter((scan) => scan.status === "Running")
          .map((scan) => scan.id),
      };
    case "settings-replaced":
      return { ...state, settings: action.settings };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
