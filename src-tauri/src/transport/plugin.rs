use serde_json::Value;
use std::sync::Mutex;
use tauri::State;

use crate::interface::plugin_manager::PluginManager;
use crate::local_persistance::plugins::LocalPluginManager;
use crate::models::plugin::{InstalledPlugin, PluginId, PluginInputs, PluginSettings};

#[tauri::command]
pub fn list_plugins(
    plugin_manager: State<Mutex<LocalPluginManager>>,
) -> Result<Vec<InstalledPlugin>, String> {
    let Ok(manager) = plugin_manager.lock() else {
        return Err("Plugin manager not found".to_string());
    };

    Ok(manager.list_installed_plugins())
}

#[tauri::command]
pub fn get_plugin(
    plugin_id: PluginId,
    plugin_manager: State<Mutex<LocalPluginManager>>,
) -> Result<InstalledPlugin, String> {
    let Ok(manager) = plugin_manager.lock() else {
        return Err("Plugin manager not found".to_string());
    };

    Ok(manager
        .get_installed_plugin(plugin_id)
        .map_err(|e| format!("{:?}", e))?
        .clone())
}

#[tauri::command]
pub fn configure_plugin(
    plugin_id: PluginId,
    settings: PluginSettings,
    plugin_manager: State<Mutex<LocalPluginManager>>,
) -> Result<(), String> {
    let Ok(mut manager) = plugin_manager.lock() else {
        return Err("Plugin manager not found".to_string());
    };

    let plugin = manager
        .get_mut_installed_plugin(plugin_id)
        .map_err(|e| format!("{:?}", e))?;

    plugin.settings = settings;

    Ok(())
}

#[tauri::command]
pub fn execute_plugin(
    plugin_id: PluginId,
    inputs: PluginInputs,
    plugin_manager: State<Mutex<LocalPluginManager>>,
) -> Result<Value, String> {
    let Ok(manager) = plugin_manager.lock() else {
        return Err("Plugin manager not found".to_string());
    };

    if let Ok(plugin) = manager.get_installed_plugin(plugin_id.clone()) {
        return plugin.execute(inputs);
    }

    return Err(format!("Plugin {:?} not found", plugin_id));
}

// Do we need this one?

#[tauri::command]
pub fn open_plugin(_file_path: String) -> Result<String, String> {
    todo!()
    // let path = PathBuf::from(&file_path);
    // let manifest = app::open_plugin_manifest(&path)?;
    // serde_json::to_string(&manifest).map_err(|e| e.to_string())
}
