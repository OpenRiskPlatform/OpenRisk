//! Tauri command handlers for project encryption and password management.
//!
//! Each handler delegates to [`crate::app::project`] and serialises the result
//! to a JSON string for the frontend.

use crate::app::project;
use std::path::PathBuf;

/// Return the encryption / unlock state of the project database.
#[tauri::command]
pub async fn get_project_lock_status(dir_path: String) -> Result<String, String> {
    let status = project::get_project_lock_status(PathBuf::from(dir_path)).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

/// Attempt to unlock the project with the given password.
#[tauri::command]
pub async fn unlock_project(dir_path: String, password: String) -> Result<String, String> {
    let status = project::unlock_project(PathBuf::from(dir_path), password).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

/// Encrypt an unencrypted project database with `new_password`.
#[tauri::command]
pub async fn set_project_password(
    dir_path: String,
    new_password: String,
) -> Result<String, String> {
    let status = project::set_project_password(PathBuf::from(dir_path), new_password).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

/// Re-encrypt the database, replacing the current password with a new one.
#[tauri::command]
pub async fn change_project_password(
    dir_path: String,
    current_password: String,
    new_password: String,
) -> Result<String, String> {
    let status =
        project::change_project_password(PathBuf::from(dir_path), current_password, new_password)
            .await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}

/// Remove encryption from the project database.
#[tauri::command]
pub async fn remove_project_password(
    dir_path: String,
    current_password: String,
) -> Result<String, String> {
    let status =
        project::remove_project_password(PathBuf::from(dir_path), current_password).await?;
    serde_json::to_string(&status).map_err(|e| e.to_string())
}
