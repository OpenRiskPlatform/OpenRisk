use crate::app::plugin as plugin_app;
use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest};
use async_trait::async_trait;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use uuid::Uuid;

const DB_FILE_NAME: &str = "project.db";
const PLUGINS_DIR_NAME: &str = "plugins";
const CURRENT_SCHEMA_VERSION: i64 = 5;
/// The minimum schema version that can be migrated to current.
/// Any project with version < MIN_SUPPORTED_SCHEMA_VERSION will be rejected.
const MIN_SUPPORTED_SCHEMA_VERSION: i64 = 4;
const LOCKED_PROJECT_ERROR_PREFIX: &str = "PROJECT_LOCKED:";
const PROJECT_LEGACY_ERROR_PREFIX: &str = "PROJECT_LEGACY:";
const PROJECT_OUTDATED_ERROR_PREFIX: &str = "PROJECT_OUTDATED:";
const MIN_PASSWORD_LEN: usize = 8;

static PROJECT_KEYS: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Represents one selected (plugin, entrypoint) pair in a scan run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginEntrypointSelection {
    pub plugin_id: String,
    pub entrypoint_id: String,
}

const SCHEMA_SQL: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ProjectSettings (
    id TEXT PRIMARY KEY,
    description TEXT,
    locale TEXT,
    theme TEXT
);

CREATE TABLE IF NOT EXISTS SchemaVersion (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Project (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    audit TEXT,
    project_settings_id TEXT NOT NULL,
    FOREIGN KEY (project_settings_id) REFERENCES ProjectSettings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Plugin (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    input_schema_json TEXT CHECK (input_schema_json IS NULL OR json_valid(input_schema_json)),
    settings_schema_json TEXT CHECK (settings_schema_json IS NULL OR json_valid(settings_schema_json)),
    code TEXT,
    manifest_json TEXT CHECK (manifest_json IS NULL OR json_valid(manifest_json))
);

CREATE TABLE IF NOT EXISTS ProjectPluginSettings (
    plugin_id TEXT NOT NULL,
    project_settings_id TEXT NOT NULL,
    settings_json TEXT CHECK (settings_json IS NULL OR json_valid(settings_json)),
    PRIMARY KEY (plugin_id, project_settings_id),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (project_settings_id) REFERENCES ProjectSettings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Scan (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Draft','Running','Completed','Failed')),
    preview TEXT,
    inputs_json TEXT CHECK (inputs_json IS NULL OR json_valid(inputs_json)),
    selected_plugins_json TEXT CHECK (selected_plugins_json IS NULL OR json_valid(selected_plugins_json)),
    FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScanPluginResult (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    scan_id TEXT NOT NULL,
    output_json_ir TEXT CHECK (output_json_ir IS NULL OR json_valid(output_json_ir)),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE
);
"#;

#[derive(Debug, Clone)]
struct LocalPluginBundle {
    id: String,
    manifest: OpenRiskPluginManifest,
    manifest_json: Value,
    code: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub audit: Option<String>,
    pub directory: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsRecord {
    pub id: String,
    pub description: String,
    pub locale: String,
    pub theme: String,
}

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsPayload {
    pub project: ProjectSummary,
    pub project_settings: ProjectSettingsRecord,
    pub plugins: Vec<PluginSettingsPayload>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummaryRecord {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanPluginResultRecord {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub output: Value,
}

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectLockStatus {
    pub locked: bool,
    pub unlocked: bool,
}

#[derive(Debug)]
pub enum PersistenceError {
    Validation(String),
    Io(std::io::Error),
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

fn lock_error() -> String {
    format!(
        "{}Project file is encrypted. Unlock it first.",
        LOCKED_PROJECT_ERROR_PREFIX
    )
}

fn canonical_key_path(path: &Path) -> String {
    fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
}

fn get_cached_key(path: &Path) -> Option<String> {
    let key = canonical_key_path(path);
    PROJECT_KEYS
        .lock()
        .ok()
        .and_then(|guard| guard.get(&key).cloned())
}

fn cache_key(path: &Path, password: String) {
    let key = canonical_key_path(path);
    if let Ok(mut guard) = PROJECT_KEYS.lock() {
        guard.insert(key, password);
    }
}

fn clear_cached_key(path: &Path) {
    let key = canonical_key_path(path);
    if let Ok(mut guard) = PROJECT_KEYS.lock() {
        guard.remove(&key);
    }
}

fn escape_sql_literal(value: &str) -> String {
    value.replace('\'', "''")
}

fn validate_password(value: &str) -> Result<(), String> {
    if value.len() < MIN_PASSWORD_LEN {
        return Err(format!(
            "Password must be at least {} characters",
            MIN_PASSWORD_LEN
        ));
    }
    Ok(())
}

fn validate_non_empty_password(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{} must not be empty", field));
    }
    Ok(())
}

fn plugins_root() -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push(PLUGINS_DIR_NAME);
    path
}

fn discover_local_plugins() -> Result<Vec<LocalPluginBundle>, PersistenceError> {
    let root = plugins_root();
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut bundles = Vec::new();
    for entry in fs::read_dir(&root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        match load_plugin_bundle(&path) {
            Ok(bundle) => bundles.push(bundle),
            Err(err) => {
                eprintln!("Skipping plugin {:?}: {}", path, err);
            }
        }
    }

    Ok(bundles)
}

fn load_plugin_bundle(dir: &Path) -> Result<LocalPluginBundle, PersistenceError> {
    let plugin_id = dir
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .ok_or_else(|| PersistenceError::Validation("Invalid plugin directory".into()))?;

    let manifest_path = dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin manifest: {:?}",
            manifest_path
        )));
    }

    let manifest_raw = fs::read_to_string(&manifest_path)?;
    let manifest =
        parse_manifest(&manifest_raw).map_err(|e| PersistenceError::Validation(e.to_string()))?;
    let manifest_json = serde_json::to_value(&manifest)?;

    let entrypoint: String = manifest.entrypoint.clone().into();
    let code_path = dir.join(entrypoint);
    if !code_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin entrypoint file: {:?}",
            code_path
        )));
    }
    let code = fs::read_to_string(code_path)?;

    Ok(LocalPluginBundle {
        id: plugin_id,
        manifest,
        manifest_json,
        code,
    })
}

fn load_plugin_bundle_with_id(
    dir: &Path,
    plugin_id: String,
) -> Result<LocalPluginBundle, PersistenceError> {
    let manifest_path = dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin manifest: {:?}",
            manifest_path
        )));
    }

    let manifest_raw = fs::read_to_string(&manifest_path)?;
    let manifest = parse_manifest_relaxed(&manifest_raw)
        .map_err(|e| PersistenceError::Validation(e.to_string()))?;
    let manifest_json = serde_json::to_value(&manifest)?;

    let entrypoint: String = manifest.entrypoint.clone().into();
    let code_path = dir.join(entrypoint);
    if !code_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin entrypoint file: {:?}",
            code_path
        )));
    }
    let code = fs::read_to_string(code_path)?;

    Ok(LocalPluginBundle {
        id: plugin_id,
        manifest,
        manifest_json,
        code,
    })
}

fn extract_manifest_id(dir: &Path) -> Result<String, PersistenceError> {
    let manifest_path = dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin manifest: {:?}",
            manifest_path
        )));
    }

    let raw = fs::read_to_string(&manifest_path)?;
    let value: Value = serde_json::from_str(&raw)?;
    let id = value
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            PersistenceError::Validation("Manifest must contain non-empty id".to_string())
        })?;
    Ok(id)
}

fn parse_manifest_relaxed(raw: &str) -> Result<OpenRiskPluginManifest, String> {
    if let Ok(parsed) = parse_manifest(raw) {
        return Ok(parsed);
    }

    let mut value: Value =
        serde_json::from_str(raw).map_err(|e| format!("Invalid plugin.json: {}", e))?;
    let obj = value
        .as_object_mut()
        .ok_or_else(|| "plugin.json must be a JSON object".to_string())?;

    if !obj.contains_key("license") {
        obj.insert("license".to_string(), Value::String("MIT".to_string()));
    }
    if !obj.contains_key("entrypoint") {
        obj.insert(
            "entrypoint".to_string(),
            Value::String("index.ts".to_string()),
        );
    }
    if !obj.contains_key("settings") {
        obj.insert("settings".to_string(), Value::Array(vec![]));
    }
    if !obj.contains_key("inputs") {
        obj.insert("inputs".to_string(), Value::Array(vec![]));
    }
    if !obj.contains_key("authors") {
        obj.insert(
            "authors".to_string(),
            Value::Array(vec![
                json!({ "name": "Unknown", "email": "unknown@example.com" }),
            ]),
        );
    }

    let normalized = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    parse_manifest(&normalized).map_err(|e| e.to_string())
}

fn build_default_settings(manifest: &OpenRiskPluginManifest) -> Value {
    let mut map = Map::new();
    for setting in &manifest.settings {
        let key = setting.name.to_string();
        let value = setting.default.clone().unwrap_or(Value::Null);
        map.insert(key, value);
    }
    Value::Object(map)
}

#[async_trait]
pub trait ProjectPersistence: Send + Sync {
    async fn create_project(
        &self,
        name: &str,
        parent_dir: &Path,
    ) -> Result<ProjectSummary, PersistenceError>;

    async fn open_project(&self, project_dir: &Path) -> Result<ProjectSummary, PersistenceError>;

    async fn load_settings(
        &self,
        project_dir: &Path,
    ) -> Result<ProjectSettingsPayload, PersistenceError>;

    async fn update_project_settings(
        &self,
        project_dir: &Path,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError>;

    async fn update_project_plugin_settings(
        &self,
        project_dir: &Path,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError>;
}

pub struct SqliteProjectPersistence;

impl SqliteProjectPersistence {
    pub fn new() -> Self {
        Self
    }

    async fn connect(
        db_path: &Path,
        create_if_missing: bool,
        key: Option<&str>,
    ) -> Result<SqliteConnection, PersistenceError> {
        let options = SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(create_if_missing)
            .busy_timeout(Duration::from_secs(5));

        let mut conn = SqliteConnection::connect_with(&options)
            .await
            .map_err(PersistenceError::from)?;

        if let Some(password) = key {
            let escaped = escape_sql_literal(password);
            let pragma = format!("PRAGMA key = '{}';", escaped);
            sqlx::query(&pragma)
                .execute(&mut conn)
                .await
                .map_err(PersistenceError::from)?;
        }

        // Force key validation for SQLCipher-enabled databases.
        sqlx::query("SELECT count(1) FROM sqlite_master")
            .fetch_one(&mut conn)
            .await
            .map_err(PersistenceError::from)?;

        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&mut conn)
            .await
            .map_err(PersistenceError::from)?;
        sqlx::query("PRAGMA journal_mode = WAL;")
            .execute(&mut conn)
            .await
            .map_err(PersistenceError::from)?;

        Ok(conn)
    }

    fn is_encrypted_error(err: &PersistenceError) -> bool {
        match err {
            PersistenceError::Database(db_err) => {
                let msg = db_err.to_string().to_ascii_lowercase();
                msg.contains("file is encrypted") || msg.contains("not a database")
            }
            _ => false,
        }
    }

    async fn connect_for_existing_project(
        db_path: &Path,
    ) -> Result<SqliteConnection, PersistenceError> {
        if let Some(password) = get_cached_key(db_path) {
            match Self::connect(db_path, false, Some(&password)).await {
                Ok(conn) => return Ok(conn),
                Err(err) if Self::is_encrypted_error(&err) => {
                    clear_cached_key(db_path);
                }
                Err(err) => return Err(err),
            }
        }

        match Self::connect(db_path, false, None).await {
            Ok(conn) => Ok(conn),
            Err(err) if Self::is_encrypted_error(&err) => {
                Err(PersistenceError::Validation(lock_error()))
            }
            Err(err) => Err(err),
        }
    }

    async fn read_lock_status(db_path: &Path) -> Result<ProjectLockStatus, String> {
        let cached = get_cached_key(db_path).is_some();
        match Self::connect(db_path, false, None).await {
            Ok(_) => Ok(ProjectLockStatus {
                locked: false,
                unlocked: true,
            }),
            Err(err) if Self::is_encrypted_error(&err) => Ok(ProjectLockStatus {
                locked: true,
                unlocked: cached,
            }),
            Err(err) => Err(err.to_string()),
        }
    }

    fn sidecar_path(db_path: &Path, suffix: &str) -> PathBuf {
        PathBuf::from(format!("{}{}", db_path.to_string_lossy(), suffix))
    }

    fn cleanup_sidecars(db_path: &Path) {
        let wal = Self::sidecar_path(db_path, "-wal");
        let shm = Self::sidecar_path(db_path, "-shm");
        let _ = fs::remove_file(wal);
        let _ = fs::remove_file(shm);
    }

    async fn rewrite_database_with_key(
        db_path: &Path,
        source_key: Option<&str>,
        target_key: Option<&str>,
    ) -> Result<(), String> {
        let parent = db_path
            .parent()
            .ok_or_else(|| format!("Invalid database path: {:?}", db_path))?;
        if !parent.exists() || !parent.is_dir() {
            return Err(format!(
                "Database parent directory does not exist: {:?}",
                parent
            ));
        }

        let mut temp_path = db_path.to_path_buf();
        let temp_ext = match db_path.extension().and_then(|ext| ext.to_str()) {
            Some(ext) if !ext.is_empty() => format!("{}.tmp", ext),
            _ => "tmp".to_string(),
        };
        temp_path.set_extension(temp_ext);

        let _ = fs::remove_file(&temp_path);
        Self::cleanup_sidecars(&temp_path);

        // Ensure ATTACH target exists and is writable in current environment.
        File::create(&temp_path).map_err(|e| e.to_string())?;

        let mut conn = Self::connect(db_path, false, source_key)
            .await
            .map_err(|err| {
                if Self::is_encrypted_error(&err) {
                    "Invalid current password".to_string()
                } else {
                    err.to_string()
                }
            })?;

        let escaped_temp = escape_sql_literal(&temp_path.to_string_lossy());
        let attach_sql = match target_key {
            Some(password) => {
                let escaped = escape_sql_literal(password);
                format!(
                    "ATTACH DATABASE '{}' AS __openrisk_rekey__ KEY '{}';",
                    escaped_temp, escaped
                )
            }
            None => format!(
                "ATTACH DATABASE '{}' AS __openrisk_rekey__ KEY '';",
                escaped_temp
            ),
        };

        sqlx::query(&attach_sql)
            .execute(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query("SELECT sqlcipher_export('__openrisk_rekey__');")
            .execute(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query("DETACH DATABASE __openrisk_rekey__;")
            .execute(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        drop(conn);

        Self::cleanup_sidecars(db_path);

        let backup_path = Self::sidecar_path(db_path, "pre-rekey-backup");
        let _ = fs::remove_file(&backup_path);

        fs::rename(db_path, &backup_path).map_err(|e| e.to_string())?;
        match fs::rename(&temp_path, db_path) {
            Ok(_) => {
                let _ = fs::remove_file(&backup_path);
                Self::cleanup_sidecars(db_path);
                Ok(())
            }
            Err(err) => {
                let _ = fs::rename(&backup_path, db_path);
                let _ = fs::remove_file(&temp_path);
                Err(err.to_string())
            }
        }
    }

    async fn apply_schema(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        for statement in SCHEMA_SQL.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }

            sqlx::query(sql)
                .execute(&mut *conn)
                .await
                .map_err(PersistenceError::from)?;
        }

        Ok(())
    }

    async fn apply_migrations_to_latest(
        conn: &mut SqliteConnection,
    ) -> Result<(), PersistenceError> {
        // A valid project MUST have the SchemaVersion table.
        let has_schema_version = Self::table_exists(conn, "SchemaVersion").await?;
        if !has_schema_version {
            return Err(PersistenceError::Validation(format!(
                "{}This file is not a valid OpenRisk project or was created by an incompatible older version.",
                PROJECT_LEGACY_ERROR_PREFIX
            )));
        }

        let existing =
            sqlx::query_scalar::<_, i64>("SELECT version FROM SchemaVersion WHERE id = 1")
                .fetch_optional(&mut *conn)
                .await?;

        let current_version = match existing {
            Some(v) => v,
            None => {
                return Err(PersistenceError::Validation(format!(
                    "{}This file is not a valid OpenRisk project or was created by an incompatible older version.",
                    PROJECT_LEGACY_ERROR_PREFIX
                )));
            }
        };

        if current_version < MIN_SUPPORTED_SCHEMA_VERSION {
            return Err(PersistenceError::Validation(format!(
                "{}{}:This project was created with an older, incompatible version of OpenRisk (schema v{}). Please create a new project.",
                PROJECT_OUTDATED_ERROR_PREFIX,
                current_version,
                current_version
            )));
        }

        let mut version = current_version;

        while version < CURRENT_SCHEMA_VERSION {
            let next = version + 1;
            match next {
                5 => Self::migrate_to_v5(conn).await?,
                _ => {
                    return Err(PersistenceError::Validation(format!(
                        "Missing migration to schema version {}",
                        next
                    )))
                }
            }

            sqlx::query("UPDATE SchemaVersion SET version = ?1 WHERE id = 1")
                .bind(next)
                .execute(&mut *conn)
                .await?;
            version = next;
        }

        Ok(())
    }

    /// Migration v4 → v5:
    /// 1. Add `entrypoint_id` column to `ScanPluginResult`.
    /// 2. Convert `selected_plugins_json` in all Scan rows from
    ///    `["pluginId"]` → `[{"pluginId":"...", "entrypointId":"default"}]`.
    async fn migrate_to_v5(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        // 1. Add entrypoint_id column to ScanPluginResult if missing.
        let has_entrypoint_col =
            Self::column_exists(conn, "ScanPluginResult", "entrypoint_id").await?;
        if !has_entrypoint_col {
            sqlx::query(
                "ALTER TABLE ScanPluginResult ADD COLUMN entrypoint_id TEXT NOT NULL DEFAULT 'default'",
            )
            .execute(&mut *conn)
            .await?;
        }

        // 2. Migrate selected_plugins_json format on all Scan rows.
        let scan_rows: Vec<(String, Option<String>)> =
            sqlx::query_as("SELECT id, selected_plugins_json FROM Scan")
                .fetch_all(&mut *conn)
                .await?;

        for (scan_id, raw_opt) in scan_rows {
            let raw = match raw_opt {
                Some(r) if !r.trim().is_empty() => r,
                _ => continue,
            };

            let value: Value = match serde_json::from_str(&raw) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let items = match &value {
                Value::Array(arr) => arr,
                _ => continue,
            };

            // Already migrated if items are objects with a "pluginId" key.
            let already_new = items
                .iter()
                .any(|item| item.is_object() && item.get("pluginId").is_some());
            if already_new {
                continue;
            }

            let converted: Vec<Value> = items
                .iter()
                .filter_map(|item| {
                    item.as_str()
                        .map(|s| json!({ "pluginId": s, "entrypointId": "default" }))
                })
                .collect();

            let new_json = serde_json::to_string(&Value::Array(converted))?;
            sqlx::query("UPDATE Scan SET selected_plugins_json = ?1 WHERE id = ?2")
                .bind(new_json)
                .bind(scan_id)
                .execute(&mut *conn)
                .await?;
        }

        Ok(())
    }

    async fn column_exists(
        conn: &mut SqliteConnection,
        table: &str,
        column: &str,
    ) -> Result<bool, PersistenceError> {
        let query = format!("PRAGMA table_info({})", table);
        let rows: Vec<(i64, String, String, i64, Option<String>, i64)> =
            sqlx::query_as(&query).fetch_all(&mut *conn).await?;
        Ok(rows.iter().any(|(_, name, _, _, _, _)| name == column))
    }

    async fn table_exists(
        conn: &mut SqliteConnection,
        table: &str,
    ) -> Result<bool, PersistenceError> {
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
        )
        .bind(table)
        .fetch_optional(&mut *conn)
        .await?
        .is_some();
        Ok(exists)
    }

    fn normalize_theme(value: Option<String>) -> String {
        match value.as_deref() {
            Some("light") => "light".to_string(),
            Some("dark") => "dark".to_string(),
            Some("system") => "system".to_string(),
            _ => "system".to_string(),
        }
    }

    fn has_project_file_extension(path: &Path) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| {
                let lower = ext.to_ascii_lowercase();
                lower == "db" || lower == "orproj"
            })
            .unwrap_or(false)
    }

    fn create_db_path(project_path: &Path, trimmed_name: &str) -> PathBuf {
        if Self::has_project_file_extension(project_path) || project_path.extension().is_some() {
            return project_path.to_path_buf();
        }

        if project_path.exists() && project_path.is_file() {
            return project_path.to_path_buf();
        }

        project_path.join(format!("{}.orproj", trimmed_name))
    }

    fn db_path(project_path: &Path) -> PathBuf {
        if project_path.exists() && project_path.is_file() {
            return project_path.to_path_buf();
        }

        if Self::has_project_file_extension(project_path) {
            return project_path.to_path_buf();
        }

        project_path.join(DB_FILE_NAME)
    }

    async fn sync_local_plugins(
        conn: &mut SqliteConnection,
        project_settings_id: &str,
    ) -> Result<(), PersistenceError> {
        let bundles = discover_local_plugins()?;
        for plugin in bundles {
            Self::insert_plugin(conn, &plugin).await?;
            let settings_json_value = build_default_settings(&plugin.manifest);
            let settings_json = serde_json::to_string(&settings_json_value)?;

            sqlx::query(
                "INSERT INTO ProjectPluginSettings (plugin_id, project_settings_id, settings_json) VALUES (?1, ?2, ?3)",
            )
            .bind(&plugin.id)
            .bind(project_settings_id)
            .bind(settings_json)
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    }

    async fn insert_plugin(
        conn: &mut SqliteConnection,
        plugin: &LocalPluginBundle,
    ) -> Result<(), PersistenceError> {
        let version: String = plugin.manifest.version.clone().into();
        let name: String = plugin.manifest.name.clone().into();
        let inputs_json = serde_json::to_string(&plugin.manifest.inputs)?;
        let settings_schema_json = serde_json::to_string(&plugin.manifest.settings)?;
        let manifest_json = serde_json::to_string(&plugin.manifest_json)?;

        sqlx::query(
            "INSERT OR REPLACE INTO Plugin (id, version, name, input_schema_json, settings_schema_json, code, manifest_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(&plugin.id)
        .bind(&version)
        .bind(&name)
        .bind(inputs_json)
        .bind(settings_schema_json)
        .bind(&plugin.code)
        .bind(manifest_json)
        .execute(&mut *conn)
        .await?;

        Ok(())
    }
}

#[async_trait]
impl ProjectPersistence for SqliteProjectPersistence {
    async fn create_project(
        &self,
        name: &str,
        project_path: &Path,
    ) -> Result<ProjectSummary, PersistenceError> {
        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            return Err(PersistenceError::Validation(
                "Project name must not be empty".into(),
            ));
        }

        let db_path = Self::create_db_path(project_path, trimmed_name);
        if db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "Project file {:?} already exists. Rename project or open existing one.",
                db_path
            )));
        }

        let parent = db_path.parent().ok_or_else(|| {
            PersistenceError::Validation(format!("Invalid project file path: {:?}", db_path))
        })?;
        if !parent.exists() || !parent.is_dir() {
            return Err(PersistenceError::Validation(format!(
                "Project parent directory does not exist: {:?}",
                parent
            )));
        }

        let mut conn = Self::connect(&db_path, true, None).await?;
        Self::apply_schema(&mut conn).await?;
        // New projects always start at the current schema version — no migrations needed.
        sqlx::query("INSERT INTO SchemaVersion (id, version) VALUES (1, ?1)")
            .bind(CURRENT_SCHEMA_VERSION)
            .execute(&mut conn)
            .await?;

        let project_settings_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO ProjectSettings (id, description, locale, theme) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&project_settings_id)
        .bind("")
        .bind("en-US")
        .bind("system")
        .execute(&mut conn)
        .await?;

        let project_id = Uuid::new_v4().to_string();
        let audit: Option<String> = None;
        sqlx::query(
            "INSERT INTO Project (id, name, audit, project_settings_id) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&project_id)
        .bind(trimmed_name)
        .bind(audit)
        .bind(&project_settings_id)
        .execute(&mut conn)
        .await?;

        Self::sync_local_plugins(&mut conn, &project_settings_id).await?;

        Ok(ProjectSummary {
            id: project_id,
            name: trimmed_name.to_owned(),
            audit: None,
            directory: db_path,
        })
    }

    async fn open_project(&self, project_path: &Path) -> Result<ProjectSummary, PersistenceError> {
        let db_path = Self::db_path(project_path);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project database file at {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect_for_existing_project(&db_path).await?;
        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;
        let row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut conn)
        .await?;

        Ok(ProjectSummary {
            id: row.id,
            name: row.name,
            audit: row.audit,
            directory: db_path,
        })
    }

    async fn load_settings(
        &self,
        project_path: &Path,
    ) -> Result<ProjectSettingsPayload, PersistenceError> {
        let db_path = Self::db_path(project_path);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project database file at {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect_for_existing_project(&db_path).await?;
        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;
        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut conn)
        .await?;

        let project = ProjectSummary {
            id: project_row.id.clone(),
            name: project_row.name.clone(),
            audit: project_row.audit.clone(),
            directory: db_path,
        };

        let settings_row = sqlx::query_as::<_, ProjectSettingsRow>(
            "SELECT id, description, locale, theme FROM ProjectSettings WHERE id = ?1",
        )
        .bind(&project_row.project_settings_id)
        .fetch_one(&mut conn)
        .await?;

        let plugin_rows = sqlx::query_as::<_, PluginRow>(
            "SELECT \
                Plugin.id as plugin_id, \
                Plugin.name as plugin_name, \
                Plugin.version as plugin_version, \
                Plugin.input_schema_json as input_schema_json, \
                Plugin.settings_schema_json as settings_schema_json, \
                Plugin.manifest_json as manifest_json, \
                ProjectPluginSettings.settings_json as settings_json \
            FROM Plugin \
            INNER JOIN ProjectPluginSettings \
                ON ProjectPluginSettings.plugin_id = Plugin.id \
            WHERE ProjectPluginSettings.project_settings_id = ?1",
        )
        .bind(&settings_row.id)
        .fetch_all(&mut conn)
        .await?;

        let mut plugins = Vec::with_capacity(plugin_rows.len());
        for row in plugin_rows {
            plugins.push(row.into_payload()?);
        }

        Ok(ProjectSettingsPayload {
            project,
            project_settings: settings_row.into_record(),
            plugins,
        })
    }

    async fn update_project_settings(
        &self,
        project_path: &Path,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError> {
        let db_path = Self::db_path(project_path);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project database file at {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect_for_existing_project(&db_path).await?;
        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;

        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut conn)
        .await?;

        let normalized_theme = Self::normalize_theme(theme);

        sqlx::query("UPDATE ProjectSettings SET theme = ?1 WHERE id = ?2")
            .bind(normalized_theme)
            .bind(&project_row.project_settings_id)
            .execute(&mut conn)
            .await?;

        let settings_row = sqlx::query_as::<_, ProjectSettingsRow>(
            "SELECT id, description, locale, theme FROM ProjectSettings WHERE id = ?1",
        )
        .bind(&project_row.project_settings_id)
        .fetch_one(&mut conn)
        .await?;

        Ok(settings_row.into_record())
    }

    async fn update_project_plugin_settings(
        &self,
        project_path: &Path,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        if !settings.is_object() {
            return Err(PersistenceError::Validation(
                "Plugin settings must be a JSON object".to_string(),
            ));
        }

        let db_path = Self::db_path(project_path);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project database file at {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect_for_existing_project(&db_path).await?;
        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;

        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut conn)
        .await?;

        let settings_json = serde_json::to_string(&settings)?;

        let update_result = sqlx::query(
            "UPDATE ProjectPluginSettings SET settings_json = ?1 WHERE plugin_id = ?2 AND project_settings_id = ?3",
        )
        .bind(&settings_json)
        .bind(plugin_id)
        .bind(&project_row.project_settings_id)
        .execute(&mut conn)
        .await?;

        if update_result.rows_affected() == 0 {
            return Err(PersistenceError::Validation(format!(
                "Plugin '{}' is not configured for this project",
                plugin_id
            )));
        }

        let row = sqlx::query_as::<_, PluginRow>(
            "SELECT \
                Plugin.id as plugin_id, \
                Plugin.name as plugin_name, \
                Plugin.version as plugin_version, \
                Plugin.input_schema_json as input_schema_json, \
                Plugin.settings_schema_json as settings_schema_json, \
                Plugin.manifest_json as manifest_json, \
                ProjectPluginSettings.settings_json as settings_json \
            FROM Plugin \
            INNER JOIN ProjectPluginSettings \
                ON ProjectPluginSettings.plugin_id = Plugin.id \
            WHERE ProjectPluginSettings.project_settings_id = ?1 \
              AND Plugin.id = ?2",
        )
        .bind(&project_row.project_settings_id)
        .bind(plugin_id)
        .fetch_one(&mut conn)
        .await?;

        row.into_payload()
    }
}

#[derive(sqlx::FromRow)]
struct ProjectRow {
    id: String,
    name: String,
    audit: Option<String>,
    project_settings_id: String,
}

#[derive(sqlx::FromRow)]
struct ProjectSettingsRow {
    id: String,
    description: Option<String>,
    locale: Option<String>,
    theme: Option<String>,
}

impl ProjectSettingsRow {
    fn into_record(self) -> ProjectSettingsRecord {
        ProjectSettingsRecord {
            id: self.id,
            description: self.description.unwrap_or_default(),
            locale: self.locale.unwrap_or_else(|| "en-US".to_string()),
            theme: SqliteProjectPersistence::normalize_theme(self.theme),
        }
    }
}

#[derive(sqlx::FromRow)]
struct PluginRow {
    plugin_id: String,
    plugin_name: String,
    plugin_version: String,
    input_schema_json: Option<String>,
    settings_schema_json: Option<String>,
    manifest_json: Option<String>,
    settings_json: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ScanRow {
    id: String,
    status: String,
    preview: Option<String>,
    inputs_json: Option<String>,
    selected_plugins_json: Option<String>,
}

impl ScanRow {
    fn into_record(self) -> ScanSummaryRecord {
        ScanSummaryRecord {
            id: self.id,
            status: self.status,
            preview: self.preview,
        }
    }
}

#[derive(sqlx::FromRow)]
struct ScanResultRow {
    plugin_id: String,
    entrypoint_id: String,
    output_json_ir: Option<String>,
}

impl PluginRow {
    fn into_payload(self) -> Result<PluginSettingsPayload, PersistenceError> {
        let manifest = parse_json_text(self.manifest_json)?;
        let input_schema = parse_json_text(self.input_schema_json)?;
        let settings_schema = parse_json_text(self.settings_schema_json)?;
        let mut settings = parse_json_text(self.settings_json)?;
        if !settings.is_object() {
            settings = Value::Object(Map::new());
        }

        Ok(PluginSettingsPayload {
            id: self.plugin_id,
            name: self.plugin_name,
            version: self.plugin_version,
            manifest,
            input_schema,
            settings_schema,
            settings,
        })
    }
}

fn parse_json_text(raw: Option<String>) -> Result<Value, PersistenceError> {
    match raw {
        Some(text) if !text.trim().is_empty() => Ok(serde_json::from_str(&text)?),
        _ => Ok(Value::Null),
    }
}

/// Given a manifest JSON value and an entrypoint id, return the TypeScript function name to call.
/// Falls back to `entrypoint_id` itself if not found (or "default" if id is "default").
fn resolve_entrypoint_function(manifest: &Value, entrypoint_id: &str) -> String {
    if let Some(entrypoints) = manifest.get("entrypoints").and_then(|v| v.as_array()) {
        for ep in entrypoints {
            if ep.get("id").and_then(|v| v.as_str()) == Some(entrypoint_id) {
                if let Some(func) = ep.get("function").and_then(|v| v.as_str()) {
                    return func.to_string();
                }
            }
        }
    }
    // Default export or fallback: treat entrypoint_id as the function name.
    entrypoint_id.to_string()
}

pub async fn create_project(name: String, dir_path: PathBuf) -> Result<ProjectSummary, String> {
    let store = SqliteProjectPersistence::new();
    store
        .create_project(&name, &dir_path)
        .await
        .map_err(|e| e.to_string())
}

pub async fn open_project(dir_path: PathBuf) -> Result<ProjectSummary, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }
    let store = SqliteProjectPersistence::new();
    store
        .open_project(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

pub async fn load_settings(dir_path: PathBuf) -> Result<ProjectSettingsPayload, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }
    let store = SqliteProjectPersistence::new();
    store
        .load_settings(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

pub async fn update_project_settings(
    dir_path: PathBuf,
    theme: Option<String>,
) -> Result<ProjectSettingsRecord, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let store = SqliteProjectPersistence::new();
    store
        .update_project_settings(&dir_path, theme)
        .await
        .map_err(|e| e.to_string())
}

pub async fn update_project_name(
    dir_path: PathBuf,
    name: String,
) -> Result<ProjectSummary, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let next_name = name.trim().to_string();
    if next_name.is_empty() {
        return Err("Project name must not be empty".to_string());
    }

    let mut conn = SqliteProjectPersistence::connect_for_existing_project(&db_path)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let project_row = sqlx::query_as::<_, ProjectRow>(
        "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
    )
    .fetch_one(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE Project SET name = ?1 WHERE id = ?2")
        .bind(&next_name)
        .bind(&project_row.id)
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ProjectSummary {
        id: project_row.id,
        name: next_name,
        audit: project_row.audit,
        directory: db_path,
    })
}

pub async fn update_project_plugin_settings(
    dir_path: PathBuf,
    plugin_id: String,
    settings: Value,
) -> Result<PluginSettingsPayload, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let store = SqliteProjectPersistence::new();
    store
        .update_project_plugin_settings(&dir_path, &plugin_id, settings)
        .await
        .map_err(|e| e.to_string())
}

pub async fn upsert_project_plugin_from_dir(
    dir_path: PathBuf,
    plugin_dir: PathBuf,
    replace_plugin_id: Option<String>,
) -> Result<PluginSettingsPayload, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }
    if !plugin_dir.exists() || !plugin_dir.is_dir() {
        return Err(format!("Plugin directory does not exist: {:?}", plugin_dir));
    }

    let manifest_id = extract_manifest_id(&plugin_dir).map_err(|e| e.to_string())?;
    let plugin_id = match replace_plugin_id {
        Some(id) if !id.trim().is_empty() => id.trim().to_string(),
        _ => manifest_id,
    };

    let bundle =
        load_plugin_bundle_with_id(&plugin_dir, plugin_id.clone()).map_err(|e| e.to_string())?;

    let mut conn = SqliteProjectPersistence::connect_for_existing_project(&db_path)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let project_settings_id: String =
        sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
            .fetch_one(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

    SqliteProjectPersistence::insert_plugin(&mut conn, &bundle)
        .await
        .map_err(|e| e.to_string())?;

    let existing_settings_json: Option<String> = sqlx::query_scalar(
        "SELECT settings_json FROM ProjectPluginSettings WHERE plugin_id = ?1 AND project_settings_id = ?2 LIMIT 1",
    )
    .bind(&plugin_id)
    .bind(&project_settings_id)
    .fetch_optional(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    let default_settings = build_default_settings(&bundle.manifest);
    let mut merged_settings = if let Some(raw) = existing_settings_json {
        serde_json::from_str::<Value>(&raw).unwrap_or(Value::Object(Map::new()))
    } else {
        Value::Object(Map::new())
    };

    if !merged_settings.is_object() {
        merged_settings = Value::Object(Map::new());
    }

    if let (Value::Object(ref mut merged), Value::Object(defaults)) =
        (&mut merged_settings, default_settings)
    {
        for (key, value) in defaults {
            merged.entry(key).or_insert(value);
        }
    }

    let merged_json = serde_json::to_string(&merged_settings).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO ProjectPluginSettings (plugin_id, project_settings_id, settings_json)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(plugin_id, project_settings_id) DO UPDATE SET settings_json = excluded.settings_json",
    )
    .bind(&plugin_id)
    .bind(&project_settings_id)
    .bind(merged_json)
    .execute(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, PluginRow>(
        "SELECT \
            Plugin.id as plugin_id, \
            Plugin.name as plugin_name, \
            Plugin.version as plugin_version, \
            Plugin.input_schema_json as input_schema_json, \
            Plugin.settings_schema_json as settings_schema_json, \
            Plugin.manifest_json as manifest_json, \
            ProjectPluginSettings.settings_json as settings_json \
        FROM Plugin \
        INNER JOIN ProjectPluginSettings \
            ON ProjectPluginSettings.plugin_id = Plugin.id \
        WHERE ProjectPluginSettings.project_settings_id = ?1 \
          AND Plugin.id = ?2",
    )
    .bind(&project_settings_id)
    .bind(&plugin_id)
    .fetch_one(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    row.into_payload().map_err(|e| e.to_string())
}

pub async fn create_scan(
    dir_path: PathBuf,
    preview: Option<String>,
) -> Result<ScanSummaryRecord, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let mut conn = SqliteProjectPersistence::connect_for_existing_project(&db_path)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let fallback_preview = format!("New Scan {}", &id[..8]);
    let final_preview = preview
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or(fallback_preview);
    let inputs_json = "{}".to_string();
    let selected_plugins_json = "[]".to_string();

    sqlx::query(
        "INSERT INTO Scan (id, project_id, status, preview, inputs_json, selected_plugins_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(&project_id)
    .bind("Draft")
    .bind(final_preview.clone())
    .bind(inputs_json)
    .bind(selected_plugins_json)
    .execute(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    Ok(ScanSummaryRecord {
        id,
        status: "Draft".to_string(),
        preview: Some(final_preview),
    })
}

pub async fn update_scan_preview(
    dir_path: PathBuf,
    scan_id: String,
    preview: String,
) -> Result<ScanSummaryRecord, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let next_preview = preview.trim().to_string();
    if next_preview.is_empty() {
        return Err("Scan name must not be empty".to_string());
    }

    let mut conn = SqliteProjectPersistence::connect_for_existing_project(&db_path)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let current = sqlx::query_as::<_, ScanRow>(
        "SELECT id, status, preview, inputs_json, selected_plugins_json FROM Scan WHERE id = ?1 LIMIT 1",
    )
    .bind(&scan_id)
    .fetch_one(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE Scan SET preview = ?1 WHERE id = ?2")
        .bind(&next_preview)
        .bind(&scan_id)
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ScanSummaryRecord {
        id: scan_id,
        status: current.status,
        preview: Some(next_preview),
    })
}

pub async fn list_scans(dir_path: PathBuf) -> Result<Vec<ScanSummaryRecord>, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let mut conn = SqliteProjectPersistence::connect_for_existing_project(&db_path)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let rows = sqlx::query_as::<_, ScanRow>(
        "SELECT id, status, preview, inputs_json, selected_plugins_json FROM Scan WHERE project_id = ?1 ORDER BY rowid DESC",
    )
    .bind(project_id)
    .fetch_all(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|row| row.into_record()).collect())
}

pub async fn get_scan(dir_path: PathBuf, scan_id: String) -> Result<ScanDetailRecord, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let mut conn = SqliteProjectPersistence::connect_for_existing_project(&db_path)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let scan = sqlx::query_as::<_, ScanRow>(
        "SELECT id, status, preview, inputs_json, selected_plugins_json FROM Scan WHERE id = ?1 LIMIT 1",
    )
    .bind(&scan_id)
    .fetch_one(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    let inputs = parse_json_text(scan.inputs_json).map_err(|e| e.to_string())?;
    let selected_plugins_raw =
        parse_json_text(scan.selected_plugins_json).map_err(|e| e.to_string())?;
    let selected_plugins: Vec<PluginEntrypointSelection> = match selected_plugins_raw {
        Value::Array(items) => items
            .into_iter()
            .filter_map(|v| serde_json::from_value(v).ok())
            .collect(),
        _ => Vec::new(),
    };

    let result_rows = sqlx::query_as::<_, ScanResultRow>(
        "SELECT plugin_id, entrypoint_id, output_json_ir FROM ScanPluginResult WHERE scan_id = ?1",
    )
    .bind(&scan.id)
    .fetch_all(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    let mut results = Vec::with_capacity(result_rows.len());
    for row in result_rows {
        let output = parse_json_text(row.output_json_ir).map_err(|e| e.to_string())?;
        results.push(ScanPluginResultRecord {
            plugin_id: row.plugin_id,
            entrypoint_id: row.entrypoint_id,
            output,
        });
    }

    Ok(ScanDetailRecord {
        id: scan.id,
        status: scan.status,
        preview: scan.preview,
        selected_plugins,
        inputs,
        results,
    })
}

pub async fn run_scan(
    dir_path: PathBuf,
    scan_id: String,
    selected_plugins: Vec<PluginEntrypointSelection>,
    inputs: Value,
) -> Result<ScanSummaryRecord, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }
    if selected_plugins.is_empty() {
        return Err("Select at least one plugin entrypoint before run".to_string());
    }

    let mut conn = SqliteProjectPersistence::connect_for_existing_project(&db_path)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let scan = sqlx::query_as::<_, ScanRow>(
        "SELECT id, status, preview, inputs_json, selected_plugins_json FROM Scan WHERE id = ?1 LIMIT 1",
    )
    .bind(&scan_id)
    .fetch_one(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    if scan.status != "Draft" {
        return Err("Scan already launched and cannot be rerun".to_string());
    }

    let project_settings_id: String =
        sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
            .fetch_one(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

    let selected_plugins_json =
        serde_json::to_string(&selected_plugins).map_err(|e| e.to_string())?;
    let inputs_json = serde_json::to_string(&inputs).map_err(|e| e.to_string())?;

    sqlx::query("UPDATE Scan SET status = 'Running', selected_plugins_json = ?1, inputs_json = ?2 WHERE id = ?3")
        .bind(&selected_plugins_json)
        .bind(&inputs_json)
        .bind(&scan_id)
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM ScanPluginResult WHERE scan_id = ?1")
        .bind(&scan_id)
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    // Load fresh plugin code from disk so runtime source changes take effect without DB re-sync.
    let fresh_code_by_id: HashMap<String, String> = discover_local_plugins()
        .unwrap_or_default()
        .into_iter()
        .map(|b| (b.id, b.code))
        .collect();

    let inputs_by_key = if inputs.is_object() {
        inputs
    } else {
        Value::Object(Map::new())
    };

    for selection in &selected_plugins {
        let ep_key = format!("{}::{}", selection.plugin_id, selection.entrypoint_id);
        let plugin_inputs = inputs_by_key
            .get(&ep_key)
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));

        let runtime_row = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>)>(
            "SELECT ProjectPluginSettings.settings_json, Plugin.code, Plugin.manifest_json
             FROM ProjectPluginSettings
             INNER JOIN Plugin ON Plugin.id = ProjectPluginSettings.plugin_id
             WHERE ProjectPluginSettings.plugin_id = ?1 AND ProjectPluginSettings.project_settings_id = ?2
             LIMIT 1",
        )
        .bind(&selection.plugin_id)
        .bind(&project_settings_id)
        .fetch_optional(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

        let envelope = match runtime_row {
            None => {
                json!({ "ok": false, "error": format!("Plugin '{}' is not registered in this project", selection.plugin_id) })
            }
            Some((settings_json, plugin_code, manifest_json_raw)) => {
                let plugin_settings = match settings_json {
                    Some(raw) if !raw.trim().is_empty() => {
                        serde_json::from_str::<Value>(&raw).unwrap_or(Value::Object(Map::new()))
                    }
                    _ => Value::Object(Map::new()),
                };

                let manifest_val: Value = manifest_json_raw
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or(Value::Null);

                let entrypoint_fn =
                    resolve_entrypoint_function(&manifest_val, &selection.entrypoint_id);

                // Prefer fresh code from disk; fall back to DB snapshot.
                let code = fresh_code_by_id
                    .get(&selection.plugin_id)
                    .cloned()
                    .or(plugin_code)
                    .filter(|c| !c.trim().is_empty());
                match code {
                    None => {
                        json!({ "ok": false, "error": format!("Plugin '{}' has no code in project database", selection.plugin_id) })
                    }
                    Some(code) => {
                        let execute_result = tauri::async_runtime::spawn_blocking(move || {
                            plugin_app::execute_plugin_code_with_settings(
                                code,
                                plugin_inputs,
                                plugin_settings,
                                Some(entrypoint_fn),
                            )
                        })
                        .await
                        .map_err(|e| format!("Failed to join plugin execution task: {}", e))?;

                        match execute_result {
                            Ok(output) => json!({ "ok": true, "data": output }),
                            Err(err) => json!({ "ok": false, "error": err }),
                        }
                    }
                }
            }
        };

        let envelope_json = serde_json::to_string(&envelope).map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO ScanPluginResult (id, plugin_id, entrypoint_id, scan_id, output_json_ir) VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&selection.plugin_id)
        .bind(&selection.entrypoint_id)
        .bind(&scan_id)
        .bind(envelope_json)
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    }

    sqlx::query("UPDATE Scan SET status = 'Completed' WHERE id = ?1")
        .bind(&scan_id)
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ScanSummaryRecord {
        id: scan_id,
        status: "Completed".to_string(),
        preview: scan.preview,
    })
}

pub async fn get_project_lock_status(dir_path: PathBuf) -> Result<ProjectLockStatus, String> {
    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    SqliteProjectPersistence::read_lock_status(&db_path).await
}

pub async fn unlock_project(
    dir_path: PathBuf,
    password: String,
) -> Result<ProjectLockStatus, String> {
    validate_non_empty_password(&password, "Password")?;

    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let status = SqliteProjectPersistence::read_lock_status(&db_path).await?;
    if !status.locked {
        return Ok(ProjectLockStatus {
            locked: false,
            unlocked: true,
        });
    }

    let mut conn = SqliteProjectPersistence::connect(&db_path, false, Some(&password))
        .await
        .map_err(|err| {
            if SqliteProjectPersistence::is_encrypted_error(&err) {
                "Invalid password".to_string()
            } else {
                err.to_string()
            }
        })?;
    SqliteProjectPersistence::apply_schema(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    SqliteProjectPersistence::apply_migrations_to_latest(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    cache_key(&db_path, password);

    Ok(ProjectLockStatus {
        locked: true,
        unlocked: true,
    })
}

pub async fn set_project_password(
    dir_path: PathBuf,
    new_password: String,
) -> Result<ProjectLockStatus, String> {
    validate_password(&new_password)?;

    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    let status = SqliteProjectPersistence::read_lock_status(&db_path).await?;
    if status.locked && !status.unlocked {
        return Err(lock_error());
    }

    let source_key = if status.locked {
        get_cached_key(&db_path)
    } else {
        None
    };
    if status.locked && source_key.is_none() {
        return Err(lock_error());
    }
    SqliteProjectPersistence::rewrite_database_with_key(
        &db_path,
        source_key.as_deref(),
        Some(new_password.as_str()),
    )
    .await?;

    cache_key(&db_path, new_password);

    Ok(ProjectLockStatus {
        locked: true,
        unlocked: true,
    })
}

pub async fn change_project_password(
    dir_path: PathBuf,
    current_password: String,
    new_password: String,
) -> Result<ProjectLockStatus, String> {
    validate_password(&new_password)?;
    validate_non_empty_password(&current_password, "Current password")?;

    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    SqliteProjectPersistence::rewrite_database_with_key(
        &db_path,
        Some(current_password.as_str()),
        Some(new_password.as_str()),
    )
    .await?;

    cache_key(&db_path, new_password);

    Ok(ProjectLockStatus {
        locked: true,
        unlocked: true,
    })
}

pub async fn remove_project_password(
    dir_path: PathBuf,
    current_password: String,
) -> Result<ProjectLockStatus, String> {
    validate_non_empty_password(&current_password, "Current password")?;

    let db_path = SqliteProjectPersistence::db_path(&dir_path);
    if !db_path.exists() {
        return Err(format!("No project database file found at {:?}", db_path));
    }

    SqliteProjectPersistence::rewrite_database_with_key(
        &db_path,
        Some(current_password.as_str()),
        None,
    )
    .await?;

    clear_cached_key(&db_path);

    Ok(ProjectLockStatus {
        locked: false,
        unlocked: true,
    })
}
