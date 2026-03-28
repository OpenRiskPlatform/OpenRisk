mod app;
mod commands;
mod plugin_manifest;

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
            // Plugin commands
            commands::plugin::list_plugins,
            commands::plugin::get_plugin,
            commands::plugin::open_plugin,
            commands::plugin::configure_plugin,
            commands::plugin::execute_plugin,
            commands::plugin::check_plugin_readiness,
            // Project & scan commands
            commands::project::create_project,
            commands::project::open_project,
            commands::project::load_settings,
            commands::project::update_project_settings,
            commands::project::update_project_name,
            commands::project::update_project_plugin_settings,
            commands::project::upsert_project_plugin_from_dir,
            commands::project::create_scan,
            commands::project::list_scans,
            commands::project::get_scan,
            commands::project::run_scan,
            commands::project::update_scan_preview,
            // Security commands
            commands::security::get_project_lock_status,
            commands::security::unlock_project,
            commands::security::set_project_password,
            commands::security::change_project_password,
            commands::security::remove_project_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
