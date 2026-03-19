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
    settings_json: Option<String>,
) -> Result<String, String> {
    let inputs: Value =
        serde_json::from_str(&inputs_json).map_err(|e| format!("Invalid inputs JSON: {}", e))?;
    let settings_override = match settings_json {
        Some(raw) => {
            Some(serde_json::from_str(&raw).map_err(|e| format!("Invalid settings JSON: {}", e))?)
        }
        None => None,
    };

    let result = app::execute_plugin_with_settings(&plugin_id, inputs, settings_override)?;
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
    let project = app_project::create_project(name, dir).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_project(dir_path: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let project = app_project::open_project(dir).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_settings(dir_path: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let snapshot = app_project::load_settings(dir).await?;
    serde_json::to_string(&snapshot).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_project_settings(
    dir_path: String,
    theme: Option<String>,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);

    let settings = app_project::update_project_settings(dir, theme).await?;
    serde_json::to_string(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_project_name(dir_path: String, name: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);

    let project = app_project::update_project_name(dir, name).await?;
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_project_plugin_settings(
    dir_path: String,
    plugin_id: String,
    settings_json: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);

    let settings: Value = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Invalid settings JSON: {}", e))?;

    let payload = app_project::update_project_plugin_settings(dir, plugin_id, settings).await?;
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_scan(dir_path: String, preview: Option<String>) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let scan = app_project::create_scan(dir, preview).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_scans(dir_path: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let scans = app_project::list_scans(dir).await?;
    serde_json::to_string(&scans).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_scan(dir_path: String, scan_id: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let scan = app_project::get_scan(dir, scan_id).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_scan(
    dir_path: String,
    scan_id: String,
    selected_plugins_json: String,
    inputs_json: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let selected_plugins: Vec<String> = serde_json::from_str(&selected_plugins_json)
        .map_err(|e| format!("Invalid selected plugins JSON: {}", e))?;
    let inputs: Value =
        serde_json::from_str(&inputs_json).map_err(|e| format!("Invalid inputs JSON: {}", e))?;

    let scan = app_project::run_scan(dir, scan_id, selected_plugins, inputs).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_scan_preview(
    dir_path: String,
    scan_id: String,
    preview: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let scan = app_project::update_scan_preview(dir, scan_id, preview).await?;
    serde_json::to_string(&scan).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_project_plugin_from_dir(
    dir_path: String,
    plugin_dir: String,
    replace_plugin_id: Option<String>,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let plugin_path = std::path::PathBuf::from(plugin_dir);
    if !plugin_path.exists() || !plugin_path.is_dir() {
        return Err(format!(
            "Plugin directory does not exist: {:?}",
            plugin_path
        ));
    }

    let payload =
        app_project::upsert_project_plugin_from_dir(dir, plugin_path, replace_plugin_id).await?;
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project_lock_status(dir_path: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let status = app_project::get_project_lock_status(dir).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unlock_project(dir_path: String, password: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let status = app_project::unlock_project(dir, password).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_project_password(
    dir_path: String,
    new_password: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let status = app_project::set_project_password(dir, new_password).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn change_project_password(
    dir_path: String,
    current_password: String,
    new_password: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let status = app_project::change_project_password(dir, current_password, new_password).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_project_password(
    dir_path: String,
    current_password: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(dir_path);
    let status = app_project::remove_project_password(dir, current_password).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}
