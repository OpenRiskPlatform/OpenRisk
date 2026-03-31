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

pub(super) const CURRENT_SCHEMA_VERSION: i64 = 12;
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
    description TEXT,
    license TEXT,
    authors_json TEXT,
    icon TEXT,
    homepage TEXT,
    code TEXT,
    current_revision_id TEXT
);

CREATE TABLE IF NOT EXISTS PluginRevision (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    license TEXT,
    authors_json TEXT,
    icon TEXT,
    homepage TEXT,
    code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginEntrypoint (
    plugin_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    function_name TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (plugin_id, id),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginInputDef (
    plugin_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    optional INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    default_value_json TEXT,
    PRIMARY KEY (plugin_id, entrypoint_id, name),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginSettingDef (
    plugin_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    description TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    default_value_json TEXT,
    PRIMARY KEY (plugin_id, name),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ProjectPluginSettings (
    plugin_id TEXT NOT NULL,
    project_settings_id TEXT NOT NULL,
    PRIMARY KEY (plugin_id, project_settings_id),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (project_settings_id) REFERENCES ProjectSettings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ProjectPluginSettingValue (
    plugin_id TEXT NOT NULL,
    project_settings_id TEXT NOT NULL,
    setting_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (plugin_id, project_settings_id, setting_name),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (project_settings_id) REFERENCES ProjectSettings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Scan (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Draft','Running','Completed','Failed')),
    preview TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScanSelectedPlugin (
    scan_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT,
    entrypoint_id TEXT NOT NULL,
    PRIMARY KEY (scan_id, plugin_id, entrypoint_id),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScanEntrypointInput (
    scan_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT,
    entrypoint_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (scan_id, plugin_id, entrypoint_id, field_name),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScanPluginResult (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    scan_id TEXT NOT NULL,
    ok INTEGER NOT NULL DEFAULT 0,
    data_json TEXT,
    error TEXT,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScanPluginLog (
    id TEXT PRIMARY KEY,
    scan_result_id TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('log', 'warn', 'error')),
    message TEXT NOT NULL,
    FOREIGN KEY (scan_result_id) REFERENCES ScanPluginResult(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginRevisionEntrypoint (
    revision_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    function_name TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (revision_id, id),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginRevisionInputDef (
    revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    optional INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    default_value_json TEXT,
    PRIMARY KEY (revision_id, entrypoint_id, name),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginRevisionSettingDef (
    revision_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    description TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    default_value_json TEXT,
    PRIMARY KEY (revision_id, name),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
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
                7 => Self::migrate_to_v7(conn).await?,
                8 => Self::migrate_to_v8(conn).await?,
                9 => Self::migrate_to_v9(conn).await?,
                10 => Self::migrate_to_v10(conn).await?,
                11 => Self::migrate_to_v11(conn).await?,
                12 => Self::migrate_to_v12(conn).await?,
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

    /// Add data_json column that was omitted from v7 ScanPluginResult.
    async fn migrate_to_v8(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        // Ignore error: column may already exist from the fresh-schema path.
        let _ = sqlx::query("ALTER TABLE ScanPluginResult ADD COLUMN data_json TEXT")
            .execute(&mut *conn)
            .await;
        Ok(())
    }

    /// Normalize plugin definition tables to support structured field types and per-entrypoint inputs.
    async fn migrate_to_v9(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        if Self::table_exists(conn, "PluginInputDef").await? {
            sqlx::query("ALTER TABLE PluginInputDef RENAME TO PluginInputDef_old")
                .execute(&mut *conn)
                .await?;

            sqlx::query(
                "CREATE TABLE PluginInputDef (\
                 plugin_id TEXT NOT NULL,\
                 entrypoint_id TEXT NOT NULL DEFAULT 'default',\
                 name TEXT NOT NULL,\
                 title TEXT NOT NULL,\
                 type_ TEXT NOT NULL,\
                 type_json TEXT NOT NULL,\
                 enum_values_json TEXT,\
                 optional INTEGER NOT NULL DEFAULT 0,\
                 description TEXT,\
                 default_value_json TEXT,\
                 PRIMARY KEY (plugin_id, entrypoint_id, name),\
                 FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE\
                 )",
            )
            .execute(&mut *conn)
            .await?;

            let has_default =
                Self::column_exists(conn, "PluginInputDef_old", "default_value_json").await?;
            let default_json_expr = if has_default {
                "default_value_json"
            } else {
                "NULL"
            };

            sqlx::query(&format!(
                "INSERT INTO PluginInputDef \
                 (plugin_id, entrypoint_id, name, title, type_, type_json, enum_values_json, optional, description, default_value_json) \
                 SELECT plugin_id, 'default', name, title, type_, \
                        json_object('name', COALESCE(NULLIF(type_, ''), 'string')), \
                        NULL, optional, description, {} \
                 FROM PluginInputDef_old",
                default_json_expr
            ))
            .execute(&mut *conn)
            .await?;

            sqlx::query("DROP TABLE PluginInputDef_old")
                .execute(&mut *conn)
                .await?;
        }

        if Self::table_exists(conn, "PluginSettingDef").await? {
            sqlx::query("ALTER TABLE PluginSettingDef RENAME TO PluginSettingDef_old")
                .execute(&mut *conn)
                .await?;

            sqlx::query(
                "CREATE TABLE PluginSettingDef (\
                 plugin_id TEXT NOT NULL,\
                 name TEXT NOT NULL,\
                 title TEXT NOT NULL,\
                 type_ TEXT NOT NULL,\
                 type_json TEXT NOT NULL,\
                 enum_values_json TEXT,\
                 description TEXT,\
                 required INTEGER NOT NULL DEFAULT 0,\
                 default_value_json TEXT,\
                 PRIMARY KEY (plugin_id, name),\
                 FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE\
                 )",
            )
            .execute(&mut *conn)
            .await?;

            sqlx::query(
                "INSERT INTO PluginSettingDef \
                 (plugin_id, name, title, type_, type_json, enum_values_json, description, required, default_value_json) \
                 SELECT plugin_id, name, title, type_, \
                        json_object('name', COALESCE(NULLIF(type_, ''), 'string')), \
                        NULL, description, required, default_value_json \
                 FROM PluginSettingDef_old",
            )
            .execute(&mut *conn)
            .await?;

            sqlx::query("DROP TABLE PluginSettingDef_old")
                .execute(&mut *conn)
                .await?;
        }

        Ok(())
    }

    /// Add scan archive/order metadata while preserving all historical rows.
    async fn migrate_to_v10(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        if !Self::column_exists(conn, "Scan", "is_archived").await? {
            sqlx::query("ALTER TABLE Scan ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0")
                .execute(&mut *conn)
                .await?;
        }

        if !Self::column_exists(conn, "Scan", "sort_order").await? {
            sqlx::query("ALTER TABLE Scan ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
                .execute(&mut *conn)
                .await?;

            let rows: Vec<String> = sqlx::query_scalar("SELECT id FROM Scan ORDER BY rowid DESC")
                .fetch_all(&mut *conn)
                .await?;

            for (index, scan_id) in rows.iter().enumerate() {
                sqlx::query("UPDATE Scan SET sort_order = ?1 WHERE id = ?2")
                    .bind(index as i64)
                    .bind(scan_id)
                    .execute(&mut *conn)
                    .await?;
            }
        }

        Ok(())
    }

    /// Introduce immutable plugin revisions and bind scan rows to exact plugin revisions.
    async fn migrate_to_v11(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        if !Self::table_exists(conn, "PluginRevision").await? {
            sqlx::query(
                "CREATE TABLE PluginRevision (\
                 id TEXT PRIMARY KEY,\
                 plugin_id TEXT NOT NULL,\
                 version TEXT NOT NULL,\
                 name TEXT NOT NULL,\
                 description TEXT,\
                 license TEXT,\
                 authors_json TEXT,\
                 icon TEXT,\
                 homepage TEXT,\
                 code TEXT,\
                 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\
                 FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE\
                 )",
            )
            .execute(&mut *conn)
            .await?;
        }

        if !Self::column_exists(conn, "Plugin", "current_revision_id").await? {
            sqlx::query("ALTER TABLE Plugin ADD COLUMN current_revision_id TEXT")
                .execute(&mut *conn)
                .await?;
        }

        if !Self::column_exists(conn, "ScanSelectedPlugin", "plugin_revision_id").await? {
            sqlx::query("ALTER TABLE ScanSelectedPlugin ADD COLUMN plugin_revision_id TEXT")
                .execute(&mut *conn)
                .await?;
        }

        if !Self::column_exists(conn, "ScanEntrypointInput", "plugin_revision_id").await? {
            sqlx::query("ALTER TABLE ScanEntrypointInput ADD COLUMN plugin_revision_id TEXT")
                .execute(&mut *conn)
                .await?;
        }

        if !Self::column_exists(conn, "ScanPluginResult", "plugin_revision_id").await? {
            sqlx::query("ALTER TABLE ScanPluginResult ADD COLUMN plugin_revision_id TEXT")
                .execute(&mut *conn)
                .await?;
        }

        #[derive(sqlx::FromRow)]
        struct PluginRow {
            id: String,
            version: String,
            name: String,
            description: Option<String>,
            license: Option<String>,
            authors_json: Option<String>,
            icon: Option<String>,
            homepage: Option<String>,
            code: Option<String>,
            current_revision_id: Option<String>,
        }

        let plugins: Vec<PluginRow> = sqlx::query_as(
            "SELECT id, version, name, description, license, authors_json, icon, homepage, code, current_revision_id FROM Plugin",
        )
        .fetch_all(&mut *conn)
        .await?;

        for plugin in plugins {
            let existing = if let Some(ref rid) = plugin.current_revision_id {
                sqlx::query_scalar::<_, String>(
                    "SELECT id FROM PluginRevision WHERE id = ?1 LIMIT 1",
                )
                .bind(rid)
                .fetch_optional(&mut *conn)
                .await?
            } else {
                None
            };

            let revision_id = if let Some(rid) = existing {
                rid
            } else {
                let rid = Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO PluginRevision \
                     (id, plugin_id, version, name, description, license, authors_json, icon, homepage, code) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                )
                .bind(&rid)
                .bind(&plugin.id)
                .bind(&plugin.version)
                .bind(&plugin.name)
                .bind(plugin.description.as_deref())
                .bind(plugin.license.as_deref())
                .bind(plugin.authors_json.as_deref())
                .bind(plugin.icon.as_deref())
                .bind(plugin.homepage.as_deref())
                .bind(plugin.code.as_deref())
                .execute(&mut *conn)
                .await?;
                rid
            };

            sqlx::query("UPDATE Plugin SET current_revision_id = ?1 WHERE id = ?2")
                .bind(&revision_id)
                .bind(&plugin.id)
                .execute(&mut *conn)
                .await?;
        }

        sqlx::query(
            "UPDATE ScanSelectedPlugin \
             SET plugin_revision_id = (SELECT current_revision_id FROM Plugin WHERE Plugin.id = ScanSelectedPlugin.plugin_id) \
             WHERE plugin_revision_id IS NULL",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "UPDATE ScanEntrypointInput \
             SET plugin_revision_id = (SELECT current_revision_id FROM Plugin WHERE Plugin.id = ScanEntrypointInput.plugin_id) \
             WHERE plugin_revision_id IS NULL",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "UPDATE ScanPluginResult \
             SET plugin_revision_id = (SELECT current_revision_id FROM Plugin WHERE Plugin.id = ScanPluginResult.plugin_id) \
             WHERE plugin_revision_id IS NULL",
        )
        .execute(&mut *conn)
        .await?;

        Ok(())
    }

    /// Store plugin entrypoints, input definitions, and setting definitions per revision
    /// so that historical scan results reference the exact plugin state that was used.
    async fn migrate_to_v12(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        if !Self::table_exists(conn, "PluginRevisionEntrypoint").await? {
            sqlx::query(
                "CREATE TABLE PluginRevisionEntrypoint (\
                 revision_id TEXT NOT NULL,\
                 id TEXT NOT NULL,\
                 name TEXT NOT NULL,\
                 function_name TEXT NOT NULL,\
                 description TEXT,\
                 PRIMARY KEY (revision_id, id),\
                 FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE\
                 )",
            )
            .execute(&mut *conn)
            .await?;
        }

        if !Self::table_exists(conn, "PluginRevisionInputDef").await? {
            sqlx::query(
                "CREATE TABLE PluginRevisionInputDef (\
                 revision_id TEXT NOT NULL,\
                 entrypoint_id TEXT NOT NULL DEFAULT 'default',\
                 name TEXT NOT NULL,\
                 title TEXT NOT NULL,\
                 type_ TEXT NOT NULL,\
                 type_json TEXT NOT NULL,\
                 enum_values_json TEXT,\
                 optional INTEGER NOT NULL DEFAULT 0,\
                 description TEXT,\
                 default_value_json TEXT,\
                 PRIMARY KEY (revision_id, entrypoint_id, name),\
                 FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE\
                 )",
            )
            .execute(&mut *conn)
            .await?;
        }

        if !Self::table_exists(conn, "PluginRevisionSettingDef").await? {
            sqlx::query(
                "CREATE TABLE PluginRevisionSettingDef (\
                 revision_id TEXT NOT NULL,\
                 name TEXT NOT NULL,\
                 title TEXT NOT NULL,\
                 type_ TEXT NOT NULL,\
                 type_json TEXT NOT NULL,\
                 enum_values_json TEXT,\
                 description TEXT,\
                 required INTEGER NOT NULL DEFAULT 0,\
                 default_value_json TEXT,\
                 PRIMARY KEY (revision_id, name),\
                 FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE\
                 )",
            )
            .execute(&mut *conn)
            .await?;
        }

        // Backfill existing plugins: copy their current metadata into revision-scoped tables.
        let plugins: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, current_revision_id FROM Plugin WHERE current_revision_id IS NOT NULL",
        )
        .fetch_all(&mut *conn)
        .await?;

        for (plugin_id, revision_id) in &plugins {
            let ep_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM PluginRevisionEntrypoint WHERE revision_id = ?1",
            )
            .bind(revision_id)
            .fetch_one(&mut *conn)
            .await?;

            if ep_count == 0 {
                sqlx::query(
                    "INSERT OR IGNORE INTO PluginRevisionEntrypoint \
                     (revision_id, id, name, function_name, description) \
                     SELECT ?1, id, name, function_name, description \
                     FROM PluginEntrypoint WHERE plugin_id = ?2",
                )
                .bind(revision_id)
                .bind(plugin_id)
                .execute(&mut *conn)
                .await?;

                sqlx::query(
                    "INSERT OR IGNORE INTO PluginRevisionInputDef \
                     (revision_id, entrypoint_id, name, title, type_, type_json, \
                      enum_values_json, optional, description, default_value_json) \
                     SELECT ?1, entrypoint_id, name, title, type_, type_json, \
                            enum_values_json, optional, description, default_value_json \
                     FROM PluginInputDef WHERE plugin_id = ?2",
                )
                .bind(revision_id)
                .bind(plugin_id)
                .execute(&mut *conn)
                .await?;

                sqlx::query(
                    "INSERT OR IGNORE INTO PluginRevisionSettingDef \
                     (revision_id, name, title, type_, type_json, \
                      enum_values_json, description, required, default_value_json) \
                     SELECT ?1, name, title, type_, type_json, \
                            enum_values_json, description, required, default_value_json \
                     FROM PluginSettingDef WHERE plugin_id = ?2",
                )
                .bind(revision_id)
                .bind(plugin_id)
                .execute(&mut *conn)
                .await?;
            }
        }

        Ok(())
    }

    /// Full relational schema migration: replace all JSON columns with proper tables.
    async fn migrate_to_v7(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        // 1. Create new relational tables (if not already present from partial runs).
        let ddl = r#"
CREATE TABLE IF NOT EXISTS PluginEntrypoint (
    plugin_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    function_name TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (plugin_id, id),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS PluginInputDef (
    plugin_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    optional INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    default_value_json TEXT,
    PRIMARY KEY (plugin_id, name),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS PluginSettingDef (
    plugin_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    description TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    default_value_json TEXT,
    PRIMARY KEY (plugin_id, entrypoint_id, name),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ProjectPluginSettingValue (
    plugin_id TEXT NOT NULL,
    project_settings_id TEXT NOT NULL,
    setting_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (plugin_id, project_settings_id, setting_name),
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (project_settings_id) REFERENCES ProjectSettings(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ScanSelectedPlugin (
    scan_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL,
    PRIMARY KEY (scan_id, plugin_id, entrypoint_id),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ScanEntrypointInput (
    scan_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (scan_id, plugin_id, entrypoint_id, field_name),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ScanPluginLog (
    id TEXT PRIMARY KEY,
    scan_result_id TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('log', 'warn', 'error')),
    message TEXT NOT NULL,
    FOREIGN KEY (scan_result_id) REFERENCES ScanPluginResult(id) ON DELETE CASCADE
)
"#;
        for statement in ddl.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql).execute(&mut *conn).await?;
        }

        // 2. Add new Plugin metadata columns (may already exist if partially run).
        for col_sql in &[
            "ALTER TABLE Plugin ADD COLUMN description TEXT",
            "ALTER TABLE Plugin ADD COLUMN license TEXT",
            "ALTER TABLE Plugin ADD COLUMN authors_json TEXT",
            "ALTER TABLE Plugin ADD COLUMN icon TEXT",
            "ALTER TABLE Plugin ADD COLUMN homepage TEXT",
        ] {
            let _ = sqlx::query(col_sql).execute(&mut *conn).await;
        }

        // 3. Add ok/error columns to ScanPluginResult.
        for col_sql in &[
            "ALTER TABLE ScanPluginResult ADD COLUMN ok INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE ScanPluginResult ADD COLUMN error TEXT",
        ] {
            let _ = sqlx::query(col_sql).execute(&mut *conn).await;
        }

        // 4. Migrate plugin metadata + schema from JSON columns to new tables.
        let plugins: Vec<(String, Option<String>, Option<String>, Option<String>)> =
            sqlx::query_as(
                "SELECT id, manifest_json, input_schema_json, settings_schema_json FROM Plugin",
            )
            .fetch_all(&mut *conn)
            .await?;

        for (plugin_id, manifest_json_opt, inputs_json_opt, settings_json_opt) in &plugins {
            // 4a. Plugin manifest metadata → Plugin columns + PluginEntrypoint rows.
            if let Some(raw) = manifest_json_opt {
                if let Ok(val) = serde_json::from_str::<Value>(raw) {
                    let desc = val
                        .get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let license = val.get("license").and_then(|v| v.as_str()).unwrap_or("");
                    let icon = val.get("icon").and_then(|v| v.as_str());
                    let homepage = val.get("homepage").and_then(|v| v.as_str());
                    let authors_json = val
                        .get("authors")
                        .map(|a| serde_json::to_string(a).unwrap_or_default());

                    sqlx::query(
                        "UPDATE Plugin SET description=?1, license=?2, authors_json=?3, \
                         icon=?4, homepage=?5 WHERE id=?6",
                    )
                    .bind(desc)
                    .bind(license)
                    .bind(authors_json.as_deref())
                    .bind(icon)
                    .bind(homepage)
                    .bind(plugin_id)
                    .execute(&mut *conn)
                    .await?;

                    // Named entrypoints from manifest.entrypoints.
                    if let Some(Value::Array(eps)) = val.get("entrypoints") {
                        for ep in eps {
                            let ep_id = ep.get("id").and_then(|v| v.as_str()).unwrap_or("default");
                            let ep_name = ep.get("name").and_then(|v| v.as_str()).unwrap_or(ep_id);
                            let ep_fn = ep
                                .get("function")
                                .and_then(|v| v.as_str())
                                .unwrap_or("default");
                            let ep_desc = ep.get("description").and_then(|v| v.as_str());
                            sqlx::query(
                                "INSERT OR IGNORE INTO PluginEntrypoint \
                                 (plugin_id, id, name, function_name, description) \
                                 VALUES (?1, ?2, ?3, ?4, ?5)",
                            )
                            .bind(plugin_id)
                            .bind(ep_id)
                            .bind(ep_name)
                            .bind(ep_fn)
                            .bind(ep_desc)
                            .execute(&mut *conn)
                            .await?;
                        }
                    }
                }
            }

            // Ensure a "default" entrypoint exists for every plugin.
            let ep_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM PluginEntrypoint WHERE plugin_id = ?1")
                    .bind(plugin_id)
                    .fetch_one(&mut *conn)
                    .await?;
            if ep_count == 0 {
                sqlx::query(
                    "INSERT OR IGNORE INTO PluginEntrypoint \
                     (plugin_id, id, name, function_name, description) \
                     VALUES (?1, 'default', 'Default', 'default', NULL)",
                )
                .bind(plugin_id)
                .execute(&mut *conn)
                .await?;
            }

            // 4b. Input schema JSON → PluginInputDef rows.
            if let Some(raw) = inputs_json_opt {
                if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(raw) {
                    for item in &items {
                        let name = match item.get("name").and_then(|v| v.as_str()) {
                            Some(n) => n,
                            None => continue,
                        };
                        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or(name);
                        let type_ = item
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("string");
                        let type_json = serde_json::json!({ "name": type_ }).to_string();
                        let enum_values_json = item
                            .get("validation")
                            .and_then(|v| v.get("enum"))
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_str().map(ToOwned::to_owned))
                                    .collect::<Vec<String>>()
                            })
                            .filter(|v| !v.is_empty())
                            .map(|v| serde_json::to_string(&v).unwrap_or_default());
                        let optional = item
                            .get("optional")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false) as i64;
                        let description = item.get("description").and_then(|v| v.as_str());
                        let default_json = item
                            .get("default")
                            .map(|v| serde_json::to_string(v).unwrap_or_default());
                        sqlx::query(
                            "INSERT OR IGNORE INTO PluginInputDef \
                                (plugin_id, entrypoint_id, name, title, type_, type_json, enum_values_json, optional, description, default_value_json) \
                                VALUES (?1, 'default', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        )
                        .bind(plugin_id)
                        .bind(name)
                        .bind(title)
                        .bind(type_)
                            .bind(&type_json)
                            .bind(enum_values_json.as_deref())
                        .bind(optional)
                        .bind(description)
                        .bind(default_json.as_deref())
                        .execute(&mut *conn)
                        .await?;
                    }
                }
            }

            // 4c. Settings schema JSON → PluginSettingDef rows.
            if let Some(raw) = settings_json_opt {
                if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(raw) {
                    for item in &items {
                        let name = match item.get("name").and_then(|v| v.as_str()) {
                            Some(n) => n,
                            None => continue,
                        };
                        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or(name);
                        let type_ = item
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("string");
                        let type_json = serde_json::json!({ "name": type_ }).to_string();
                        let enum_values_json = item
                            .get("validation")
                            .and_then(|v| v.get("enum"))
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_str().map(ToOwned::to_owned))
                                    .collect::<Vec<String>>()
                            })
                            .filter(|v| !v.is_empty())
                            .map(|v| serde_json::to_string(&v).unwrap_or_default());
                        let description = item.get("description").and_then(|v| v.as_str());
                        let required = item
                            .get("required")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false) as i64;
                        let default_json = item
                            .get("default")
                            .map(|v| serde_json::to_string(v).unwrap_or_default());
                        sqlx::query(
                            "INSERT OR IGNORE INTO PluginSettingDef \
                                (plugin_id, name, title, type_, type_json, enum_values_json, description, required, default_value_json) \
                                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        )
                        .bind(plugin_id)
                        .bind(name)
                        .bind(title)
                        .bind(type_)
                            .bind(&type_json)
                            .bind(enum_values_json.as_deref())
                        .bind(description)
                        .bind(required)
                        .bind(default_json.as_deref())
                        .execute(&mut *conn)
                        .await?;
                    }
                }
            }
        }

        // 5. Migrate ProjectPluginSettings.settings_json → ProjectPluginSettingValue.
        let pps_rows: Vec<(String, String, Option<String>)> = sqlx::query_as(
            "SELECT plugin_id, project_settings_id, settings_json FROM ProjectPluginSettings",
        )
        .fetch_all(&mut *conn)
        .await?;

        for (plugin_id, project_settings_id, settings_json_opt) in &pps_rows {
            // Migrate each key→value in the settings JSON blob.
            if let Some(raw) = settings_json_opt {
                if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(raw) {
                    for (key, val) in &map {
                        let value_json =
                            serde_json::to_string(val).unwrap_or_else(|_| "null".to_string());
                        sqlx::query(
                            "INSERT OR IGNORE INTO ProjectPluginSettingValue \
                             (plugin_id, project_settings_id, setting_name, value_json) \
                             VALUES (?1, ?2, ?3, ?4)",
                        )
                        .bind(plugin_id)
                        .bind(project_settings_id)
                        .bind(key)
                        .bind(&value_json)
                        .execute(&mut *conn)
                        .await?;
                    }
                }
            }
        }

        // 6. Migrate Scan.selected_plugins_json → ScanSelectedPlugin.
        // 6b. Migrate Scan.inputs_json → ScanEntrypointInput.
        let scan_rows: Vec<(String, Option<String>, Option<String>)> =
            sqlx::query_as("SELECT id, selected_plugins_json, inputs_json FROM Scan")
                .fetch_all(&mut *conn)
                .await?;

        for (scan_id, sel_json_opt, inputs_json_opt) in &scan_rows {
            if let Some(raw) = sel_json_opt {
                if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(raw) {
                    for item in &items {
                        let plugin_id = match item
                            .get("pluginId")
                            .and_then(|v| v.as_str())
                            .or_else(|| item.as_str())
                        {
                            Some(p) => p,
                            None => continue,
                        };
                        let entrypoint_id = item
                            .get("entrypointId")
                            .and_then(|v| v.as_str())
                            .unwrap_or("default");
                        sqlx::query(
                            "INSERT OR IGNORE INTO ScanSelectedPlugin \
                             (scan_id, plugin_id, entrypoint_id) VALUES (?1, ?2, ?3)",
                        )
                        .bind(scan_id)
                        .bind(plugin_id)
                        .bind(entrypoint_id)
                        .execute(&mut *conn)
                        .await?;
                    }
                }
            }

            if let Some(raw) = inputs_json_opt {
                if let Ok(Value::Object(outer)) = serde_json::from_str::<Value>(raw) {
                    for (ep_key, fields_val) in &outer {
                        // ep_key format: "pluginId::entrypointId"
                        let (plugin_id, entrypoint_id) = match ep_key.split_once("::") {
                            Some((p, e)) => (p, e),
                            None => (ep_key.as_str(), "default"),
                        };
                        if let Value::Object(fields) = fields_val {
                            for (field_name, val) in fields {
                                let value_json = serde_json::to_string(val)
                                    .unwrap_or_else(|_| "null".to_string());
                                sqlx::query(
                                    "INSERT OR IGNORE INTO ScanEntrypointInput \
                                     (scan_id, plugin_id, entrypoint_id, field_name, value_json) \
                                     VALUES (?1, ?2, ?3, ?4, ?5)",
                                )
                                .bind(scan_id)
                                .bind(plugin_id)
                                .bind(entrypoint_id)
                                .bind(field_name)
                                .bind(&value_json)
                                .execute(&mut *conn)
                                .await?;
                            }
                        }
                    }
                }
            }
        }

        // 7. Migrate ScanPluginResult.output_json_ir → ok/error/data_json columns + ScanPluginLog.
        // Add data_json column first (idempotent — ignore error if it already exists).
        let _ = sqlx::query("ALTER TABLE ScanPluginResult ADD COLUMN data_json TEXT")
            .execute(&mut *conn)
            .await;

        let result_rows: Vec<(String, Option<String>)> =
            sqlx::query_as("SELECT id, output_json_ir FROM ScanPluginResult")
                .fetch_all(&mut *conn)
                .await?;

        for (result_id, output_opt) in &result_rows {
            if let Some(raw) = output_opt {
                if let Ok(val) = serde_json::from_str::<Value>(raw) {
                    let ok = val.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
                    let error = val.get("error").and_then(|v| v.as_str());
                    let data_json = val.get("data").map(|d| d.to_string());
                    sqlx::query(
                        "UPDATE ScanPluginResult SET ok = ?1, error = ?2, data_json = ?3 WHERE id = ?4",
                    )
                    .bind(ok)
                    .bind(error)
                    .bind(data_json.as_deref())
                    .bind(result_id)
                    .execute(&mut *conn)
                    .await?;

                    // Migrate logs array.
                    if let Some(Value::Array(logs)) = val.get("logs") {
                        for log in logs {
                            let level = log
                                .get("level")
                                .and_then(|l| l.as_str())
                                .filter(|l| matches!(*l, "log" | "warn" | "error"))
                                .unwrap_or("log");
                            let message = log.get("message").and_then(|m| m.as_str()).unwrap_or("");
                            sqlx::query(
                                "INSERT INTO ScanPluginLog (id, scan_result_id, level, message) \
                                 VALUES (?1, ?2, ?3, ?4)",
                            )
                            .bind(Uuid::new_v4().to_string())
                            .bind(result_id)
                            .bind(level)
                            .bind(message)
                            .execute(&mut *conn)
                            .await?;
                        }
                    }
                }
            }
        }

        // 8. Drop old JSON columns (SQLite 3.35+ DROP COLUMN).
        let drop_stmts = [
            "ALTER TABLE Plugin DROP COLUMN input_schema_json",
            "ALTER TABLE Plugin DROP COLUMN settings_schema_json",
            "ALTER TABLE Plugin DROP COLUMN manifest_json",
            "ALTER TABLE ProjectPluginSettings DROP COLUMN settings_json",
            "ALTER TABLE Scan DROP COLUMN inputs_json",
            "ALTER TABLE Scan DROP COLUMN selected_plugins_json",
            "ALTER TABLE ScanPluginResult DROP COLUMN output_json_ir",
        ];
        for stmt in &drop_stmts {
            // Ignore error if column doesn't exist (already dropped on retry).
            let _ = sqlx::query(stmt).execute(&mut *conn).await;
        }

        Ok(())
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
    /// Also upserts `PluginEntrypoint`, `PluginInputDef`, and `PluginSettingDef` rows so
    /// the relational tables stay in sync whenever a plugin bundle is saved.
    ///
    /// `pub(super)` so the DAO `save_plugin` implementation can call this without
    /// duplicating the upsert SQL.
    pub(super) async fn insert_plugin(
        conn: &mut SqliteConnection,
        plugin: &LocalPluginBundle,
    ) -> Result<(), PersistenceError> {
        let revision_id = Uuid::new_v4().to_string();
        let version: String = plugin.manifest.version.clone().into();
        let name: String = plugin.manifest.name.clone().into();
        let description: String = plugin.manifest.description.clone().into();
        let license: String = plugin.manifest.license.clone().into();
        let icon: Option<String> = plugin.manifest.icon.as_ref().map(|s| s.to_string());
        let homepage: Option<String> = plugin.manifest.homepage.clone();
        let authors_json = serde_json::to_string(&plugin.manifest.authors)?;

        sqlx::query(
            "INSERT INTO PluginRevision \
             (id, plugin_id, version, name, description, license, authors_json, icon, homepage, code) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )
        .bind(&revision_id)
        .bind(&plugin.id)
        .bind(&version)
        .bind(&name)
        .bind(&description)
        .bind(&license)
        .bind(&authors_json)
        .bind(&icon)
        .bind(&homepage)
        .bind(&plugin.code)
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "INSERT INTO Plugin \
             (id, version, name, description, license, authors_json, icon, homepage, code, current_revision_id) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) \
             ON CONFLICT(id) DO UPDATE SET \
                 version = excluded.version, \
                 name = excluded.name, \
                 description = excluded.description, \
                 license = excluded.license, \
                 authors_json = excluded.authors_json, \
                 icon = excluded.icon, \
                 homepage = excluded.homepage, \
                 code = excluded.code, \
                 current_revision_id = excluded.current_revision_id",
        )
        .bind(&plugin.id)
        .bind(&version)
        .bind(&name)
        .bind(&description)
        .bind(&license)
        .bind(&authors_json)
        .bind(&icon)
        .bind(&homepage)
        .bind(&plugin.code)
        .bind(&revision_id)
        .execute(&mut *conn)
        .await?;

        // Upsert entrypoints. First delete existing to replace cleanly.
        sqlx::query("DELETE FROM PluginEntrypoint WHERE plugin_id = ?1")
            .bind(&plugin.id)
            .execute(&mut *conn)
            .await?;

        for ep in &plugin.manifest.entrypoints {
            let ep_id: String = ep.id.clone().into();
            let ep_name: String = ep.name.clone().into();
            let ep_fn: String = ep.function.clone().into();
            sqlx::query(
                "INSERT INTO PluginEntrypoint (plugin_id, id, name, function_name, description) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(&plugin.id)
            .bind(&ep_id)
            .bind(&ep_name)
            .bind(&ep_fn)
            .bind(&ep.description)
            .execute(&mut *conn)
            .await?;
        }

        // Upsert input definitions.
        sqlx::query("DELETE FROM PluginInputDef WHERE plugin_id = ?1")
            .bind(&plugin.id)
            .execute(&mut *conn)
            .await?;

        for ep in &plugin.manifest.entrypoints {
            let ep_id: String = ep.id.clone().into();
            let inputs = &ep.inputs;
            for input in inputs {
                let name_str: String = input.name.clone().into();
                let title_str = input.title.clone();
                let type_str = input.type_.name().to_string();
                let type_json = serde_json::to_string(&input.type_.to_json_value())
                    .unwrap_or_else(|_| "{\"name\":\"string\"}".to_string());
                let enum_values_json = input
                    .type_
                    .enum_values()
                    .map(|v| v.to_vec())
                    .or_else(|| {
                        input.validation.as_ref().and_then(|v| {
                            if v.enum_.is_empty() {
                                None
                            } else {
                                Some(v.enum_.clone())
                            }
                        })
                    })
                    .filter(|v| !v.is_empty())
                    .map(|v| serde_json::to_string(&v).unwrap_or_default());
                let optional = input.optional as i64;
                let default_json = input
                    .default
                    .as_ref()
                    .map(|v| serde_json::to_string(v).unwrap_or_default());
                sqlx::query(
                    "INSERT INTO PluginInputDef \
                     (plugin_id, entrypoint_id, name, title, type_, type_json, enum_values_json, optional, description, default_value_json) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                )
                .bind(&plugin.id)
                .bind(&ep_id)
                .bind(&name_str)
                .bind(&title_str)
                .bind(&type_str)
                .bind(&type_json)
                .bind(enum_values_json.as_deref())
                .bind(optional)
                .bind(&input.description)
                .bind(default_json.as_deref())
                .execute(&mut *conn)
                .await?;
            }
        }

        // Upsert setting definitions.
        sqlx::query("DELETE FROM PluginSettingDef WHERE plugin_id = ?1")
            .bind(&plugin.id)
            .execute(&mut *conn)
            .await?;

        for setting in &plugin.manifest.settings {
            let name_str: String = setting.name.clone().into();
            let title_str = setting.title.clone();
            let type_str = setting.type_.name().to_string();
            let type_json = serde_json::to_string(&setting.type_.to_json_value())
                .unwrap_or_else(|_| "{\"name\":\"string\"}".to_string());
            let enum_values_json = setting
                .type_
                .enum_values()
                .map(|v| v.to_vec())
                .or_else(|| {
                    setting.validation.as_ref().and_then(|v| {
                        if v.enum_.is_empty() {
                            None
                        } else {
                            Some(v.enum_.clone())
                        }
                    })
                })
                .filter(|v| !v.is_empty())
                .map(|v| serde_json::to_string(&v).unwrap_or_default());
            let required = setting.required as i64;
            let default_json = setting
                .default
                .as_ref()
                .map(|v| serde_json::to_string(v).unwrap_or_default());
            sqlx::query(
                "INSERT INTO PluginSettingDef \
                 (plugin_id, name, title, type_, type_json, enum_values_json, description, required, default_value_json) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            )
            .bind(&plugin.id)
            .bind(&name_str)
            .bind(&title_str)
            .bind(&type_str)
            .bind(&type_json)
            .bind(enum_values_json.as_deref())
            .bind(&setting.description)
            .bind(required)
            .bind(default_json.as_deref())
            .execute(&mut *conn)
            .await?;
        }

        // Snapshot this revision's full metadata into immutable revision-scoped tables.
        // We SELECT from the plugin tables we just populated above, so there is no
        // need to repeat the type-extraction logic.
        sqlx::query(
            "INSERT OR IGNORE INTO PluginRevisionEntrypoint \
             (revision_id, id, name, function_name, description) \
             SELECT ?1, id, name, function_name, description \
             FROM PluginEntrypoint WHERE plugin_id = ?2",
        )
        .bind(&revision_id)
        .bind(&plugin.id)
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "INSERT OR IGNORE INTO PluginRevisionInputDef \
             (revision_id, entrypoint_id, name, title, type_, type_json, \
              enum_values_json, optional, description, default_value_json) \
             SELECT ?1, entrypoint_id, name, title, type_, type_json, \
                    enum_values_json, optional, description, default_value_json \
             FROM PluginInputDef WHERE plugin_id = ?2",
        )
        .bind(&revision_id)
        .bind(&plugin.id)
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "INSERT OR IGNORE INTO PluginRevisionSettingDef \
             (revision_id, name, title, type_, type_json, \
              enum_values_json, description, required, default_value_json) \
             SELECT ?1, name, title, type_, type_json, \
                    enum_values_json, description, required, default_value_json \
             FROM PluginSettingDef WHERE plugin_id = ?2",
        )
        .bind(&revision_id)
        .bind(&plugin.id)
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
