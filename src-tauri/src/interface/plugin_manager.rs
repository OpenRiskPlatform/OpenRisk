use serde::{Deserialize, Serialize};

use crate::models::plugin::{InstalledPlugin, PluginId};

#[derive(Debug, Serialize, Deserialize)]
pub enum PluginManagerError {
    PluginNotFound,
    PluginInstallationFailed,
}

pub trait PluginManager {
    /// Save the current configuration to disk/cloud
    fn save(&self);

    /// Load plugin manager from disk/cloud
    fn load() -> Self;

    /// List all installed plugins
    fn list_installed_plugins(&self) -> Vec<InstalledPlugin>;

    /// Get a local plugin by ID
    fn get_installed_plugin(
        &self,
        plugin_id: PluginId,
    ) -> Result<&InstalledPlugin, PluginManagerError>;

    /// Get a mutable reference to local plugin by ID
    fn get_mut_installed_plugin(
        &mut self,
        plugin_id: PluginId,
    ) -> Result<&mut InstalledPlugin, PluginManagerError>;

    /// Install a plugin
    fn install_plugin(&mut self, url: String) -> Result<(), PluginManagerError>;

    /// Uninstall a plugin
    fn remove_plugin(&mut self, plugin_id: String) -> Result<(), PluginManagerError>;
}
