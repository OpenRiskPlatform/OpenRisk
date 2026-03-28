//! Tauri command handlers for project and scan operations.
//!
//! Each handler deserialises its inputs, delegates to [`crate::app::project`], then
//! serialises the result back to a JSON string for the frontend.

use crate::app::project::{self, PluginEntrypointSelection};
use serde_json::Value;
use std::path::PathBuf;

/// Create a new project database at `dir_path`.
#[tauri::command]
pub async fn create_project(name: String, dir_path: String) -> Result<String, String> {
    let project = project::create_project(name, PathBuf::from(dir_path)).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

/// Open an existing project database at `dir_path`.
#[tauri::command]
pub async fn open_project(dir_path: String) -> Result<String, String> {
    let project = project::open_project(PathBuf::from(dir_path)).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

/// Load the full settings snapshot (project + global settings + all plugin configs).
#[tauri::command]
pub async fn load_settings(dir_path: String) -> Result<String, String> {
    let snapshot = project::load_settings(PathBuf::from(dir_path)).await?;
    serde_json::to_string(&snapshot).map_err(|e| e.to_string())
}

/// Update the project-wide theme setting.
#[tauri::command]
pub async fn update_project_settings(
    dir_path: String,
    theme: Option<String>,
) -> Result<String, String> {
    let settings = project::update_project_settings(PathBuf::from(dir_path), theme).await?;
    serde_json::to_string(&settings).map_err(|e| e.to_string())
}

/// Rename the project.
#[tauri::command]
pub async fn update_project_name(dir_path: String, name: String) -> Result<String, String> {
    let project = project::update_project_name(PathBuf::from(dir_path), name).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

/// Persist updated settings for one plugin within this project.
#[tauri::command]
pub async fn update_project_plugin_settings(
    dir_path: String,
    plugin_id: String,
    settings_json: String,
) -> Result<String, String> {
    let settings: Value = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Invalid settings JSON: {}", e))?;
    let payload =
        project::update_project_plugin_settings(PathBuf::from(dir_path), plugin_id, settings)
            .await?;
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

/// Register or refresh a plugin from a directory on disk into this project.
#[tauri::command]
pub async fn upsert_project_plugin_from_dir(
    dir_path: String,
    plugin_dir: String,
    replace_plugin_id: Option<String>,
) -> Result<String, String> {
    let plugin_path = PathBuf::from(&plugin_dir);
    if !plugin_path.exists() || !plugin_path.is_dir() {
        return Err(format!(
            "Plugin directory does not exist: {:?}",
            plugin_path
        ));
    }
    let payload = project::upsert_project_plugin_from_dir(
        PathBuf::from(dir_path),
        plugin_path,
        replace_plugin_id,
    )
    .await?;
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

/// Create a new scan in Draft status.
#[tauri::command]
pub async fn create_scan(dir_path: String, preview: Option<String>) -> Result<String, String> {
    let scan = project::create_scan(PathBuf::from(dir_path), preview).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

/// List all scans for the project, newest first.
#[tauri::command]
pub async fn list_scans(dir_path: String) -> Result<String, String> {
    let scans = project::list_scans(PathBuf::from(dir_path)).await?;
    serde_json::to_string(&scans).map_err(|e| e.to_string())
}

/// Fetch full details of a single scan including all plugin results.
#[tauri::command]
pub async fn get_scan(dir_path: String, scan_id: String) -> Result<String, String> {
    let scan = project::get_scan(PathBuf::from(dir_path), scan_id).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

/// Execute a scan: run the selected plugins and persist results.
#[tauri::command]
pub async fn run_scan(
    dir_path: String,
    scan_id: String,
    selected_plugins_json: String,
    inputs_json: String,
) -> Result<String, String> {
    let selected_plugins: Vec<PluginEntrypointSelection> =
        serde_json::from_str(&selected_plugins_json)
            .map_err(|e| format!("Invalid selected plugins JSON: {}", e))?;
    let inputs: Value =
        serde_json::from_str(&inputs_json).map_err(|e| format!("Invalid inputs JSON: {}", e))?;
    let scan =
        project::run_scan(PathBuf::from(dir_path), scan_id, selected_plugins, inputs).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

/// Update the preview (display name) of a scan.
#[tauri::command]
pub async fn update_scan_preview(
    dir_path: String,
    scan_id: String,
    preview: String,
) -> Result<String, String> {
    let scan = project::update_scan_preview(PathBuf::from(dir_path), scan_id, preview).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}
