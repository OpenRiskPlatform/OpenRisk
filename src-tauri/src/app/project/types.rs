//! Project domain types: DTOs returned to the frontend and the shared error type.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;
use std::path::PathBuf;

/// One selected `(plugin, entrypoint)` pair submitted when running a scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginEntrypointSelection {
    pub plugin_id: String,
    pub entrypoint_id: String,
}

/// Lightweight project summary returned after open/create.
#[derive(Debug, Clone, Serialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub audit: Option<String>,
    pub directory: PathBuf,
}

/// Project-wide settings record persisted in the `ProjectSettings` table.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsRecord {
    pub id: String,
    pub description: String,
    pub locale: String,
    pub theme: String,
}

/// Per-plugin settings payload returned when loading or saving plugin configuration.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettingsPayload {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest: Value,
    pub input_schema: Value,
    pub settings_schema: Value,
    pub settings: Value,
}

/// Full project settings snapshot: project info, global settings, and all plugin configs.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsPayload {
    pub project: ProjectSummary,
    pub project_settings: ProjectSettingsRecord,
    pub plugins: Vec<PluginSettingsPayload>,
}

/// Brief scan record used in list views and status responses.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummaryRecord {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
}

/// Single plugin result stored in a completed scan.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanPluginResultRecord {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub output: Value,
}

/// Full scan details: metadata, selected plugins, inputs, and all plugin results.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanDetailRecord {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub selected_plugins: Vec<PluginEntrypointSelection>,
    pub inputs: Value,
    pub results: Vec<ScanPluginResultRecord>,
}

/// Encryption and unlock state of a project database file.
#[derive(Debug, Clone, Serialize)]
pub struct ProjectLockStatus {
    pub locked: bool,
    pub unlocked: bool,
}

/// Code + settings for one plugin entrypoint loaded from the DB before execution.
#[derive(Debug, Clone)]
pub struct PluginLoadData {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub settings_json: Option<String>,
    pub code: Option<String>,
    pub manifest_json: Option<String>,
}

/// Everything returned by `begin_scan_run`: context needed to execute all plugins.
#[derive(Debug, Clone)]
pub struct ScanRunContext {
    pub scan_preview: Option<String>,
    pub plugins: Vec<PluginLoadData>,
}

/// Unified error type for all persistence operations.
#[derive(Debug)]
pub enum PersistenceError {
    /// Domain or validation failure.
    Validation(String),
    /// Filesystem I/O error.
    Io(std::io::Error),
    /// SQLite / sqlx error.
    Database(sqlx::Error),
}

impl fmt::Display for PersistenceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PersistenceError::Validation(msg) => write!(f, "{}", msg),
            PersistenceError::Io(err) => write!(f, "{}", err),
            PersistenceError::Database(err) => write!(f, "{}", err),
        }
    }
}

impl From<std::io::Error> for PersistenceError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<sqlx::Error> for PersistenceError {
    fn from(value: sqlx::Error) -> Self {
        Self::Database(value)
    }
}

impl From<serde_json::Error> for PersistenceError {
    fn from(value: serde_json::Error) -> Self {
        Self::Validation(value.to_string())
    }
}
