import { describe, expect, it } from "vitest";
import {
  appReducer,
  initialAppState,
  type AppState,
} from "@/app/appState";
import { projectSettings } from "./fixtures";

describe("appReducer", () => {
  it("starts at the launcher and does not auto-open a project", () => {
    expect(initialAppState).toEqual({
      status: "launcher",
      pending: false,
      error: null,
    });
  });

  it("enters a loaded workspace only after explicit data is supplied", () => {
    const opening = appReducer(initialAppState, {
      type: "project-operation-started",
    });
    const workspace = appReducer(opening, {
      type: "workspace-loaded",
      project: projectSettings.project,
      settings: projectSettings,
      scans: [],
    });

    expect(workspace.status).toBe("workspace");
  });

  it("keeps unlock as an explicit state", () => {
    const state: AppState = appReducer(initialAppState, {
      type: "project-unlock-required",
      projectPath: "/tmp/encrypted.orproj",
    });

    expect(state).toMatchObject({
      status: "unlock",
      projectPath: "/tmp/encrypted.orproj",
      pending: false,
    });
  });
});
