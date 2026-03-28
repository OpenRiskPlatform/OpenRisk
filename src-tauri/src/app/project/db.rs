//! SQLite persistence layer for projects.
//!
//! Defines the [`ProjectPersistence`] trait, which abstracts all project storage operations
//! so that alternative implementations (e.g. in-memory SQLite for tests) can be swapped in.
//! [`SqliteProjectPersistence`] is the production implementation backed by SQLCipher.

use super::plugins::{
    build_default_settings, discover_local_plugins, extract_manifest_id,
    load_plugin_bundle_with_id, sidecar_path, LocalPluginBundle,
};
use super::security::{
    cache_key, clear_cached_key, escape_sql_literal, get_cached_key, lock_error,
};
use super::types::{
    PersistenceError, PluginEntrypointSelection, PluginSettingsPayload, ProjectLockStatus,
    ProjectSettingsPayload, ProjectSettingsRecord, ProjectSummary, ScanDetailRecord,
    ScanPluginResultRecord, ScanSummaryRecord,
};
use async_trait::async_trait;
use serde_json::{json, Map, Value};
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::time::Duration;
use uuid::Uuid;

const DB_FILE_NAME: &str = "project.db";
const CURRENT_SCHEMA_VERSION: i64 = 5;
/// The minimum schema version that can be migrated to current.
/// Projects with version < MIN_SUPPORTED_SCHEMA_VERSION are rejected.
const MIN_SUPPORTED_SCHEMA_VERSION: i64 = 4;

const PROJECT_LEGACY_ERROR_PREFIX: &str = "PROJECT_LEGACY:";
const PROJECT_OUTDATED_ERROR_PREFIX: &str = "PROJECT_OUTDATED:";

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

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Complete abstraction over project storage.
///
/// All project, scan, and security operations are expressed as trait methods so that
/// alternative implementations (e.g. in-memory SQLite) can be injected for testing.
#[async_trait]
pub trait ProjectPersistence: Send + Sync {
    /// Create a new project database at `parent_dir`.
    async fn create_project(
        &self,
        name: &str,
        parent_dir: &Path,
    ) -> Result<ProjectSummary, PersistenceError>;

    /// Open an existing project database at `project_dir`.
    async fn open_project(&self, project_dir: &Path) -> Result<ProjectSummary, PersistenceError>;

    /// Load the full settings snapshot (project + global settings + all plugin configs).
    async fn load_settings(
        &self,
        project_dir: &Path,
    ) -> Result<ProjectSettingsPayload, PersistenceError>;

    /// Update the project-wide theme setting.
    async fn update_project_settings(
        &self,
        project_dir: &Path,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError>;

    /// Rename the project.
    async fn update_project_name(
        &self,
        project_dir: &Path,
        name: &str,
    ) -> Result<ProjectSummary, PersistenceError>;

    /// Persist updated settings for one plugin within this project.
    async fn update_project_plugin_settings(
        &self,
        project_dir: &Path,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError>;

    /// Register or refresh a plugin from a directory on disk into this project.
    async fn upsert_project_plugin_from_dir(
        &self,
        project_dir: &Path,
        plugin_dir: &Path,
        replace_plugin_id: Option<String>,
    ) -> Result<PluginSettingsPayload, PersistenceError>;

    /// Create a new scan in Draft status.
    async fn create_scan(
        &self,
        project_dir: &Path,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// List all scans for the project, newest first.
    async fn list_scans(
        &self,
        project_dir: &Path,
    ) -> Result<Vec<ScanSummaryRecord>, PersistenceError>;

    /// Fetch full details of a single scan including all plugin results.
    async fn get_scan(
        &self,
        project_dir: &Path,
        scan_id: &str,
    ) -> Result<ScanDetailRecord, PersistenceError>;

    /// Execute a scan: run the selected plugins and persist results.
    async fn run_scan(
        &self,
        project_dir: &Path,
        scan_id: &str,
        selected_plugins: Vec<PluginEntrypointSelection>,
        inputs: Value,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// Update the preview (display name) of a scan.
    async fn update_scan_preview(
        &self,
        project_dir: &Path,
        scan_id: &str,
        preview: String,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// Return the encryption / unlock state of the project database.
    async fn get_project_lock_status(
        &self,
        project_dir: &Path,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Attempt to unlock the project with the given password and cache the key.
    async fn unlock_project(
        &self,
        project_dir: &Path,
        password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Encrypt an unencrypted project database with `new_password`.
    async fn set_project_password(
        &self,
        project_dir: &Path,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Re-encrypt a database, replacing the current password with a new one.
    async fn change_project_password(
        &self,
        project_dir: &Path,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Remove encryption from the project database.
    async fn remove_project_password(
        &self,
        project_dir: &Path,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;
}

// ---------------------------------------------------------------------------
// Production implementation
// ---------------------------------------------------------------------------

/// Production SQLite/SQLCipher-backed project store.
pub struct SqliteProjectPersistence;

impl SqliteProjectPersistence {
    pub fn new() -> Self {
        Self
    }

    // --- connection helpers ---------------------------------------------------

    /// Open a SQLite connection, optionally with a SQLCipher key.
    pub(super) async fn connect(
        db_path: &Path,
        create_if_missing: bool,
        key: Option<&str>,
    ) -> Result<SqliteConnection, PersistenceError> {
        let options = SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(create_if_missing)
            .busy_timeout(Duration::from_secs(5));

        let mut conn = SqliteConnection::connect_with(&options).await?;

        if let Some(password) = key {
            let pragma = format!("PRAGMA key = '{}';", escape_sql_literal(password));
            sqlx::query(&pragma).execute(&mut conn).await?;
        }

        // Force key validation for SQLCipher databases.
        sqlx::query("SELECT count(1) FROM sqlite_master")
            .fetch_one(&mut conn)
            .await?;

        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&mut conn)
            .await?;
        sqlx::query("PRAGMA journal_mode = WAL;")
            .execute(&mut conn)
            .await?;

        Ok(conn)
    }

    /// Return `true` when the error indicates the database file is encrypted.
    pub(super) fn is_encrypted_error(err: &PersistenceError) -> bool {
        match err {
            PersistenceError::Database(db_err) => {
                let msg = db_err.to_string().to_ascii_lowercase();
                msg.contains("file is encrypted") || msg.contains("not a database")
            }
            _ => false,
        }
    }

    /// Open an existing project database, using the cached key when available.
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

    /// Open, apply schema, and run pending migrations in one call.
    async fn open_connection(db_path: &Path) -> Result<SqliteConnection, PersistenceError> {
        let mut conn = Self::connect_for_existing_project(db_path).await?;
        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;
        Ok(conn)
    }

    /// Resolve the database path and verify the file exists.
    fn existing_db_path(project_dir: &Path) -> Result<PathBuf, PersistenceError> {
        let db_path = Self::db_path(project_dir);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project database file at {:?}",
                db_path
            )));
        }
        Ok(db_path)
    }

    /// Read the encryption / unlock state without needing the key.
    async fn read_lock_status(db_path: &Path) -> Result<ProjectLockStatus, PersistenceError> {
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
            Err(err) => Err(err),
        }
    }

    // --- schema & migrations --------------------------------------------------

    /// Apply the DDL schema (idempotent; uses `CREATE TABLE IF NOT EXISTS`).
    async fn apply_schema(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        for statement in SCHEMA_SQL.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql).execute(&mut *conn).await?;
        }
        Ok(())
    }

    /// Run all pending migrations up to `CURRENT_SCHEMA_VERSION`.
    async fn apply_migrations_to_latest(
        conn: &mut SqliteConnection,
    ) -> Result<(), PersistenceError> {
        let has_schema_version = Self::table_exists(conn, "SchemaVersion").await?;
        if !has_schema_version {
            return Err(PersistenceError::Validation(format!(
                "{}This file is not a valid OpenRisk project or was created by an incompatible older version.",
                PROJECT_LEGACY_ERROR_PREFIX
            )));
        }

        let current_version = sqlx::query_scalar::<_, i64>(
            "SELECT version FROM SchemaVersion WHERE id = 1",
        )
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| {
            PersistenceError::Validation(format!(
                "{}This file is not a valid OpenRisk project or was created by an incompatible older version.",
                PROJECT_LEGACY_ERROR_PREFIX
            ))
        })?;

        if current_version < MIN_SUPPORTED_SCHEMA_VERSION {
            return Err(PersistenceError::Validation(format!(
                "{}{}:This project was created with an older, incompatible version of OpenRisk (schema v{}). Please create a new project.",
                PROJECT_OUTDATED_ERROR_PREFIX, current_version, current_version
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
        let has_col = Self::column_exists(conn, "ScanPluginResult", "entrypoint_id").await?;
        if !has_col {
            sqlx::query(
                "ALTER TABLE ScanPluginResult ADD COLUMN entrypoint_id TEXT NOT NULL DEFAULT 'default'",
            )
            .execute(&mut *conn)
            .await?;
        }

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
        let rows: Vec<(i64, String, String, i64, Option<String>, i64)> =
            sqlx::query_as(&format!("PRAGMA table_info({})", table))
                .fetch_all(&mut *conn)
                .await?;
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

    // --- plugin sync -----------------------------------------------------------

    /// Sync all built-in local plugins into the project (used on create / open).
    async fn sync_local_plugins(
        conn: &mut SqliteConnection,
        project_settings_id: &str,
    ) -> Result<(), PersistenceError> {
        for plugin in discover_local_plugins()? {
            Self::insert_plugin(conn, &plugin).await?;
            let settings_json = serde_json::to_string(&build_default_settings(&plugin.manifest))?;
            sqlx::query(
                "INSERT INTO ProjectPluginSettings (plugin_id, project_settings_id, settings_json) \
                 VALUES (?1, ?2, ?3)",
            )
            .bind(&plugin.id)
            .bind(project_settings_id)
            .bind(settings_json)
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    }

    /// Insert or replace a plugin record in the database.
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
            "INSERT OR REPLACE INTO Plugin \
             (id, version, name, input_schema_json, settings_schema_json, code, manifest_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
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

    // --- path helpers ---------------------------------------------------------

    fn normalize_theme(value: Option<String>) -> String {
        match value.as_deref() {
            Some("light") => "light".to_string(),
            Some("dark") => "dark".to_string(),
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

    /// Resolve (or construct) the `.orproj` database path for a new project.
    pub(super) fn create_db_path(project_path: &Path, trimmed_name: &str) -> PathBuf {
        if Self::has_project_file_extension(project_path) || project_path.extension().is_some() {
            return project_path.to_path_buf();
        }
        if project_path.exists() && project_path.is_file() {
            return project_path.to_path_buf();
        }
        project_path.join(format!("{}.orproj", trimmed_name))
    }

    /// Resolve the database path for an existing project directory or file.
    pub fn db_path(project_path: &Path) -> PathBuf {
        if project_path.exists() && project_path.is_file() {
            return project_path.to_path_buf();
        }
        if Self::has_project_file_extension(project_path) {
            return project_path.to_path_buf();
        }
        project_path.join(DB_FILE_NAME)
    }

    // --- encryption helpers ---------------------------------------------------

    pub(super) fn cleanup_sidecars(db_path: &Path) {
        let _ = fs::remove_file(sidecar_path(db_path, "-wal"));
        let _ = fs::remove_file(sidecar_path(db_path, "-shm"));
    }

    /// Re-encrypt (or decrypt) a SQLCipher database via `sqlcipher_export`.
    ///
    /// Atomically replaces the original file; keeps a pre-rekey backup that is
    /// removed on success and restored on failure.
    async fn rewrite_database_with_key(
        db_path: &Path,
        source_key: Option<&str>,
        target_key: Option<&str>,
    ) -> Result<(), PersistenceError> {
        let parent = db_path.parent().ok_or_else(|| {
            PersistenceError::Validation(format!("Invalid database path: {:?}", db_path))
        })?;
        if !parent.exists() || !parent.is_dir() {
            return Err(PersistenceError::Validation(format!(
                "Database parent directory does not exist: {:?}",
                parent
            )));
        }

        let mut temp_path = db_path.to_path_buf();
        let temp_ext = match db_path.extension().and_then(|ext| ext.to_str()) {
            Some(ext) if !ext.is_empty() => format!("{}.tmp", ext),
            _ => "tmp".to_string(),
        };
        temp_path.set_extension(temp_ext);

        let _ = fs::remove_file(&temp_path);
        Self::cleanup_sidecars(&temp_path);
        File::create(&temp_path).map_err(PersistenceError::Io)?;

        let mut conn = Self::connect(db_path, false, source_key)
            .await
            .map_err(|err| {
                if Self::is_encrypted_error(&err) {
                    PersistenceError::Validation("Invalid current password".to_string())
                } else {
                    err
                }
            })?;

        let escaped_temp = escape_sql_literal(&temp_path.to_string_lossy());
        let attach_sql = match target_key {
            Some(password) => format!(
                "ATTACH DATABASE '{}' AS __openrisk_rekey__ KEY '{}';",
                escaped_temp,
                escape_sql_literal(password)
            ),
            None => format!(
                "ATTACH DATABASE '{}' AS __openrisk_rekey__ KEY '';",
                escaped_temp
            ),
        };

        sqlx::query(&attach_sql).execute(&mut conn).await?;
        sqlx::query("SELECT sqlcipher_export('__openrisk_rekey__');")
            .execute(&mut conn)
            .await?;
        sqlx::query("DETACH DATABASE __openrisk_rekey__;")
            .execute(&mut conn)
            .await?;
        drop(conn);

        Self::cleanup_sidecars(db_path);
        let backup_path = sidecar_path(db_path, "pre-rekey-backup");
        let _ = fs::remove_file(&backup_path);
        fs::rename(db_path, &backup_path).map_err(PersistenceError::Io)?;

        match fs::rename(&temp_path, db_path) {
            Ok(_) => {
                let _ = fs::remove_file(&backup_path);
                Self::cleanup_sidecars(db_path);
                Ok(())
            }
            Err(err) => {
                let _ = fs::rename(&backup_path, db_path);
                let _ = fs::remove_file(&temp_path);
                Err(PersistenceError::Io(err))
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Trait implementation
// ---------------------------------------------------------------------------

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
        sqlx::query(
            "INSERT INTO Project (id, name, audit, project_settings_id) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&project_id)
        .bind(trimmed_name)
        .bind(Option::<String>::None)
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
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;
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
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

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
            "SELECT Plugin.id as plugin_id, Plugin.name as plugin_name, \
             Plugin.version as plugin_version, Plugin.input_schema_json as input_schema_json, \
             Plugin.settings_schema_json as settings_schema_json, \
             Plugin.manifest_json as manifest_json, \
             ProjectPluginSettings.settings_json as settings_json \
             FROM Plugin \
             INNER JOIN ProjectPluginSettings ON ProjectPluginSettings.plugin_id = Plugin.id \
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
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

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

        sqlx::query_as::<_, ProjectSettingsRow>(
            "SELECT id, description, locale, theme FROM ProjectSettings WHERE id = ?1",
        )
        .bind(&project_row.project_settings_id)
        .fetch_one(&mut conn)
        .await
        .map(|r| r.into_record())
        .map_err(Into::into)
    }

    async fn update_project_name(
        &self,
        project_path: &Path,
        name: &str,
    ) -> Result<ProjectSummary, PersistenceError> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(PersistenceError::Validation(
                "Project name must not be empty".into(),
            ));
        }
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut conn)
        .await?;

        sqlx::query("UPDATE Project SET name = ?1 WHERE id = ?2")
            .bind(trimmed)
            .bind(&row.id)
            .execute(&mut conn)
            .await?;

        Ok(ProjectSummary {
            id: row.id,
            name: trimmed.to_owned(),
            audit: row.audit,
            directory: db_path,
        })
    }

    async fn update_project_plugin_settings(
        &self,
        project_path: &Path,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        if !settings.is_object() {
            return Err(PersistenceError::Validation(
                "Plugin settings must be a JSON object".into(),
            ));
        }
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut conn)
        .await?;

        let settings_json = serde_json::to_string(&settings)?;
        let updated = sqlx::query(
            "UPDATE ProjectPluginSettings SET settings_json = ?1 \
             WHERE plugin_id = ?2 AND project_settings_id = ?3",
        )
        .bind(&settings_json)
        .bind(plugin_id)
        .bind(&project_row.project_settings_id)
        .execute(&mut conn)
        .await?;

        if updated.rows_affected() == 0 {
            return Err(PersistenceError::Validation(format!(
                "Plugin '{}' is not configured for this project",
                plugin_id
            )));
        }

        sqlx::query_as::<_, PluginRow>(
            "SELECT Plugin.id as plugin_id, Plugin.name as plugin_name, \
             Plugin.version as plugin_version, Plugin.input_schema_json as input_schema_json, \
             Plugin.settings_schema_json as settings_schema_json, \
             Plugin.manifest_json as manifest_json, \
             ProjectPluginSettings.settings_json as settings_json \
             FROM Plugin \
             INNER JOIN ProjectPluginSettings ON ProjectPluginSettings.plugin_id = Plugin.id \
             WHERE ProjectPluginSettings.project_settings_id = ?1 AND Plugin.id = ?2",
        )
        .bind(&project_row.project_settings_id)
        .bind(plugin_id)
        .fetch_one(&mut conn)
        .await?
        .into_payload()
    }

    async fn upsert_project_plugin_from_dir(
        &self,
        project_path: &Path,
        plugin_dir: &Path,
        replace_plugin_id: Option<String>,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        let manifest_id = extract_manifest_id(plugin_dir)?;
        let plugin_id = match replace_plugin_id {
            Some(id) if !id.trim().is_empty() => id.trim().to_string(),
            _ => manifest_id,
        };

        let bundle = load_plugin_bundle_with_id(plugin_dir, plugin_id.clone())?;
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut conn)
                .await?;

        Self::insert_plugin(&mut conn, &bundle).await?;

        let existing_settings: Option<String> = sqlx::query_scalar(
            "SELECT settings_json FROM ProjectPluginSettings \
             WHERE plugin_id = ?1 AND project_settings_id = ?2 LIMIT 1",
        )
        .bind(&plugin_id)
        .bind(&project_settings_id)
        .fetch_optional(&mut conn)
        .await?;

        let default_settings = build_default_settings(&bundle.manifest);
        let mut merged = match existing_settings {
            Some(raw) => serde_json::from_str::<Value>(&raw).unwrap_or(Value::Object(Map::new())),
            None => Value::Object(Map::new()),
        };
        if !merged.is_object() {
            merged = Value::Object(Map::new());
        }
        if let (Value::Object(ref mut m), Value::Object(defaults)) = (&mut merged, default_settings)
        {
            for (key, value) in defaults {
                m.entry(key).or_insert(value);
            }
        }

        let merged_json = serde_json::to_string(&merged)?;
        sqlx::query(
            "INSERT INTO ProjectPluginSettings (plugin_id, project_settings_id, settings_json) \
             VALUES (?1, ?2, ?3) \
             ON CONFLICT(plugin_id, project_settings_id) DO UPDATE SET settings_json = excluded.settings_json",
        )
        .bind(&plugin_id)
        .bind(&project_settings_id)
        .bind(merged_json)
        .execute(&mut conn)
        .await?;

        sqlx::query_as::<_, PluginRow>(
            "SELECT Plugin.id as plugin_id, Plugin.name as plugin_name, \
             Plugin.version as plugin_version, Plugin.input_schema_json as input_schema_json, \
             Plugin.settings_schema_json as settings_schema_json, \
             Plugin.manifest_json as manifest_json, \
             ProjectPluginSettings.settings_json as settings_json \
             FROM Plugin \
             INNER JOIN ProjectPluginSettings ON ProjectPluginSettings.plugin_id = Plugin.id \
             WHERE ProjectPluginSettings.project_settings_id = ?1 AND Plugin.id = ?2",
        )
        .bind(&project_settings_id)
        .bind(&plugin_id)
        .fetch_one(&mut conn)
        .await?
        .into_payload()
    }

    async fn create_scan(
        &self,
        project_path: &Path,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
            .fetch_one(&mut conn)
            .await?;

        let id = Uuid::new_v4().to_string();
        let fallback = format!("New Scan {}", &id[..8]);
        let final_preview = preview
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or(fallback);

        sqlx::query(
            "INSERT INTO Scan (id, project_id, status, preview, inputs_json, selected_plugins_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&id)
        .bind(&project_id)
        .bind("Draft")
        .bind(&final_preview)
        .bind("{}")
        .bind("[]")
        .execute(&mut conn)
        .await?;

        Ok(ScanSummaryRecord {
            id,
            status: "Draft".to_string(),
            preview: Some(final_preview),
        })
    }

    async fn list_scans(
        &self,
        project_path: &Path,
    ) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
            .fetch_one(&mut conn)
            .await?;

        let rows = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE project_id = ?1 ORDER BY rowid DESC",
        )
        .bind(project_id)
        .fetch_all(&mut conn)
        .await?;

        Ok(rows.into_iter().map(|r| r.into_summary()).collect())
    }

    async fn get_scan(
        &self,
        project_path: &Path,
        scan_id: &str,
    ) -> Result<ScanDetailRecord, PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let scan = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut conn)
        .await?;

        let inputs = parse_json_text(scan.inputs_json)?;
        let selected_plugins: Vec<PluginEntrypointSelection> =
            match parse_json_text(scan.selected_plugins_json)? {
                Value::Array(items) => items
                    .into_iter()
                    .filter_map(|v| serde_json::from_value(v).ok())
                    .collect(),
                _ => vec![],
            };

        let result_rows = sqlx::query_as::<_, ScanResultRow>(
            "SELECT plugin_id, entrypoint_id, output_json_ir \
             FROM ScanPluginResult WHERE scan_id = ?1",
        )
        .bind(&scan.id)
        .fetch_all(&mut conn)
        .await?;

        let mut results = Vec::with_capacity(result_rows.len());
        for row in result_rows {
            results.push(ScanPluginResultRecord {
                plugin_id: row.plugin_id,
                entrypoint_id: row.entrypoint_id,
                output: parse_json_text(row.output_json_ir)?,
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

    async fn run_scan(
        &self,
        project_path: &Path,
        scan_id: &str,
        selected_plugins: Vec<PluginEntrypointSelection>,
        inputs: Value,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        if selected_plugins.is_empty() {
            return Err(PersistenceError::Validation(
                "Select at least one plugin entrypoint before run".into(),
            ));
        }

        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let scan = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut conn)
        .await?;

        if scan.status != "Draft" {
            return Err(PersistenceError::Validation(
                "Scan already launched and cannot be rerun".into(),
            ));
        }

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut conn)
                .await?;

        let selected_json = serde_json::to_string(&selected_plugins)?;
        let inputs_json = serde_json::to_string(&inputs)?;

        sqlx::query(
            "UPDATE Scan SET status = 'Running', selected_plugins_json = ?1, inputs_json = ?2 \
             WHERE id = ?3",
        )
        .bind(&selected_json)
        .bind(&inputs_json)
        .bind(scan_id)
        .execute(&mut conn)
        .await?;

        sqlx::query("DELETE FROM ScanPluginResult WHERE scan_id = ?1")
            .bind(scan_id)
            .execute(&mut conn)
            .await?;

        // Load fresh code from disk so runtime source changes take effect without DB re-sync.
        let fresh_code: HashMap<String, String> = discover_local_plugins()
            .unwrap_or_default()
            .into_iter()
            .map(|b| (b.id, b.code))
            .collect();

        let inputs_obj = if inputs.is_object() {
            inputs
        } else {
            Value::Object(Map::new())
        };

        for selection in &selected_plugins {
            let ep_key = format!("{}::{}", selection.plugin_id, selection.entrypoint_id);
            let plugin_inputs = inputs_obj
                .get(&ep_key)
                .cloned()
                .unwrap_or_else(|| Value::Object(Map::new()));

            let runtime_row = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>)>(
                "SELECT ProjectPluginSettings.settings_json, Plugin.code, Plugin.manifest_json \
                 FROM ProjectPluginSettings \
                 INNER JOIN Plugin ON Plugin.id = ProjectPluginSettings.plugin_id \
                 WHERE ProjectPluginSettings.plugin_id = ?1 \
                   AND ProjectPluginSettings.project_settings_id = ?2 \
                 LIMIT 1",
            )
            .bind(&selection.plugin_id)
            .bind(&project_settings_id)
            .fetch_optional(&mut conn)
            .await?;

            let envelope = match runtime_row {
                None => json!({
                    "ok": false,
                    "error": format!("Plugin '{}' is not registered in this project", selection.plugin_id)
                }),
                Some((settings_json, plugin_code, manifest_json_raw)) => {
                    let plugin_settings = settings_json
                        .as_deref()
                        .filter(|s| !s.trim().is_empty())
                        .and_then(|s| serde_json::from_str(s).ok())
                        .unwrap_or_else(|| Value::Object(Map::new()));

                    let manifest_val: Value = manifest_json_raw
                        .as_deref()
                        .and_then(|s| serde_json::from_str(s).ok())
                        .unwrap_or(Value::Null);

                    let entrypoint_fn =
                        resolve_entrypoint_function(&manifest_val, &selection.entrypoint_id);

                    let code = fresh_code
                        .get(&selection.plugin_id)
                        .cloned()
                        .or(plugin_code)
                        .filter(|c| !c.trim().is_empty());

                    match code {
                        None => json!({
                            "ok": false,
                            "error": format!("Plugin '{}' has no code in project database", selection.plugin_id)
                        }),
                        Some(code) => {
                            let result = tauri::async_runtime::spawn_blocking(move || {
                                crate::app::plugin::execute_plugin_code_with_settings(
                                    code,
                                    plugin_inputs,
                                    plugin_settings,
                                    Some(entrypoint_fn),
                                )
                            })
                            .await
                            .map_err(|e| {
                                PersistenceError::Validation(format!(
                                    "Failed to join plugin execution task: {}",
                                    e
                                ))
                            })?;

                            match result {
                                Ok((output, logs)) => {
                                    json!({ "ok": true, "data": output, "logs": logs })
                                }
                                Err(err) => json!({ "ok": false, "error": err }),
                            }
                        }
                    }
                }
            };

            sqlx::query(
                "INSERT INTO ScanPluginResult (id, plugin_id, entrypoint_id, scan_id, output_json_ir) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&selection.plugin_id)
            .bind(&selection.entrypoint_id)
            .bind(scan_id)
            .bind(serde_json::to_string(&envelope)?)
            .execute(&mut conn)
            .await?;
        }

        sqlx::query("UPDATE Scan SET status = 'Completed' WHERE id = ?1")
            .bind(scan_id)
            .execute(&mut conn)
            .await?;

        Ok(ScanSummaryRecord {
            id: scan_id.to_owned(),
            status: "Completed".to_string(),
            preview: scan.preview,
        })
    }

    async fn update_scan_preview(
        &self,
        project_path: &Path,
        scan_id: &str,
        preview: String,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let next = preview.trim().to_string();
        if next.is_empty() {
            return Err(PersistenceError::Validation(
                "Scan name must not be empty".into(),
            ));
        }
        let db_path = Self::existing_db_path(project_path)?;
        let mut conn = Self::open_connection(&db_path).await?;

        let current = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut conn)
        .await?;

        sqlx::query("UPDATE Scan SET preview = ?1 WHERE id = ?2")
            .bind(&next)
            .bind(scan_id)
            .execute(&mut conn)
            .await?;

        Ok(ScanSummaryRecord {
            id: scan_id.to_owned(),
            status: current.status,
            preview: Some(next),
        })
    }

    async fn get_project_lock_status(
        &self,
        project_path: &Path,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;
        Self::read_lock_status(&db_path).await
    }

    async fn unlock_project(
        &self,
        project_path: &Path,
        password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;
        let status = Self::read_lock_status(&db_path).await?;
        if !status.locked {
            return Ok(ProjectLockStatus {
                locked: false,
                unlocked: true,
            });
        }

        let mut conn = Self::connect(&db_path, false, Some(&password))
            .await
            .map_err(|err| {
                if Self::is_encrypted_error(&err) {
                    PersistenceError::Validation("Invalid password".to_string())
                } else {
                    err
                }
            })?;
        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;

        cache_key(&db_path, password);
        Ok(ProjectLockStatus {
            locked: true,
            unlocked: true,
        })
    }

    async fn set_project_password(
        &self,
        project_path: &Path,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        use super::security::validate_password;
        validate_password(&new_password)?;

        let db_path = Self::existing_db_path(project_path)?;
        let status = Self::read_lock_status(&db_path).await?;
        if status.locked && !status.unlocked {
            return Err(PersistenceError::Validation(lock_error()));
        }

        let source_key = if status.locked {
            get_cached_key(&db_path)
        } else {
            None
        };
        if status.locked && source_key.is_none() {
            return Err(PersistenceError::Validation(lock_error()));
        }

        Self::rewrite_database_with_key(&db_path, source_key.as_deref(), Some(&new_password))
            .await?;
        cache_key(&db_path, new_password);
        Ok(ProjectLockStatus {
            locked: true,
            unlocked: true,
        })
    }

    async fn change_project_password(
        &self,
        project_path: &Path,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        use super::security::{validate_non_empty_password, validate_password};
        validate_password(&new_password)?;
        validate_non_empty_password(&current_password, "Current password")?;

        let db_path = Self::existing_db_path(project_path)?;
        Self::rewrite_database_with_key(&db_path, Some(&current_password), Some(&new_password))
            .await?;
        cache_key(&db_path, new_password);
        Ok(ProjectLockStatus {
            locked: true,
            unlocked: true,
        })
    }

    async fn remove_project_password(
        &self,
        project_path: &Path,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        use super::security::validate_non_empty_password;
        validate_non_empty_password(&current_password, "Current password")?;

        let db_path = Self::existing_db_path(project_path)?;
        Self::rewrite_database_with_key(&db_path, Some(&current_password), None).await?;
        clear_cached_key(&db_path);
        Ok(ProjectLockStatus {
            locked: false,
            unlocked: true,
        })
    }
}

// ---------------------------------------------------------------------------
// SQLx row types
// ---------------------------------------------------------------------------

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

#[derive(sqlx::FromRow)]
struct ScanRow {
    id: String,
    status: String,
    preview: Option<String>,
    inputs_json: Option<String>,
    selected_plugins_json: Option<String>,
}

impl ScanRow {
    fn into_summary(self) -> ScanSummaryRecord {
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

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/// Deserialise an `Option<String>` JSON column, returning `Null` when absent or empty.
fn parse_json_text(raw: Option<String>) -> Result<Value, PersistenceError> {
    match raw {
        Some(text) if !text.trim().is_empty() => Ok(serde_json::from_str(&text)?),
        _ => Ok(Value::Null),
    }
}

/// Resolve the TypeScript function name for a given entrypoint ID from a manifest value.
///
/// Falls back to the entrypoint ID itself when the manifest has no `entrypoints` array
/// or the ID is not found.
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
    entrypoint_id.to_string()
}
