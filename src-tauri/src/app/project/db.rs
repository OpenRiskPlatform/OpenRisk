//! SQLite persistence layer for projects.
//!
//! Defines the [`ProjectPersistence`] trait, which models all operations on an *open* project
//! session. Implementations can be swapped for testing (e.g., in-memory SQLite).
//!
//! [`SqliteProjectPersistence`] is the production implementation backed by SQLCipher. It holds a
//! single shared connection for the lifetime of the session — the connection is opened once, not
//! per-operation. Password-change operations temporarily drop and reopen the connection while
//! holding the internal mutex, serialising all concurrent access.
//!
//! # Opening a project
//! Use [`SqliteProjectPersistence::create`] for new projects, [`SqliteProjectPersistence::open`]
//! for existing ones, or [`SqliteProjectPersistence::open_with_password`] for encrypted ones.
//! Use [`SqliteProjectPersistence::check_lock_status`] as a pre-open probe (no instance needed).

use super::plugins::{sidecar_path, LocalPluginBundle};
use super::security::{
    cache_key, clear_cached_key, escape_sql_literal, get_cached_key, lock_error,
    validate_non_empty_password, validate_password,
};
use super::types::{
    PersistenceError, PluginEntrypointSelection, PluginLoadData, PluginSettingsPayload,
    ProjectLockStatus, ProjectSettingsPayload, ProjectSettingsRecord, ProjectSummary,
    ScanDetailRecord, ScanPluginResultRecord, ScanRunContext, ScanSummaryRecord,
};
use async_trait::async_trait;
use serde_json::{json, Map, Value};
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use uuid::Uuid;

const DB_FILE_NAME: &str = "project.db";
const CURRENT_SCHEMA_VERSION: i64 = 6;
/// The minimum schema version that can be migrated to the current version.
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

/// Abstraction over all operations on an *open* project session.
///
/// Creating or opening a project is done via the factory methods on
/// [`SqliteProjectPersistence`], which initialise the connection and return a ready instance.
/// Alternative implementations (e.g. in-memory SQLite for tests) implement this trait directly.
#[async_trait]
pub trait ProjectPersistence: Send + Sync {
    /// Canonical path to the open project database file.
    fn project_path(&self) -> &Path;

    /// Load the full settings snapshot (project + global settings + all plugin configs).
    async fn load_settings(&self) -> Result<ProjectSettingsPayload, PersistenceError>;

    /// Update the project-wide theme setting.
    async fn update_project_settings(
        &self,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError>;

    /// Rename the project.
    async fn update_project_name(&self, name: &str) -> Result<ProjectSummary, PersistenceError>;

    /// Persist updated settings for one plugin within this project.
    async fn update_project_plugin_settings(
        &self,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError>;

    /// Create a new scan in Draft status.
    async fn create_scan(
        &self,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// List all scans for the project, newest first.
    async fn list_scans(&self) -> Result<Vec<ScanSummaryRecord>, PersistenceError>;

    /// Fetch full details of a single scan including all plugin results.
    async fn get_scan(&self, scan_id: &str) -> Result<ScanDetailRecord, PersistenceError>;

    /// Mark a scan as Running, snapshot its inputs and plugin selection, and return
    /// the code + settings needed to execute each selected entrypoint.
    async fn begin_scan_run(
        &self,
        scan_id: &str,
        selected_plugins: &[PluginEntrypointSelection],
        inputs: &Value,
    ) -> Result<ScanRunContext, PersistenceError>;

    /// Persist the results of a completed scan execution and mark it as Completed.
    async fn end_scan_run(
        &self,
        scan_id: &str,
        preview: Option<String>,
        results: Vec<ScanPluginResultRecord>,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// Update the preview (display name) of a scan.
    async fn update_scan_preview(
        &self,
        scan_id: &str,
        preview: String,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// Insert or update a plugin record (code + metadata) in the database.
    async fn save_plugin(&self, bundle: &LocalPluginBundle) -> Result<(), PersistenceError>;

    /// Return the current raw settings JSON for a plugin, or `None` if not yet configured.
    async fn get_plugin_settings_json(
        &self,
        plugin_id: &str,
    ) -> Result<Option<String>, PersistenceError>;

    /// Upsert the settings JSON for a plugin in this project.
    async fn save_plugin_settings_json(
        &self,
        plugin_id: &str,
        settings_json: &str,
    ) -> Result<(), PersistenceError>;

    /// Fetch a plugin with its current settings by `plugin_id`.
    async fn get_plugin_payload(
        &self,
        plugin_id: &str,
    ) -> Result<PluginSettingsPayload, PersistenceError>;

    /// Return the encryption / lock state of the open project database.
    async fn get_project_lock_status(&self) -> Result<ProjectLockStatus, PersistenceError>;

    /// Encrypt an unencrypted project with `new_password`.
    async fn set_project_password(
        &self,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Re-encrypt the database, replacing the current password with `new_password`.
    async fn change_project_password(
        &self,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Remove encryption from the project database.
    async fn remove_project_password(
        &self,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;
}

// ---------------------------------------------------------------------------
// Production implementation
// ---------------------------------------------------------------------------

/// Production SQLite/SQLCipher-backed project store.
///
/// Holds a single shared connection for the lifetime of the project session. All operations
/// serialise through an internal [`Mutex`]. During re-encryption the connection slot is briefly
/// set to `None` while the file is rewritten, then a new connection is placed back.
///
/// # Construction
/// - [`Self::create`] — new project
/// - [`Self::open`] — existing unencrypted project (or cached key present)
/// - [`Self::open_with_password`] — existing encrypted project
/// - [`Self::check_lock_status`] — pre-open probe (no instance needed)
pub struct SqliteProjectPersistence {
    /// Canonical path to the `.orproj` database file.
    pub db_path: PathBuf,
    /// Shared connection slot. `None` only during re-encryption.
    conn: Arc<Mutex<Option<SqliteConnection>>>,
}

impl SqliteProjectPersistence {
    // --- factories -----------------------------------------------------------

    /// Create a new project database at `project_path` and return an open instance.
    ///
    /// If `project_path` is a directory the file is named `<name>.orproj` inside it.
    pub async fn create(
        name: &str,
        project_path: &Path,
    ) -> Result<(ProjectSummary, Self), PersistenceError> {
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

        let summary = ProjectSummary {
            id: project_id,
            name: trimmed_name.to_owned(),
            audit: None,
            directory: db_path.clone(),
        };
        let instance = Self {
            db_path,
            conn: Arc::new(Mutex::new(Some(conn))),
        };
        Ok((summary, instance))
    }

    /// Open an existing project and return an open instance.
    ///
    /// Runs pending migrations and returns a lock error when the database is encrypted
    /// and no cached key is available.
    pub async fn open(project_path: &Path) -> Result<(ProjectSummary, Self), PersistenceError> {
        Self::open_inner(project_path, None).await
    }

    /// Open an existing encrypted project with an explicit password.
    ///
    /// Equivalent to [`Self::open`] but authenticates with `password` and caches it.
    pub async fn open_with_password(
        project_path: &Path,
        password: String,
    ) -> Result<(ProjectSummary, Self), PersistenceError> {
        Self::open_inner(project_path, Some(password)).await
    }

    /// Probe the lock status of a project file *without* opening it.
    ///
    /// Useful for deciding whether to prompt for a password before calling [`Self::open`].
    pub async fn check_lock_status(
        project_path: &Path,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;
        Self::read_lock_status(&db_path).await
    }

    /// Shared open logic for unencrypted and password-protected projects.
    async fn open_inner(
        project_path: &Path,
        password: Option<String>,
    ) -> Result<(ProjectSummary, Self), PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;

        let mut conn = match &password {
            Some(pw) => Self::connect(&db_path, false, Some(pw.as_str()))
                .await
                .map_err(|err| {
                    if Self::is_encrypted_error(&err) {
                        PersistenceError::Validation("Invalid password".into())
                    } else {
                        err
                    }
                })?,
            None => match Self::connect(&db_path, false, None).await {
                Ok(c) => c,
                Err(err) if Self::is_encrypted_error(&err) => {
                    if let Some(cached_pw) = get_cached_key(&db_path) {
                        match Self::connect(&db_path, false, Some(cached_pw.as_str())).await {
                            Ok(c) => c,
                            Err(_) => {
                                clear_cached_key(&db_path);
                                return Err(PersistenceError::Validation(lock_error()));
                            }
                        }
                    } else {
                        return Err(PersistenceError::Validation(lock_error()));
                    }
                }
                Err(err) => return Err(err),
            },
        };

        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;

        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut conn)
        .await?;

        if let Some(pw) = &password {
            cache_key(&db_path, pw.clone());
        }

        let summary = ProjectSummary {
            id: project_row.id,
            name: project_row.name,
            audit: project_row.audit,
            directory: db_path.clone(),
        };
        let instance = Self {
            db_path,
            conn: Arc::new(Mutex::new(Some(conn))),
        };
        Ok((summary, instance))
    }

    // --- low-level connection helpers ----------------------------------------

    /// Open a raw SQLite connection, optionally applying a SQLCipher key.
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

        // Force SQLCipher key validation by reading the schema.
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

    // --- schema & migrations -------------------------------------------------

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

        let current_version =
            sqlx::query_scalar::<_, i64>("SELECT version FROM SchemaVersion WHERE id = 1")
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
                6 => Self::migrate_to_v6(conn).await?,
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

    /// Migration v4 → v5: add `entrypoint_id` column and convert `selected_plugins_json`.
    async fn migrate_to_v5(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        Self::ensure_scan_result_entrypoint_column(conn).await?;
        Self::migrate_selected_plugins_json(conn).await?;
        Ok(())
    }

    /// Migration v5 → v6: add `entrypoint_id` column (same as v5 for DBs that never got it)
    /// and ensure `selected_plugins_json` uses the `{pluginId, entrypointId}` object format.
    async fn migrate_to_v6(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        Self::ensure_scan_result_entrypoint_column(conn).await?;
        Self::migrate_selected_plugins_json(conn).await?;
        Ok(())
    }

    /// Idempotently ensure `ScanPluginResult.entrypoint_id` exists.
    async fn ensure_scan_result_entrypoint_column(
        conn: &mut SqliteConnection,
    ) -> Result<(), PersistenceError> {
        let has_col = Self::column_exists(conn, "ScanPluginResult", "entrypoint_id").await?;
        if !has_col {
            sqlx::query(
                "ALTER TABLE ScanPluginResult ADD COLUMN entrypoint_id TEXT NOT NULL DEFAULT 'default'",
            )
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    }

    /// Convert legacy string-array `Scan.selected_plugins_json` into object entries.
    async fn migrate_selected_plugins_json(
        conn: &mut SqliteConnection,
    ) -> Result<(), PersistenceError> {
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
            // Skip rows already in the {pluginId, entrypointId} object format.
            if items
                .iter()
                .any(|item| item.is_object() && item.get("pluginId").is_some())
            {
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

    /// Insert or replace a plugin record (code + metadata) in the database.
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
            "INSERT INTO Plugin \
             (id, version, name, input_schema_json, settings_schema_json, code, manifest_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
             ON CONFLICT(id) DO UPDATE SET \
                 version = excluded.version, \
                 name = excluded.name, \
                 input_schema_json = excluded.input_schema_json, \
                 settings_schema_json = excluded.settings_schema_json, \
                 code = excluded.code, \
                 manifest_json = excluded.manifest_json",
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

    // --- path helpers --------------------------------------------------------

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

    // --- encryption helpers --------------------------------------------------

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

    /// Drop the connection, rewrite the database file, then reconnect.
    ///
    /// Holds the connection mutex for the entire operation so that no other command
    /// can observe the `None` slot or access the file during re-encryption.
    async fn rewrite_and_reconnect(
        &self,
        source_key: Option<String>,
        target_key: Option<String>,
    ) -> Result<(), PersistenceError> {
        let mut guard = self.conn.lock().await;

        // Close the current connection before touching the file.
        guard.take();

        let result = Self::rewrite_database_with_key(
            &self.db_path,
            source_key.as_deref(),
            target_key.as_deref(),
        )
        .await;

        // Reconnect with the new key on success, the old key on failure.
        let reconnect_key = if result.is_ok() {
            target_key.as_deref()
        } else {
            source_key.as_deref()
        };
        if let Ok(new_conn) = Self::connect(&self.db_path, false, reconnect_key).await {
            *guard = Some(new_conn);
        }
        // If reconnect also fails, guard stays None — subsequent calls return conn_unavailable.

        result
    }
}

// ---------------------------------------------------------------------------
// Trait implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl ProjectPersistence for SqliteProjectPersistence {
    fn project_path(&self) -> &Path {
        &self.db_path
    }

    async fn load_settings(&self) -> Result<ProjectSettingsPayload, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut *conn)
        .await?;

        let settings_row = sqlx::query_as::<_, ProjectSettingsRow>(
            "SELECT id, description, locale, theme FROM ProjectSettings WHERE id = ?1",
        )
        .bind(&project_row.project_settings_id)
        .fetch_one(&mut *conn)
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
        .fetch_all(&mut *conn)
        .await?;

        let mut plugins = Vec::with_capacity(plugin_rows.len());
        for row in plugin_rows {
            plugins.push(row.into_payload()?);
        }

        Ok(ProjectSettingsPayload {
            project: ProjectSummary {
                id: project_row.id,
                name: project_row.name,
                audit: project_row.audit,
                directory: self.db_path.clone(),
            },
            project_settings: settings_row.into_record(),
            plugins,
        })
    }

    async fn update_project_settings(
        &self,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut *conn)
        .await?;

        let normalized = SqliteProjectPersistence::normalize_theme(theme);
        sqlx::query("UPDATE ProjectSettings SET theme = ?1 WHERE id = ?2")
            .bind(normalized)
            .bind(&project_row.project_settings_id)
            .execute(&mut *conn)
            .await?;

        sqlx::query_as::<_, ProjectSettingsRow>(
            "SELECT id, description, locale, theme FROM ProjectSettings WHERE id = ?1",
        )
        .bind(&project_row.project_settings_id)
        .fetch_one(&mut *conn)
        .await
        .map(|r| r.into_record())
        .map_err(Into::into)
    }

    async fn update_project_name(&self, name: &str) -> Result<ProjectSummary, PersistenceError> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(PersistenceError::Validation(
                "Project name must not be empty".into(),
            ));
        }

        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut *conn)
        .await?;

        sqlx::query("UPDATE Project SET name = ?1 WHERE id = ?2")
            .bind(trimmed)
            .bind(&row.id)
            .execute(&mut *conn)
            .await?;

        Ok(ProjectSummary {
            id: row.id,
            name: trimmed.to_owned(),
            audit: row.audit,
            directory: self.db_path.clone(),
        })
    }

    async fn update_project_plugin_settings(
        &self,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        if !settings.is_object() {
            return Err(PersistenceError::Validation(
                "Plugin settings must be a JSON object".into(),
            ));
        }

        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, audit, project_settings_id FROM Project LIMIT 1",
        )
        .fetch_one(&mut *conn)
        .await?;

        let settings_json = serde_json::to_string(&settings)?;
        let updated = sqlx::query(
            "UPDATE ProjectPluginSettings SET settings_json = ?1 \
             WHERE plugin_id = ?2 AND project_settings_id = ?3",
        )
        .bind(&settings_json)
        .bind(plugin_id)
        .bind(&project_row.project_settings_id)
        .execute(&mut *conn)
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
        .fetch_one(&mut *conn)
        .await?
        .into_payload()
    }

    async fn create_scan(
        &self,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
            .fetch_one(&mut *conn)
            .await?;

        let id = Uuid::new_v4().to_string();
        let fallback = format!("New Scan {}", &id[..8]);
        let final_preview = preview
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or(fallback);

        sqlx::query(
            "INSERT INTO Scan \
             (id, project_id, status, preview, inputs_json, selected_plugins_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&id)
        .bind(&project_id)
        .bind("Draft")
        .bind(&final_preview)
        .bind("{}")
        .bind("[]")
        .execute(&mut *conn)
        .await?;

        Ok(ScanSummaryRecord {
            id,
            status: "Draft".to_string(),
            preview: Some(final_preview),
        })
    }

    async fn list_scans(&self) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
            .fetch_one(&mut *conn)
            .await?;

        let rows = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE project_id = ?1 ORDER BY rowid DESC",
        )
        .bind(project_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| r.into_summary()).collect())
    }

    async fn get_scan(&self, scan_id: &str) -> Result<ScanDetailRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let scan = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut *conn)
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

        let has_entrypoint = Self::column_exists(conn, "ScanPluginResult", "entrypoint_id").await?;
        let results = if has_entrypoint {
            let result_rows = sqlx::query_as::<_, ScanResultRow>(
                "SELECT plugin_id, entrypoint_id, output_json_ir \
                 FROM ScanPluginResult WHERE scan_id = ?1",
            )
            .bind(&scan.id)
            .fetch_all(&mut *conn)
            .await?;

            let mut results = Vec::with_capacity(result_rows.len());
            for row in result_rows {
                results.push(ScanPluginResultRecord {
                    plugin_id: row.plugin_id,
                    entrypoint_id: row.entrypoint_id,
                    output: normalize_scan_output(parse_json_text(row.output_json_ir)?),
                });
            }
            results
        } else {
            // Legacy rows had no entrypoint_id; map all of them to `default`.
            let legacy_rows = sqlx::query_as::<_, LegacyScanResultRow>(
                "SELECT plugin_id, output_json_ir FROM ScanPluginResult WHERE scan_id = ?1",
            )
            .bind(&scan.id)
            .fetch_all(&mut *conn)
            .await?;

            let mut results = Vec::with_capacity(legacy_rows.len());
            for row in legacy_rows {
                results.push(ScanPluginResultRecord {
                    plugin_id: row.plugin_id,
                    entrypoint_id: "default".to_string(),
                    output: normalize_scan_output(parse_json_text(row.output_json_ir)?),
                });
            }
            results
        };

        Ok(ScanDetailRecord {
            id: scan.id,
            status: scan.status,
            preview: scan.preview,
            selected_plugins,
            inputs,
            results,
        })
    }

    async fn begin_scan_run(
        &self,
        scan_id: &str,
        selected_plugins: &[PluginEntrypointSelection],
        inputs: &Value,
    ) -> Result<ScanRunContext, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let scan = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut *conn)
        .await?;

        if scan.status != "Draft" {
            return Err(PersistenceError::Validation(
                "Scan already launched and cannot be rerun".into(),
            ));
        }

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        sqlx::query(
            "UPDATE Scan SET status = 'Running', \
             selected_plugins_json = ?1, inputs_json = ?2 WHERE id = ?3",
        )
        .bind(serde_json::to_string(selected_plugins)?)
        .bind(serde_json::to_string(inputs)?)
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;

        sqlx::query("DELETE FROM ScanPluginResult WHERE scan_id = ?1")
            .bind(scan_id)
            .execute(&mut *conn)
            .await?;

        let mut plugins = Vec::with_capacity(selected_plugins.len());
        for sel in selected_plugins {
            let row = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>)>(
                "SELECT pps.settings_json, p.code, p.manifest_json \
                 FROM ProjectPluginSettings pps \
                 INNER JOIN Plugin p ON p.id = pps.plugin_id \
                 WHERE pps.plugin_id = ?1 AND pps.project_settings_id = ?2 LIMIT 1",
            )
            .bind(&sel.plugin_id)
            .bind(&project_settings_id)
            .fetch_optional(&mut *conn)
            .await?;

            let (settings_json, code, manifest_json) = row.unwrap_or((None, None, None));
            plugins.push(PluginLoadData {
                plugin_id: sel.plugin_id.clone(),
                entrypoint_id: sel.entrypoint_id.clone(),
                settings_json,
                code,
                manifest_json,
            });
        }

        Ok(ScanRunContext {
            scan_preview: scan.preview,
            plugins,
        })
    }

    async fn end_scan_run(
        &self,
        scan_id: &str,
        preview: Option<String>,
        results: Vec<ScanPluginResultRecord>,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        for result in &results {
            sqlx::query(
                "INSERT INTO ScanPluginResult \
                 (id, plugin_id, entrypoint_id, scan_id, output_json_ir) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&result.plugin_id)
            .bind(&result.entrypoint_id)
            .bind(scan_id)
            .bind(serde_json::to_string(&result.output)?)
            .execute(&mut *conn)
            .await?;
        }

        sqlx::query("UPDATE Scan SET status = 'Completed' WHERE id = ?1")
            .bind(scan_id)
            .execute(&mut *conn)
            .await?;

        Ok(ScanSummaryRecord {
            id: scan_id.to_owned(),
            status: "Completed".to_string(),
            preview,
        })
    }

    async fn save_plugin(&self, bundle: &LocalPluginBundle) -> Result<(), PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;
        Self::insert_plugin(conn, bundle).await
    }

    async fn get_plugin_settings_json(
        &self,
        plugin_id: &str,
    ) -> Result<Option<String>, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        sqlx::query_scalar(
            "SELECT settings_json FROM ProjectPluginSettings \
             WHERE plugin_id = ?1 AND project_settings_id = ?2 LIMIT 1",
        )
        .bind(plugin_id)
        .bind(&project_settings_id)
        .fetch_optional(&mut *conn)
        .await
        .map_err(Into::into)
    }

    async fn save_plugin_settings_json(
        &self,
        plugin_id: &str,
        settings_json: &str,
    ) -> Result<(), PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        sqlx::query(
            "INSERT INTO ProjectPluginSettings (plugin_id, project_settings_id, settings_json) \
             VALUES (?1, ?2, ?3) \
             ON CONFLICT(plugin_id, project_settings_id) DO UPDATE SET \
                 settings_json = excluded.settings_json",
        )
        .bind(plugin_id)
        .bind(&project_settings_id)
        .bind(settings_json)
        .execute(&mut *conn)
        .await?;

        Ok(())
    }

    async fn get_plugin_payload(
        &self,
        plugin_id: &str,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
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
        .bind(plugin_id)
        .fetch_one(&mut *conn)
        .await?
        .into_payload()
    }

    async fn update_scan_preview(
        &self,
        scan_id: &str,
        preview: String,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let next = preview.trim().to_string();
        if next.is_empty() {
            return Err(PersistenceError::Validation(
                "Scan name must not be empty".into(),
            ));
        }

        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let current = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut *conn)
        .await?;

        sqlx::query("UPDATE Scan SET preview = ?1 WHERE id = ?2")
            .bind(&next)
            .bind(scan_id)
            .execute(&mut *conn)
            .await?;

        Ok(ScanSummaryRecord {
            id: scan_id.to_owned(),
            status: current.status,
            preview: Some(next),
        })
    }

    async fn get_project_lock_status(&self) -> Result<ProjectLockStatus, PersistenceError> {
        SqliteProjectPersistence::read_lock_status(&self.db_path).await
    }

    async fn set_project_password(
        &self,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        validate_password(&new_password)?;
        let status = SqliteProjectPersistence::read_lock_status(&self.db_path).await?;
        if status.locked {
            return Err(PersistenceError::Validation(
                "Project already has a password. Use change_project_password instead.".into(),
            ));
        }
        self.rewrite_and_reconnect(None, Some(new_password.clone()))
            .await?;
        cache_key(&self.db_path, new_password);
        Ok(ProjectLockStatus {
            locked: true,
            unlocked: true,
        })
    }

    async fn change_project_password(
        &self,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        validate_password(&new_password)?;
        validate_non_empty_password(&current_password, "Current password")?;
        self.rewrite_and_reconnect(Some(current_password), Some(new_password.clone()))
            .await?;
        cache_key(&self.db_path, new_password);
        Ok(ProjectLockStatus {
            locked: true,
            unlocked: true,
        })
    }

    async fn remove_project_password(
        &self,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        validate_non_empty_password(&current_password, "Current password")?;
        self.rewrite_and_reconnect(Some(current_password), None)
            .await?;
        clear_cached_key(&self.db_path);
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

#[derive(sqlx::FromRow)]
struct LegacyScanResultRow {
    plugin_id: String,
    output_json_ir: Option<String>,
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/// Return a connection-unavailable error (used when the slot is `None` during re-encryption).
fn conn_unavailable() -> PersistenceError {
    PersistenceError::Validation(
        "Project connection is temporarily unavailable during an encryption operation. \
         Please reopen the project."
            .into(),
    )
}

/// Deserialise an `Option<String>` JSON column, returning `Null` when absent or empty.
fn parse_json_text(raw: Option<String>) -> Result<Value, PersistenceError> {
    match raw {
        Some(text) if !text.trim().is_empty() => Ok(serde_json::from_str(&text)?),
        _ => Ok(Value::Null),
    }
}

/// Normalize legacy scan outputs into the new envelope shape used by the frontend.
pub(super) fn normalize_scan_output(value: Value) -> Value {
    match value {
        Value::Object(map) if map.contains_key("ok") => Value::Object(map),
        Value::Null => json!({ "ok": false, "error": "No result payload" }),
        other => json!({ "ok": true, "data": other, "logs": [] }),
    }
}
