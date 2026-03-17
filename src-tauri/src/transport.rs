use crate::app::plugin as app;
use crate::app::project as app_project;
use serde_json::Value;
use std::path::PathBuf;

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

// plugins

// Project
// pub fn change_plugin_settings(project_name: String, settings_json: String) -> Result<(), String> {
//     crate::app::plugin::configure_plugin(&plugin_id, settings)
// }

#[tauri::command]
pub async fn create_project(name: String, dir_path: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    if dir.exists() && !dir.is_dir() {
        return Err(format!("Path exists and is not a directory: {:?}", dir));
    }
    let project = app_project::create_project(name, dir).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_project(dir_path: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Project directory does not exist: {:?}", dir));
    }
    let project = app_project::open_project(dir).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_settings(dir_path: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Project directory does not exist: {:?}", dir));
    }
    let snapshot = app_project::load_settings(dir).await?;
    serde_json::to_string(&snapshot).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_project_settings(
    dir_path: String,
    theme: Option<String>,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Project directory does not exist: {:?}", dir));
    }

    let settings = app_project::update_project_settings(dir, theme).await?;
    serde_json::to_string(&settings).map_err(|e| e.to_string())
}
