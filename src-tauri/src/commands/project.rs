//! Tauri command handlers for project and scan operations.
//!
//! All handlers obtain the active project from Tauri managed [`ProjectState`] rather than
//! accepting a `dir_path` parameter per call. Two exceptions: [`create_project`] and
//! [`open_project`] which establish the session and store the instance in state.
//! [`close_project`] tears down the session and drops the connection.

use crate::app::project::{
    PluginEntrypointSelection, ProjectPersistence, SqliteProjectPersistence,
};
use crate::ProjectState;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Retrieve the open project from state, returning a clear error when none is open.
async fn get_open_project(
    state: &tauri::State<'_, ProjectState>,
) -> Result<Arc<SqliteProjectPersistence>, String> {
    state
        .lock()
        .await
        .clone()
        .ok_or_else(|| "No project is open. Call open_project or create_project first.".to_string())
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/// Create a new project database at `dir_path` and open it as the active project.
#[tauri::command]
pub async fn create_project(
    name: String,
    dir_path: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let (summary, persistence) = SqliteProjectPersistence::create(&name, &PathBuf::from(dir_path))
        .await
        .map_err(|e| e.to_string())?;
    *state.lock().await = Some(Arc::new(persistence));
    serde_json::to_string(&summary).map_err(|e| e.to_string())
}

/// Open an existing project at `dir_path` as the active project.
///
/// Pass `password` when the database is encrypted. This also covers the unlock flow:
/// if a previous `open_project` returned a lock error, call again with the password.
#[tauri::command]
pub async fn open_project(
    dir_path: String,
    password: Option<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let path = PathBuf::from(dir_path);
    let (summary, persistence) = match password {
        Some(pw) => SqliteProjectPersistence::open_with_password(&path, pw).await,
        None => SqliteProjectPersistence::open(&path).await,
    }
    .map_err(|e| e.to_string())?;
    *state.lock().await = Some(Arc::new(persistence));
    serde_json::to_string(&summary).map_err(|e| e.to_string())
}

/// Close the active project and release its database connection.
#[tauri::command]
pub async fn close_project(state: tauri::State<'_, ProjectState>) -> Result<(), String> {
    *state.lock().await = None;
    Ok(())
}

// ---------------------------------------------------------------------------
// Project settings
// ---------------------------------------------------------------------------

/// Load the full settings snapshot (project + global settings + all plugin configs).
#[tauri::command]
pub async fn load_settings(state: tauri::State<'_, ProjectState>) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let snapshot = project.load_settings().await.map_err(|e| e.to_string())?;
    serde_json::to_string(&snapshot).map_err(|e| e.to_string())
}

/// Update the project-wide theme setting.
#[tauri::command]
pub async fn update_project_settings(
    theme: Option<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let settings = project
        .update_project_settings(theme)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&settings).map_err(|e| e.to_string())
}

/// Rename the active project.
#[tauri::command]
pub async fn update_project_name(
    name: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let summary = project
        .update_project_name(&name)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&summary).map_err(|e| e.to_string())
}

/// Persist updated settings for one plugin within the active project.
#[tauri::command]
pub async fn update_project_plugin_settings(
    plugin_id: String,
    settings_json: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let settings: Value = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Invalid settings JSON: {}", e))?;
    let project = get_open_project(&state).await?;
    let payload = project
        .update_project_plugin_settings(&plugin_id, settings)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

/// Register or refresh a plugin from a directory on disk into the active project.
#[tauri::command]
pub async fn upsert_project_plugin_from_dir(
    plugin_dir: String,
    replace_plugin_id: Option<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let payload = project
        .upsert_project_plugin_from_dir(&PathBuf::from(plugin_dir), replace_plugin_id)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

/// Create a new scan in Draft status.
#[tauri::command]
pub async fn create_scan(
    preview: Option<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let scan = project
        .create_scan(preview)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

/// List all scans for the active project, newest first.
#[tauri::command]
pub async fn list_scans(state: tauri::State<'_, ProjectState>) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let scans = project.list_scans().await.map_err(|e| e.to_string())?;
    serde_json::to_string(&scans).map_err(|e| e.to_string())
}

/// Fetch full details of a single scan including all plugin results.
#[tauri::command]
pub async fn get_scan(
    scan_id: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let scan = project
        .get_scan(&scan_id)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

/// Execute a scan: run the selected plugins and persist results.
///
/// Plugin code is read from the database (synced on project open), not from disk.
#[tauri::command]
pub async fn run_scan(
    scan_id: String,
    selected_plugins_json: String,
    inputs_json: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let selected_plugins: Vec<PluginEntrypointSelection> =
        serde_json::from_str(&selected_plugins_json)
            .map_err(|e| format!("Invalid selected_plugins JSON: {}", e))?;
    let inputs: Value =
        serde_json::from_str(&inputs_json).map_err(|e| format!("Invalid inputs JSON: {}", e))?;
    let project = get_open_project(&state).await?;
    let scan = project
        .run_scan(&scan_id, selected_plugins, inputs)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

/// Update the preview (display name) of a scan.
#[tauri::command]
pub async fn update_scan_preview(
    scan_id: String,
    preview: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = get_open_project(&state).await?;
    let scan = project
        .update_scan_preview(&scan_id, preview)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}
