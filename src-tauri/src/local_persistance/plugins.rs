use crate::{
    interface::plugin_manager::PluginManager,
    models::plugin::{InstalledPlugin, PluginId},
};

#[derive(Default)]
pub struct LocalPluginManager {
    installed_plugins: Vec<InstalledPlugin>,
}

impl PluginManager for LocalPluginManager {
    fn save(&self) {
        todo!()
    }

    fn load() -> Self {
        todo!()
    }

    fn list_installed_plugins(&self) -> Vec<InstalledPlugin> {
        todo!()
    }

    fn get_installed_plugin(
        &self,
        plugin_id: PluginId,
    ) -> Result<&InstalledPlugin, crate::interface::plugin_manager::PluginManagerError> {
        todo!()
    }

    fn get_mut_installed_plugin(
        &mut self,
        plugin_id: PluginId,
    ) -> Result<&mut InstalledPlugin, crate::interface::plugin_manager::PluginManagerError> {
        todo!()
    }

    fn install_plugin(
        &mut self,
        url: String,
    ) -> Result<(), crate::interface::plugin_manager::PluginManagerError> {
        todo!()
    }

    fn remove_plugin(
        &mut self,
        plugin_id: String,
    ) -> Result<(), crate::interface::plugin_manager::PluginManagerError> {
        todo!()
    }
}
