use serde_json;
use std::fs;
use std::path::{Path, PathBuf};

use crate::{
    interface::plugin_manager::{PluginManager, PluginManagerError},
    models::plugin::{InstalledPlugin, PluginId},
};

const PLUGIN_STORAGE_DIR: &str = "./plugins";

#[derive(Default)]
pub struct LocalPluginManager {
    installed_plugins: Vec<InstalledPlugin>,
}

impl LocalPluginManager {
    /// Helper to get the full path for a specific plugin's JSON file
    fn get_plugin_file_path(id: &PluginId) -> PathBuf {
        Path::new(PLUGIN_STORAGE_DIR).join(format!("{}.json", id.0))
    }

    /// Ensures the storage directory exists
    fn ensure_dir() -> Result<(), PluginManagerError> {
        fs::create_dir_all(PLUGIN_STORAGE_DIR)
            .map_err(|e| PluginManagerError::Io("Plugin directory cannot be created"))
    }
}

impl PluginManager for LocalPluginManager {
    fn save(&self) {
        if let Err(e) = Self::ensure_dir() {
            eprintln!("Failed to create plugin directory: {:?}", e);
            return;
        }

        for installed in &self.installed_plugins {
            let path = Self::get_plugin_file_path(&installed.id);
            if let Ok(content) = serde_json::to_string_pretty(installed) {
                let _ = fs::write(path, content);
            }
        }
    }

    fn load() -> Self {
        let mut manager = LocalPluginManager::default();

        let Ok(entries) = fs::read_dir(PLUGIN_STORAGE_DIR) else {
            return manager;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(data) = fs::read_to_string(&path) {
                    if let Ok(plugin) = serde_json::from_str::<InstalledPlugin>(&data) {
                        manager.installed_plugins.push(plugin);
                    }
                }
            }
        }

        manager
    }

    fn list_installed_plugins(&self) -> Vec<InstalledPlugin> {
        self.installed_plugins.clone()
    }

    fn get_installed_plugin(
        &self,
        plugin_id: PluginId,
    ) -> Result<&InstalledPlugin, PluginManagerError> {
        self.installed_plugins
            .iter()
            .find(|p| p.id == plugin_id)
            .ok_or(PluginManagerError::PluginNotFound)
    }

    fn get_mut_installed_plugin(
        &mut self,
        plugin_id: PluginId,
    ) -> Result<&mut InstalledPlugin, PluginManagerError> {
        self.installed_plugins
            .iter_mut()
            .find(|p| p.id == plugin_id)
            .ok_or(PluginManagerError::PluginNotFound)
    }

    fn install_plugin(
        &mut self,
        _url: String, // In a real scenario, you'd download the plugin here
    ) -> Result<(), PluginManagerError> {
        // Mock logic: 1. Download 2. Extract to a PathBuf 3. Create InstalledPlugin
        // For this implementation, we assume the download logic is handled elsewhere
        // and we just update the internal state and save.

        Self::ensure_dir()?;

        // Placeholder for actual installation logic
        // self.installed_plugins.push(new_plugin);
        self.save();

        Ok(())
    }

    fn remove_plugin(&mut self, plugin_id: String) -> Result<(), PluginManagerError> {
        let id = PluginId(plugin_id.clone());

        // Remove from memory
        self.installed_plugins.retain(|p| p.id != id);

        // Remove from disk
        let path = Self::get_plugin_file_path(&id);
        if path.exists() {
            fs::remove_file(path)
                .map_err(|e| PluginManagerError::Io("Plugin directory cannot be created"))?;
        }

        Ok(())
    }
}
