//! Tauri command handlers for built-in plugin operations.
//!
//! Each handler deserialises its inputs, delegates to [`crate::app::plugin`], then
//! serialises the result back to a JSON string for the frontend.

use crate::app::plugin;
use serde_json::Value;
use std::path::PathBuf;

/// List all installed built-in plugins.
#[tauri::command]
pub fn list_plugins() -> Result<String, String> {
    let list = plugin::list_plugins()?;
    serde_json::to_string(&list).map_err(|e| e.to_string())
}

/// Get the full detail record (manifest + settings) for a single plugin.
#[tauri::command]
pub fn get_plugin(plugin_id: String) -> Result<String, String> {
    let detail = plugin::get_plugin(&plugin_id)?;
    serde_json::to_string(&detail).map_err(|e| e.to_string())
}

/// Parse and validate a manifest file at an arbitrary path (import flow).
#[tauri::command]
pub fn open_plugin(file_path: String) -> Result<String, String> {
    let manifest = plugin::open_plugin_manifest(&PathBuf::from(&file_path))?;
    serde_json::to_string(&manifest).map_err(|e| e.to_string())
}

/// Persist updated settings for an installed plugin.
#[tauri::command]
pub fn configure_plugin(plugin_id: String, settings_json: String) -> Result<(), String> {
    let value: Value = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Invalid settings JSON: {}", e))?;
    plugin::configure_plugin(&plugin_id, value)
}

/// Call the optional `validate(settings)` export to confirm a plugin is ready to run.
#[tauri::command]
pub fn check_plugin_readiness(
    plugin_id: String,
    settings_json: Option<String>,
) -> Result<String, String> {
    let settings: Value = match settings_json {
        Some(raw) => {
            serde_json::from_str(&raw).map_err(|e| format!("Invalid settings JSON: {}", e))?
        }
        None => Value::Object(serde_json::Map::new()),
    };
    let result = plugin::check_plugin_readiness(&plugin_id, settings)?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}
