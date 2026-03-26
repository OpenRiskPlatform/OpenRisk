use std::sync::Mutex;

use tauri::Manager;

use crate::{
    interface::plugin_manager::PluginManager, local_persistance::plugins::LocalPluginManager,
    models::project::Project,
};

mod app;
mod interface;
mod local_persistance;
mod models;
mod transport;

pub struct ActiveProject {
    project: Option<Project>,
}

impl Default for ActiveProject {
    fn default() -> Self {
        Self { project: None }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Mutex::new(ActiveProject::default()));
            app.manage(Mutex::new(LocalPluginManager::load()));
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Plugin API
            transport::plugin::list_plugins,
            transport::plugin::get_plugin,
            transport::plugin::open_plugin,
            transport::plugin::configure_plugin,
            transport::plugin::execute_plugin,
            // Project API
            transport::project::create_project,
            transport::project::load_project,
            transport::project::get_active_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
