//! Session lifecycle for SQLite/SQLCipher project databases.
//!
//! [`SqliteProjectPersistence`] is the production store that wraps a single SQLite connection
//! for the lifetime of an open project. Concerns:
//! - [`mod@migrations`]  — Schema DDL, version constants, and all `migrate_to_vN` steps
//! - Factory methods: [`SqliteProjectPersistence::create`], [`open`], [`open_with_password`],
//!   [`check_lock_status`]
//! - Low-level connection management and SQLCipher key handling
//! - Path resolution helpers
//! - Re-encryption via `sqlcipher_export`
//!
//! Business-logic operations on an open session are implemented as
//! `impl ProjectPersistence for SqliteProjectPersistence` in [`super::dao`].

pub(super) mod migrations;

use super::plugins::{sidecar_path, LocalPluginBundle};
use super::security::{
    cache_key, clear_cached_key, escape_sql_literal, get_cached_key, lock_error,
};
use super::types::{PersistenceError, ProjectLockStatus, ProjectSummary};
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use uuid::Uuid;

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
        migrations::apply_schema(&mut conn).await?;
        sqlx::query("INSERT INTO SchemaVersion (id, version) VALUES (1, ?1)")
            .bind(migrations::CURRENT_SCHEMA_VERSION)
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

        migrations::apply_schema(&mut conn).await?;
        migrations::apply_migrations_to_latest(&mut conn).await?;

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
