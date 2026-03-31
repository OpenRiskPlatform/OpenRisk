//! Tauri command handlers for built-in plugin operations.

use crate::app::plugin::{
    self,
    types::{PluginDetail, PluginSummary},
};
use serde_json::Value;
use std::path::PathBuf;

/// List all installed built-in plugins.
/// #
#[tauri::command]
#[specta::specta]
pub fn list_plugins() -> Result<Vec<PluginSummary>, String> {
    plugin::list_plugins()
}

/// Get the full detail record (manifest + settings) for a single plugin.
/// #
#[tauri::command]
#[specta::specta]
pub fn get_plugin(plugin_id: String) -> Result<PluginDetail, String> {
    plugin::get_plugin(&plugin_id)
}

/// Parse and validate a manifest file at an arbitrary path (import flow).
/// #
#[tauri::command]
#[specta::specta]
pub fn open_plugin(file_path: String) -> Result<Value, String> {
    let manifest = plugin::open_plugin_manifest(&PathBuf::from(&file_path))?;
    serde_json::to_value(&manifest).map_err(|e| e.to_string())
}

/// Persist updated settings for an installed plugin.
/// #
#[tauri::command]
#[specta::specta]
pub fn configure_plugin(plugin_id: String, settings: Value) -> Result<(), String> {
    plugin::configure_plugin(&plugin_id, settings)
}

/// Call the optional `validate(settings)` export to confirm a plugin is ready to run.
/// #
#[tauri::command]
#[specta::specta]
pub fn check_plugin_readiness(plugin_id: String, settings: Option<Value>) -> Result<Value, String> {
    let settings = settings.unwrap_or_else(|| Value::Object(serde_json::Map::new()));
    plugin::check_plugin_readiness(&plugin_id, settings)
}
