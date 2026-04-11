//! Project domain types: DTOs returned to the frontend and the shared error type.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use std::fmt;
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Scan & plugin selection
// ---------------------------------------------------------------------------

/// One selected `(plugin, entrypoint)` pair submitted when running a scan.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginEntrypointSelection {
    pub plugin_id: String,
    pub entrypoint_id: String,
}

// ---------------------------------------------------------------------------
// Project summary types
// ---------------------------------------------------------------------------

/// Lightweight project summary returned after open/create.
#[derive(Debug, Clone, Serialize, Type)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub audit: Option<String>,
    pub directory: PathBuf,
}

/// Project-wide settings record persisted in the `ProjectSettings` table.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsRecord {
    pub id: String,
    pub description: String,
    pub locale: String,
    pub theme: String,
    pub advanced_mode: bool,
}

// ---------------------------------------------------------------------------
// Plugin manifest types
// ---------------------------------------------------------------------------

/// Author entry from a plugin manifest.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PluginAuthor {
    pub name: String,
    pub email: Option<String>,
}

/// Core manifest metadata for a plugin.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifestRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub license: String,
    pub authors: Vec<PluginAuthor>,
    pub icon: Option<String>,
    pub homepage: Option<String>,
    /// JS function name to call to refresh plugin metrics (optional).
    pub update_metrics_fn: Option<String>,
}

/// Named entrypoint exposed by a plugin.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginEntrypointRecord {
    pub id: String,
    pub name: String,
    pub function_name: String,
    pub description: Option<String>,
}

/// Definition of one input field declared by a plugin.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginInputDef {
    pub entrypoint_id: String,
    pub name: String,
    pub title: String,
    #[serde(rename = "type")]
    pub type_: PluginFieldTypeDef,
    pub optional: bool,
    pub description: Option<String>,
    pub default_value: Option<SettingValue>,
}

/// Structured input/setting type descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginFieldTypeDef {
    pub name: String,
    pub values: Option<Vec<String>>,
}

/// Definition of one configurable setting declared by a plugin.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettingDef {
    pub name: String,
    pub title: String,
    #[serde(rename = "type")]
    pub type_: PluginFieldTypeDef,
    pub description: Option<String>,
    pub required: bool,
    pub default_value: Option<SettingValue>,
}

/// Definition of one runtime metric declared by a plugin.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginMetricDef {
    pub name: String,
    pub title: String,
    #[serde(rename = "type")]
    pub type_: PluginFieldTypeDef,
    pub description: Option<String>,
}

/// One metric value produced by plugin runtime and stored with scan results.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginMetricValue {
    pub name: String,
    pub title: String,
    #[serde(rename = "type")]
    pub type_: PluginFieldTypeDef,
    pub description: Option<String>,
    pub value: SettingValue,
}

// ---------------------------------------------------------------------------
// Setting / input values
// ---------------------------------------------------------------------------

/// A typed scalar value used for both plugin settings and scan inputs.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "value", rename_all = "lowercase")]
pub enum SettingValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Null,
}

impl SettingValue {
    pub fn to_json(&self) -> Value {
        match self {
            SettingValue::String(s) => Value::String(s.clone()),
            SettingValue::Number(n) => serde_json::Number::from_f64(*n)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            SettingValue::Boolean(b) => Value::Bool(*b),
            SettingValue::Null => Value::Null,
        }
    }

    pub fn from_json(v: &Value) -> Self {
        match v {
            Value::String(s) => SettingValue::String(s.clone()),
            Value::Number(n) => SettingValue::Number(n.as_f64().unwrap_or(0.0)),
            Value::Bool(b) => SettingValue::Boolean(*b),
            _ => SettingValue::Null,
        }
    }

    /// Serialise the contained JSON value to a string for DB storage.
    pub fn to_json_string(&self) -> String {
        serde_json::to_string(&self.to_json()).unwrap_or_else(|_| "null".to_string())
    }
}

/// A named setting value with its typed scalar.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettingValue {
    pub name: String,
    pub value: SettingValue,
}

// ---------------------------------------------------------------------------
// Plugin record (full plugin descriptor + current settings for a project)
// ---------------------------------------------------------------------------

/// Complete descriptor for a plugin as configured within a project.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub enabled: bool,
    pub manifest: PluginManifestRecord,
    pub entrypoints: Vec<PluginEntrypointRecord>,
    pub input_defs: Vec<PluginInputDef>,
    pub setting_defs: Vec<PluginSettingDef>,
    pub metric_defs: Vec<PluginMetricDef>,
    pub metric_values: Vec<PluginMetricValue>,
    pub setting_values: Vec<PluginSettingValue>,
}

// ---------------------------------------------------------------------------
// Project settings payload
// ---------------------------------------------------------------------------

/// Full project settings snapshot: project info, global settings, and all plugin configs.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsPayload {
    pub project: ProjectSummary,
    pub project_settings: ProjectSettingsRecord,
    pub plugins: Vec<PluginRecord>,
}

// ---------------------------------------------------------------------------
// Scan types
// ---------------------------------------------------------------------------

/// Brief scan record used in list views and status responses.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummaryRecord {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub is_archived: bool,
    pub sort_order: i64,
}

/// A single field value submitted as input to one plugin entrypoint.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanEntrypointInput {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub field_name: String,
    pub value: SettingValue,
}

/// Log severity level emitted by a plugin during execution.
#[derive(Debug, Clone, Serialize, Type)]
pub enum LogLevel {
    #[serde(rename = "log")]
    Log,
    #[serde(rename = "warn")]
    Warn,
    #[serde(rename = "error")]
    Error,
}

/// A single console log entry captured from plugin execution.
#[derive(Debug, Clone, Serialize, Type)]
pub struct LogEntry {
    pub level: LogLevel,
    pub message: String,
}

impl LogEntry {
    /// Parse from a raw JSON log entry produced by the plugin runtime.
    pub fn from_json(v: &Value) -> Option<Self> {
        let message = v
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("")
            .to_string();
        let level = match v.get("level").and_then(|l| l.as_str()) {
            Some("warn") => LogLevel::Warn,
            Some("error") => LogLevel::Error,
            _ => LogLevel::Log,
        };
        Some(LogEntry { level, message })
    }
}

/// Structured result of executing one plugin entrypoint.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginOutput {
    /// Whether the plugin executed successfully.
    pub ok: bool,
    /// JSON-encoded output data (present when `ok` is true).
    pub data_json: Option<String>,
    /// Error message (present when `ok` is false).
    pub error: Option<String>,
    /// Console log entries captured during execution.
    pub logs: Vec<LogEntry>,
}

/// Single plugin result stored in a completed scan.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanPluginResultRecord {
    pub plugin_id: String,
    pub plugin_revision_id: Option<String>,
    pub entrypoint_id: String,
    pub output: PluginOutput,
    /// Metrics collected during execution — upserted to PluginMetric on scan end, not sent to frontend.
    #[serde(skip)]
    #[specta(skip)]
    pub metrics: Vec<PluginMetricValue>,
}

/// Full scan details: metadata, selected plugins, inputs, and all plugin results.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanDetailRecord {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub selected_plugins: Vec<PluginEntrypointSelection>,
    pub inputs: Vec<ScanEntrypointInput>,
    pub results: Vec<ScanPluginResultRecord>,
}

// ---------------------------------------------------------------------------
// Internal types (not in the public API)
// ---------------------------------------------------------------------------

/// Code + settings for one plugin entrypoint loaded from the DB before execution.
#[derive(Debug, Clone)]
pub struct PluginLoadData {
    pub plugin_id: String,
    pub plugin_revision_id: String,
    pub entrypoint_id: String,
    /// The JavaScript-exported function name to invoke.
    pub entrypoint_function: String,
    pub metric_defs: Vec<PluginMetricDef>,
    pub settings: Vec<PluginSettingValue>,
    pub code: Option<String>,
    /// JS function to call for metrics refresh (from plugin manifest).
    pub update_metrics_fn: Option<String>,
}

/// Everything returned by `begin_scan_run`: context needed to execute all plugins.
#[derive(Debug, Clone)]
pub struct ScanRunContext {
    pub scan_preview: Option<String>,
    pub plugins: Vec<PluginLoadData>,
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

/// Encryption and unlock state of a project database file.
#[derive(Debug, Clone, Serialize, Type)]
pub struct ProjectLockStatus {
    pub locked: bool,
    pub unlocked: bool,
}

// ---------------------------------------------------------------------------
// App-level error (returned by commands)
// ---------------------------------------------------------------------------

/// Typed error returned by all Tauri commands.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    Validation(String),
    NotFound(String),
    Database(String),
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Validation(msg) => write!(f, "{}", msg),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::Database(msg) => write!(f, "Database: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal: {}", msg),
        }
    }
}

impl From<PersistenceError> for AppError {
    fn from(e: PersistenceError) -> Self {
        match e {
            PersistenceError::Validation(msg) => AppError::Validation(msg),
            PersistenceError::Database(err) => AppError::Database(err.to_string()),
            PersistenceError::Io(err) => AppError::Internal(err.to_string()),
            PersistenceError::Http(msg) => AppError::Internal(msg),
        }
    }
}

impl From<reqwest::Error> for PersistenceError {
    fn from(e: reqwest::Error) -> Self {
        Self::Http(e.to_string())
    }
}

// ---------------------------------------------------------------------------
// Internal persistence error
// ---------------------------------------------------------------------------

/// Unified error type for all persistence operations.
#[derive(Debug)]
pub enum PersistenceError {
    /// Domain or validation failure.
    Validation(String),
    /// Filesystem I/O error.
    Io(std::io::Error),
    /// SQLite / sqlx error.
    Database(sqlx::Error),
    /// HTTP error when fetching remote resources.
    Http(String),
}

impl fmt::Display for PersistenceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PersistenceError::Validation(msg) => write!(f, "{}", msg),
            PersistenceError::Io(err) => write!(f, "{}", err),
            PersistenceError::Database(err) => write!(f, "{}", err),
            PersistenceError::Http(msg) => write!(f, "HTTP error: {}", msg),
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
