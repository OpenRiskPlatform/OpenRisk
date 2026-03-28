//! Tauri command handlers for project encryption and password management.
//!
//! [`get_project_lock_status`] is a pre-open probe that accepts a `dir_path` and requires no
//! open project session. All other handlers operate on the currently-open project from
//! [`ProjectState`].
//!
//! The `unlock_project` command is removed: the unlock flow is now merged into [`open_project`]
//! — call it with `password: Some(...)` to authenticate and open in one step.

use crate::app::project::{ProjectPersistence, SqliteProjectPersistence};
use crate::ProjectState;
use std::path::PathBuf;

/// Probe the lock status of a project file *without* opening it.
///
/// Call this before `open_project` to determine whether a password prompt is needed.
#[tauri::command]
pub async fn get_project_lock_status(dir_path: String) -> Result<String, String> {
    let status = SqliteProjectPersistence::check_lock_status(&PathBuf::from(dir_path))
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

/// Encrypt an unencrypted project database with `new_password`.
#[tauri::command]
pub async fn set_project_password(
    new_password: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = state
        .lock()
        .await
        .clone()
        .ok_or_else(|| "No project is open.".to_string())?;
    let status = project
        .set_project_password(new_password)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

/// Re-encrypt the database, replacing the current password with `new_password`.
#[tauri::command]
pub async fn change_project_password(
    current_password: String,
    new_password: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = state
        .lock()
        .await
        .clone()
        .ok_or_else(|| "No project is open.".to_string())?;
    let status = project
        .change_project_password(current_password, new_password)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

/// Remove encryption from the project database.
#[tauri::command]
pub async fn remove_project_password(
    current_password: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<String, String> {
    let project = state
        .lock()
        .await
        .clone()
        .ok_or_else(|| "No project is open.".to_string())?;
    let status = project
        .remove_project_password(current_password)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}
