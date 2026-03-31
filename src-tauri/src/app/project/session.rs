//! Session lifecycle for SQLite/SQLCipher project databases.
//!
//! [`SqliteProjectPersistence`] is the production store that wraps a single SQLite connection
//! for the lifetime of an open project. This module handles only lifecycle concerns:
//! - Factory methods: [`SqliteProjectPersistence::create`], [`open`], [`open_with_password`],
//!   [`check_lock_status`]
//! - Low-level connection management and SQLCipher key handling
//! - Schema DDL and incremental migrations
//! - Path resolution helpers
//! - Re-encryption via `sqlcipher_export`
//!
//! Business-logic operations on an open session are implemented as
//! `impl ProjectPersistence for SqliteProjectPersistence` in the sibling `dao` module.

use super::plugins::{sidecar_path, LocalPluginBundle};
use super::security::{
    cache_key, clear_cached_key, escape_sql_literal, get_cached_key, lock_error,
};
use super::types::{PersistenceError, ProjectLockStatus, ProjectSummary};
use serde_json::{json, Value};
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Schema & version constants
// ---------------------------------------------------------------------------

pub(super) const CURRENT_SCHEMA_VERSION: i64 = 6;
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
// Struct
// ---------------------------------------------------------------------------

/// Production SQLite/SQLCipher-backed project store.
///
/// Holds a single shared connection for the lifetime of the project session. All operations
/// serialise through the internal [`Mutex`]. During re-encryption the connection slot is briefly
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
    /// Shared connection slot. `pub(super)` so the DAO impl can acquire the lock.
    /// `None` only during re-encryption.
    pub(super) conn: Arc<Mutex<Option<SqliteConnection>>>,
}

// ---------------------------------------------------------------------------
// Factory methods
// ---------------------------------------------------------------------------

impl SqliteProjectPersistence {
    /// Create a new project database at `project_path` and return an open instance.
    ///
    /// If `project_path` is a directory the file is named `<name>.orproj` inside it.
    /// Schema is applied and the row is inserted at the current schema version;
    /// plugin sync is handled by the caller (service layer) after construction.
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

        let db_path = Self::resolve_create_path(project_path, trimmed_name);
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
    /// Runs pending migrations. Returns a lock error when the database is encrypted
    /// and no cached key is available.
    pub async fn open(project_path: &Path) -> Result<(ProjectSummary, Self), PersistenceError> {
        Self::open_inner(project_path, None).await
    }

    /// Open an existing encrypted project with an explicit password.
    pub async fn open_with_password(
        project_path: &Path,
        password: String,
    ) -> Result<(ProjectSummary, Self), PersistenceError> {
        Self::open_inner(project_path, Some(password)).await
    }

    /// Probe the lock status of a project file *without* opening it.
    pub async fn check_lock_status(
        project_path: &Path,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        let db_path = Self::existing_db_path(project_path)?;
        Self::read_lock_status(&db_path).await
    }

    // ---------------------------------------------------------------------------
    // Internal open logic
    // ---------------------------------------------------------------------------

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

        let project_row =
            sqlx::query_as::<_, ProjectRow>("SELECT id, name, audit FROM Project LIMIT 1")
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

    // ---------------------------------------------------------------------------
    // Connection helpers
    // ---------------------------------------------------------------------------

    /// Open a raw SQLite connection, optionally applying a SQLCipher key.
    async fn connect(
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

    fn is_encrypted_error(err: &PersistenceError) -> bool {
        match err {
            PersistenceError::Database(db_err) => {
                let msg = db_err.to_string().to_ascii_lowercase();
                msg.contains("file is encrypted") || msg.contains("not a database")
            }
            _ => false,
        }
    }

    /// Validate that `project_path` points to an existing project file.
    ///
    /// Returns an error for directories — projects must be opened by their file path.
    fn existing_db_path(project_path: &Path) -> Result<PathBuf, PersistenceError> {
        if project_path.is_dir() {
            return Err(PersistenceError::Validation(format!(
                "Expected a project file path, got a directory: {:?}. \
                 Select the .orproj file directly.",
                project_path
            )));
        }
        if !project_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "Project file not found: {:?}",
                project_path
            )));
        }
        Ok(project_path.to_path_buf())
    }

    /// Read the encryption / unlock state without needing the key.
    pub(super) async fn read_lock_status(
        db_path: &Path,
    ) -> Result<ProjectLockStatus, PersistenceError> {
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

    // ---------------------------------------------------------------------------
    // Schema & migrations
    // ---------------------------------------------------------------------------

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

    async fn migrate_to_v5(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        Self::ensure_scan_result_entrypoint_column(conn).await?;
        Self::migrate_selected_plugins_json(conn).await
    }

    async fn migrate_to_v6(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        Self::ensure_scan_result_entrypoint_column(conn).await?;
        Self::migrate_selected_plugins_json(conn).await
    }

    async fn ensure_scan_result_entrypoint_column(
        conn: &mut SqliteConnection,
    ) -> Result<(), PersistenceError> {
        if !Self::column_exists(conn, "ScanPluginResult", "entrypoint_id").await? {
            sqlx::query(
                "ALTER TABLE ScanPluginResult ADD COLUMN entrypoint_id TEXT NOT NULL DEFAULT 'default'",
            )
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    }

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

    pub(super) async fn column_exists(
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

    // ---------------------------------------------------------------------------
    // Plugin record upsert (shared with DAO save_plugin)
    // ---------------------------------------------------------------------------

    /// Insert or update a plugin record (code + metadata) in the database.
    ///
    /// `pub(super)` so the DAO `save_plugin` implementation can call this without
    /// duplicating the upsert SQL.
    pub(super) async fn insert_plugin(
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

    // ---------------------------------------------------------------------------
    // Path helpers
    // ---------------------------------------------------------------------------

    /// Resolve the on-disk path for a new project file.
    ///
    /// `project_path` must be the desired file path (e.g. `/home/user/my-project.orproj`).
    /// If no extension is present the `.orproj` extension is appended automatically, which
    /// can happen in automated / test scenarios where a bare path is passed.
    fn resolve_create_path(project_path: &Path, _name: &str) -> PathBuf {
        if project_path.extension().is_some() {
            project_path.to_path_buf()
        } else {
            // No extension — append .orproj. In normal usage this path is supplied by the
            // OS save-file dialog and will always carry the correct extension.
            project_path.with_extension("orproj")
        }
    }

    /// Return `project_path` as-is. Projects are always individual files; directory-based
    /// paths are not supported.
    pub fn db_path(project_path: &Path) -> PathBuf {
        project_path.to_path_buf()
    }

    // ---------------------------------------------------------------------------
    // Encryption helpers
    // ---------------------------------------------------------------------------

    pub(super) fn cleanup_sidecars(db_path: &Path) {
        let _ = fs::remove_file(sidecar_path(db_path, "-wal"));
        let _ = fs::remove_file(sidecar_path(db_path, "-shm"));
    }

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
    /// `pub(super)` so password-change DAO methods can call it.
    pub(super) async fn rewrite_and_reconnect(
        &self,
        source_key: Option<String>,
        target_key: Option<String>,
    ) -> Result<(), PersistenceError> {
        let mut guard = self.conn.lock().await;
        guard.take();

        let result = Self::rewrite_database_with_key(
            &self.db_path,
            source_key.as_deref(),
            target_key.as_deref(),
        )
        .await;

        let reconnect_key = if result.is_ok() {
            target_key.as_deref()
        } else {
            source_key.as_deref()
        };
        if let Ok(new_conn) = Self::connect(&self.db_path, false, reconnect_key).await {
            *guard = Some(new_conn);
        }

        result
    }
}

// ---------------------------------------------------------------------------
// Private row type used only during open_inner
// ---------------------------------------------------------------------------

#[derive(sqlx::FromRow)]
struct ProjectRow {
    id: String,
    name: String,
    audit: Option<String>,
}
