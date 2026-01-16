use std::sync::Mutex;

use tauri::Manager;

use crate::models::project::Project;

mod app;
mod interface;
mod models;
mod persistance;
mod plugin_manifest;
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
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            transport::list_plugins,
            transport::get_plugin,
            transport::open_plugin,
            transport::configure_plugin,
            transport::execute_plugin,
            // Project API
            persistance::fs_pm::create_project,
            persistance::fs_pm::load_project,
            transport::get_active_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
