use crate::app::plugin as app;
use crate::models::project::Project;
use crate::ActiveProject;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_plugins() -> Result<String, String> {
    let list = app::list_plugins()?;
    serde_json::to_string(&list).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_plugin(plugin_id: String) -> Result<String, String> {
    let detail = app::get_plugin(&plugin_id)?;
    serde_json::to_string(&detail).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_plugin(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    let manifest = app::open_plugin_manifest(&path)?;
    serde_json::to_string(&manifest).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn configure_plugin(plugin_id: String, settings_json: String) -> Result<(), String> {
    let value: Value = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Invalid settings JSON: {}", e))?;
    app::configure_plugin(&plugin_id, value)
}

// TODO: load_local_plugin, load_external_plugin

#[tauri::command]
pub fn execute_plugin(
    plugin_id: String,
    inputs_json: String,
    _settings_json: Option<String>,
) -> Result<String, String> {
    let inputs: Value =
        serde_json::from_str(&inputs_json).map_err(|e| format!("Invalid inputs JSON: {}", e))?;
    let result = app::execute_plugin(&plugin_id, inputs)?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_project(
    project: State<'_, Mutex<ActiveProject>>,
) -> Result<Project, String> {
    let ap = project.lock().unwrap();

    let Some(project_clone) = ap.project.clone() else {
        return Err("No active project".to_string());
    };

    Ok(project_clone)
}
