import { useReducer } from "react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import { tauriOpenRiskClient } from "@/backend/TauriOpenRiskClient";
import {
  isLockedProjectError,
  projectOpenError,
} from "@/backend/errors";
import { appReducer, initialAppState } from "@/app/appState";
import { applyTheme } from "@/app/theme";
import { Workspace } from "@/investigations/Workspace";
import { Launcher } from "@/projects/Launcher";
import { addRecentProject } from "@/projects/recentProjects";
import { UnlockProjectDialog } from "@/projects/UnlockProjectDialog";
import type { ProjectSummary } from "@/core/backend/bindings";

interface AppProps {
  client?: OpenRiskClient;
}

export default function App({ client = tauriOpenRiskClient }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  const loadWorkspace = async (project: ProjectSummary) => {
    try {
      const [settings, scans] = await Promise.all([
        client.loadSettings(),
        client.listScans(),
      ]);
      applyTheme(settings.projectSettings.theme);
      addRecentProject(project.directory);
      dispatch({ type: "workspace-loaded", project, settings, scans });
    } catch (error) {
      // Opening is a two-phase operation. Do not leave the backend holding a
      // project when loading the initial workspace data fails.
      try {
        await client.closeProject();
      } catch {
        // Preserve the original loading error for the user.
      }
      throw error;
    }
  };

  const createProject = async (name: string, projectPath: string) => {
    dispatch({ type: "project-operation-started" });
    try {
      await loadWorkspace(await client.createProject(name, projectPath));
    } catch (error) {
      dispatch({
        type: "project-operation-failed",
        error: projectOpenError(error),
      });
    }
  };

  const openProject = async (projectPath: string) => {
    dispatch({ type: "project-operation-started" });
    try {
      await loadWorkspace(await client.openProject(projectPath, null));
    } catch (error) {
      if (isLockedProjectError(error)) {
        dispatch({ type: "project-unlock-required", projectPath });
        return;
      }
      dispatch({
        type: "project-operation-failed",
        error: projectOpenError(error),
      });
    }
  };

  const unlockProject = async (password: string) => {
    if (state.status !== "unlock") {
      return;
    }
    dispatch({ type: "project-unlock-started" });
    try {
      await loadWorkspace(
        await client.openProject(state.projectPath, password),
      );
    } catch (error) {
      dispatch({
        type: "project-unlock-failed",
        error: projectOpenError(error),
      });
    }
  };

  if (state.status === "workspace") {
    return (
      <Workspace
        client={client}
        initialSettings={state.settings}
        initialScans={state.scans}
        onCloseProject={async () => {
          await client.closeProject();
          dispatch({ type: "project-closed" });
        }}
      />
    );
  }

  return (
    <>
      <Launcher
        pending={state.status === "launcher" ? state.pending : false}
        error={state.status === "launcher" ? state.error : null}
        onCreateProject={createProject}
        onOpenProject={openProject}
      />
      {state.status === "unlock" ? (
        <UnlockProjectDialog
          projectPath={state.projectPath}
          pending={state.pending}
          error={state.error}
          onSubmit={unlockProject}
          onCancel={() => dispatch({ type: "project-unlock-cancelled" })}
        />
      ) : null}
    </>
  );
}
