mod app;
mod commands;
mod plugin_manifest;

use std::sync::Arc;

use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

/// Tauri-managed state holding the currently-open project, if any.
///
/// Stored as `Arc` so command handlers can clone the pointer and release the
/// state mutex before doing async work on the project.
pub type ProjectState = tokio::sync::Mutex<Option<Arc<app::project::SqliteProjectPersistence>>>;

fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        // Project & scan commands
        commands::project::create_project,
        commands::project::open_project,
        commands::project::close_project,
        commands::project::load_settings,
        commands::project::update_project_settings,
        commands::project::set_plugin_setting,
        commands::project::upsert_project_plugin_from_dir,
        commands::project::upsert_project_plugin_from_zip,
        commands::project::install_plugin_from_url,
        commands::project::set_plugin_enabled,
        commands::project::refresh_plugin_metrics,
        commands::project::create_scan,
        commands::project::list_scans,
        commands::project::get_scan,
        commands::project::run_scan,
        commands::project::update_scan_preview,
        commands::project::set_scan_archived,
        commands::project::reorder_scans,
        commands::project::get_plugin_registry,
        // Security commands
        commands::security::get_project_lock_status,
        commands::security::set_project_password,
        commands::security::change_project_password,
        commands::security::remove_project_password,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/core/backend/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    let mut tauri_builder = tauri::Builder::default()
        .manage(tokio::sync::Mutex::new(
            None::<Arc<app::project::SqliteProjectPersistence>>,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(builder.invoke_handler());

    #[cfg(debug_assertions)]
    {
        tauri_builder = tauri_builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    tauri_builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Run `cargo test export_bindings -- --nocapture` to regenerate
    /// `src/core/backend/bindings.ts` without launching the full app.
    #[test]
    fn export_bindings() {
        specta_builder()
            .export(Typescript::default(), "../src/core/backend/bindings.ts")
            .expect("Failed to export TypeScript bindings");
    }
}
