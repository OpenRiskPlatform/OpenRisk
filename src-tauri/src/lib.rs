pub mod plugins;
use rustyscript::{
    deno_core::{error::ModuleLoaderError, ModuleSpecifier, RequestedModuleType, ResolutionKind},
    module_loader::ImportProvider,
    Module, Runtime, RuntimeOptions,
};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

mod app;
mod core;
mod plugin_manifest;
mod transport;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            transport::list_plugins,
            transport::get_plugin,
            transport::open_plugin,
            transport::configure_plugin,
            transport::execute_plugin,
            transport::create_project,
            transport::open_project,
            transport::load_settings,
            transport::update_project_settings,
            transport::update_project_name,
            transport::update_project_plugin_settings,
            transport::create_scan,
            transport::list_scans,
            transport::get_scan,
            transport::run_scan,
            transport::upsert_project_plugin_from_dir,
            transport::update_scan_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
