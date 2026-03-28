//! Public API for the project subsystem.
//!
//! Thin wrappers over [`SqliteProjectPersistence`] that convert [`PersistenceError`] to
//! `String` for consumption by Tauri command handlers. All business logic lives in [`db`].

mod db;
mod plugins;
mod security;
mod types;

pub use db::{ProjectPersistence, SqliteProjectPersistence};
pub use types::*;

use std::path::PathBuf;

/// Create a new project at `dir_path`.
pub async fn create_project(name: String, dir_path: PathBuf) -> Result<ProjectSummary, String> {
    SqliteProjectPersistence::new()
        .create_project(&name, &dir_path)
        .await
        .map_err(|e| e.to_string())
}

/// Open an existing project at `dir_path`.
pub async fn open_project(dir_path: PathBuf) -> Result<ProjectSummary, String> {
    SqliteProjectPersistence::new()
        .open_project(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

/// Load the full settings snapshot (project + global settings + all plugin configs).
pub async fn load_settings(dir_path: PathBuf) -> Result<ProjectSettingsPayload, String> {
    SqliteProjectPersistence::new()
        .load_settings(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

/// Update the project-wide theme setting.
pub async fn update_project_settings(
    dir_path: PathBuf,
    theme: Option<String>,
) -> Result<ProjectSettingsRecord, String> {
    SqliteProjectPersistence::new()
        .update_project_settings(&dir_path, theme)
        .await
        .map_err(|e| e.to_string())
}

/// Rename the project.
pub async fn update_project_name(
    dir_path: PathBuf,
    name: String,
) -> Result<ProjectSummary, String> {
    SqliteProjectPersistence::new()
        .update_project_name(&dir_path, &name)
        .await
        .map_err(|e| e.to_string())
}

/// Persist updated settings for one plugin within this project.
pub async fn update_project_plugin_settings(
    dir_path: PathBuf,
    plugin_id: String,
    settings: serde_json::Value,
) -> Result<PluginSettingsPayload, String> {
    SqliteProjectPersistence::new()
        .update_project_plugin_settings(&dir_path, &plugin_id, settings)
        .await
        .map_err(|e| e.to_string())
}

/// Register or refresh a plugin from a directory on disk into this project.
pub async fn upsert_project_plugin_from_dir(
    dir_path: PathBuf,
    plugin_dir: PathBuf,
    replace_plugin_id: Option<String>,
) -> Result<PluginSettingsPayload, String> {
    SqliteProjectPersistence::new()
        .upsert_project_plugin_from_dir(&dir_path, &plugin_dir, replace_plugin_id)
        .await
        .map_err(|e| e.to_string())
}

/// Create a new scan in Draft status.
pub async fn create_scan(
    dir_path: PathBuf,
    preview: Option<String>,
) -> Result<ScanSummaryRecord, String> {
    SqliteProjectPersistence::new()
        .create_scan(&dir_path, preview)
        .await
        .map_err(|e| e.to_string())
}

/// List all scans for the project, newest first.
pub async fn list_scans(dir_path: PathBuf) -> Result<Vec<ScanSummaryRecord>, String> {
    SqliteProjectPersistence::new()
        .list_scans(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

/// Fetch full details of a single scan including all plugin results.
pub async fn get_scan(dir_path: PathBuf, scan_id: String) -> Result<ScanDetailRecord, String> {
    SqliteProjectPersistence::new()
        .get_scan(&dir_path, &scan_id)
        .await
        .map_err(|e| e.to_string())
}

/// Execute a scan: run the selected plugins and persist results.
pub async fn run_scan(
    dir_path: PathBuf,
    scan_id: String,
    selected_plugins: Vec<PluginEntrypointSelection>,
    inputs: serde_json::Value,
) -> Result<ScanSummaryRecord, String> {
    SqliteProjectPersistence::new()
        .run_scan(&dir_path, &scan_id, selected_plugins, inputs)
        .await
        .map_err(|e| e.to_string())
}

/// Update the preview (display name) of a scan.
pub async fn update_scan_preview(
    dir_path: PathBuf,
    scan_id: String,
    preview: String,
) -> Result<ScanSummaryRecord, String> {
    SqliteProjectPersistence::new()
        .update_scan_preview(&dir_path, &scan_id, preview)
        .await
        .map_err(|e| e.to_string())
}

/// Return the encryption / unlock state of the project database.
pub async fn get_project_lock_status(dir_path: PathBuf) -> Result<ProjectLockStatus, String> {
    SqliteProjectPersistence::new()
        .get_project_lock_status(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

/// Attempt to unlock the project with the given password.
pub async fn unlock_project(
    dir_path: PathBuf,
    password: String,
) -> Result<ProjectLockStatus, String> {
    SqliteProjectPersistence::new()
        .unlock_project(&dir_path, password)
        .await
        .map_err(|e| e.to_string())
}

/// Encrypt an unencrypted project database with `new_password`.
pub async fn set_project_password(
    dir_path: PathBuf,
    new_password: String,
) -> Result<ProjectLockStatus, String> {
    SqliteProjectPersistence::new()
        .set_project_password(&dir_path, new_password)
        .await
        .map_err(|e| e.to_string())
}

/// Re-encrypt the database, replacing the current password with a new one.
pub async fn change_project_password(
    dir_path: PathBuf,
    current_password: String,
    new_password: String,
) -> Result<ProjectLockStatus, String> {
    SqliteProjectPersistence::new()
        .change_project_password(&dir_path, current_password, new_password)
        .await
        .map_err(|e| e.to_string())
}

/// Remove encryption from the project database.
pub async fn remove_project_password(
    dir_path: PathBuf,
    current_password: String,
) -> Result<ProjectLockStatus, String> {
    SqliteProjectPersistence::new()
        .remove_project_password(&dir_path, current_password)
        .await
        .map_err(|e| e.to_string())
}
