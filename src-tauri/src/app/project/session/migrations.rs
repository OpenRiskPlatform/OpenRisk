//! SQLite schema DDL and incremental migration steps.
//!
//! All public symbols are `pub(super)` — only the parent session module calls them.

use crate::app::project::types::PersistenceError;
use serde_json::{json, Value};
use sqlx::SqliteConnection;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Schema & version constants
// ---------------------------------------------------------------------------

pub(super) const CURRENT_SCHEMA_VERSION: i64 = 16;
const MIN_SUPPORTED_SCHEMA_VERSION: i64 = 4;

pub(super) const PROJECT_LEGACY_ERROR_PREFIX: &str = "PROJECT_LEGACY:";
pub(super) const PROJECT_OUTDATED_ERROR_PREFIX: &str = "PROJECT_OUTDATED:";

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

CREATE TABLE IF NOT EXISTS ProjectPlugin (
    project_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    pinned_revision_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, plugin_id),
    FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (pinned_revision_id) REFERENCES PluginRevision(id) ON DELETE SET NULL
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
    plugin_revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL,
    PRIMARY KEY (scan_id, plugin_revision_id, entrypoint_id),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ScanEntrypointInput (
    scan_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (scan_id, plugin_revision_id, entrypoint_id, field_name),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ScanPluginResult (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    scan_id TEXT NOT NULL,
    ok INTEGER NOT NULL DEFAULT 0,
    data_json TEXT,
    error TEXT,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT
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

CREATE TABLE IF NOT EXISTS PluginRevisionMetricDef (
    revision_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    description TEXT,
    PRIMARY KEY (revision_id, name),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScanPluginMetric (
    scan_result_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    type_json TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (scan_result_id, metric_name),
    FOREIGN KEY (scan_result_id) REFERENCES ScanPluginResult(id) ON DELETE CASCADE
);
"#;

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

pub(super) async fn apply_schema(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    for statement in SCHEMA_SQL.split(';') {
        let sql = statement.trim();
        if sql.is_empty() {
            continue;
        }
        sqlx::query(sql).execute(&mut *conn).await?;
    }
    Ok(())
}

pub(super) async fn apply_migrations_to_latest(
    conn: &mut SqliteConnection,
) -> Result<(), PersistenceError> {
    let has_schema_version = table_exists(conn, "SchemaVersion").await?;
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
            5 => migrate_to_v5(conn).await?,
            6 => migrate_to_v6(conn).await?,
            7 => migrate_to_v7(conn).await?,
            8 => migrate_to_v8(conn).await?,
            9 => migrate_to_v9(conn).await?,
            10 => migrate_to_v10(conn).await?,
            11 => migrate_to_v11(conn).await?,
            12 => migrate_to_v12(conn).await?,
            13 => migrate_to_v13(conn).await?,
            14 => migrate_to_v14(conn).await?,
            15 => migrate_to_v15(conn).await?,
            16 => migrate_to_v16(conn).await?,
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

// ---------------------------------------------------------------------------
// Schema introspection helpers
// ---------------------------------------------------------------------------

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

async fn table_exists(conn: &mut SqliteConnection, table: &str) -> Result<bool, PersistenceError> {
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
// Individual migrations
// ---------------------------------------------------------------------------

async fn migrate_to_v5(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    ensure_scan_result_entrypoint_column(conn).await?;
    migrate_selected_plugins_json(conn).await
}

async fn migrate_to_v6(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    ensure_scan_result_entrypoint_column(conn).await?;
    migrate_selected_plugins_json(conn).await
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
    if table_exists(conn, "PluginInputDef").await? {
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

        let has_default = column_exists(conn, "PluginInputDef_old", "default_value_json").await?;
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

    if table_exists(conn, "PluginSettingDef").await? {
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
    if !column_exists(conn, "Scan", "is_archived").await? {
        sqlx::query("ALTER TABLE Scan ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0")
            .execute(&mut *conn)
            .await?;
    }

    if !column_exists(conn, "Scan", "sort_order").await? {
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
    if !table_exists(conn, "PluginRevision").await? {
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

    if !column_exists(conn, "Plugin", "current_revision_id").await? {
        sqlx::query("ALTER TABLE Plugin ADD COLUMN current_revision_id TEXT")
            .execute(&mut *conn)
            .await?;
    }

    if !column_exists(conn, "ScanSelectedPlugin", "plugin_revision_id").await? {
        sqlx::query("ALTER TABLE ScanSelectedPlugin ADD COLUMN plugin_revision_id TEXT")
            .execute(&mut *conn)
            .await?;
    }

    if !column_exists(conn, "ScanEntrypointInput", "plugin_revision_id").await? {
        sqlx::query("ALTER TABLE ScanEntrypointInput ADD COLUMN plugin_revision_id TEXT")
            .execute(&mut *conn)
            .await?;
    }

    if !column_exists(conn, "ScanPluginResult", "plugin_revision_id").await? {
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
            sqlx::query_scalar::<_, String>("SELECT id FROM PluginRevision WHERE id = ?1 LIMIT 1")
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
    if !table_exists(conn, "PluginRevisionEntrypoint").await? {
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

    if !table_exists(conn, "PluginRevisionInputDef").await? {
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

    if !table_exists(conn, "PluginRevisionSettingDef").await? {
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

/// Introduce normalized project<->plugin link table and backfill existing links.
async fn migrate_to_v13(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    if !table_exists(conn, "ProjectPlugin").await? {
        sqlx::query(
            "CREATE TABLE ProjectPlugin (\
             project_id TEXT NOT NULL,\
             plugin_id TEXT NOT NULL,\
             pinned_revision_id TEXT,\
             enabled INTEGER NOT NULL DEFAULT 1,\
             created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\
             PRIMARY KEY (project_id, plugin_id),\
             FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE,\
             FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,\
             FOREIGN KEY (pinned_revision_id) REFERENCES PluginRevision(id) ON DELETE SET NULL\
             )",
        )
        .execute(&mut *conn)
        .await?;
    }

    // Backfill from existing links (ProjectPluginSettings) for single-project DBs.
    sqlx::query(
        "INSERT OR IGNORE INTO ProjectPlugin (project_id, plugin_id, pinned_revision_id, enabled) \
         SELECT p.id, pps.plugin_id, pl.current_revision_id, 1 \
         FROM ProjectPluginSettings pps \
         JOIN Project p ON p.project_settings_id = pps.project_settings_id \
         LEFT JOIN Plugin pl ON pl.id = pps.plugin_id",
    )
    .execute(&mut *conn)
    .await?;

    // Ensure all known plugins are linked to the current project.
    sqlx::query(
        "INSERT OR IGNORE INTO ProjectPlugin (project_id, plugin_id, pinned_revision_id, enabled) \
         SELECT p.id, pl.id, pl.current_revision_id, 1 \
         FROM Project p, Plugin pl",
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}

/// Enforce revision-first scan schema and remove legacy current-view plugin tables.
async fn migrate_to_v14(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    // Ensure revision id is present before adding NOT NULL constraints.
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

    // Rebuild ScanSelectedPlugin with revision-first PK and strict FK.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ScanSelectedPlugin_new (\
         scan_id TEXT NOT NULL,\
         plugin_id TEXT NOT NULL,\
         plugin_revision_id TEXT NOT NULL,\
         entrypoint_id TEXT NOT NULL,\
         PRIMARY KEY (scan_id, plugin_revision_id, entrypoint_id),\
         FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,\
         FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,\
         FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT\
         )",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO ScanSelectedPlugin_new \
         (scan_id, plugin_id, plugin_revision_id, entrypoint_id) \
         SELECT scan_id, plugin_id, plugin_revision_id, entrypoint_id \
         FROM ScanSelectedPlugin \
         WHERE plugin_revision_id IS NOT NULL",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query("DROP TABLE ScanSelectedPlugin")
        .execute(&mut *conn)
        .await?;
    sqlx::query("ALTER TABLE ScanSelectedPlugin_new RENAME TO ScanSelectedPlugin")
        .execute(&mut *conn)
        .await?;

    // Rebuild ScanEntrypointInput with revision-first PK and strict FK.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ScanEntrypointInput_new (\
         scan_id TEXT NOT NULL,\
         plugin_id TEXT NOT NULL,\
         plugin_revision_id TEXT NOT NULL,\
         entrypoint_id TEXT NOT NULL,\
         field_name TEXT NOT NULL,\
         value_json TEXT NOT NULL DEFAULT 'null',\
         PRIMARY KEY (scan_id, plugin_revision_id, entrypoint_id, field_name),\
         FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,\
         FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,\
         FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT\
         )",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO ScanEntrypointInput_new \
         (scan_id, plugin_id, plugin_revision_id, entrypoint_id, field_name, value_json) \
         SELECT scan_id, plugin_id, plugin_revision_id, entrypoint_id, field_name, value_json \
         FROM ScanEntrypointInput \
         WHERE plugin_revision_id IS NOT NULL",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query("DROP TABLE ScanEntrypointInput")
        .execute(&mut *conn)
        .await?;
    sqlx::query("ALTER TABLE ScanEntrypointInput_new RENAME TO ScanEntrypointInput")
        .execute(&mut *conn)
        .await?;

    // Preserve logs before rebuilding ScanPluginResult (FK dependency).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ScanPluginLog_new (\
         id TEXT PRIMARY KEY,\
         scan_result_id TEXT NOT NULL,\
         level TEXT NOT NULL CHECK (level IN ('log', 'warn', 'error')),\
         message TEXT NOT NULL\
         )",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO ScanPluginLog_new (id, scan_result_id, level, message) \
         SELECT id, scan_result_id, level, message FROM ScanPluginLog",
    )
    .execute(&mut *conn)
    .await?;

    let _ = sqlx::query("DROP TABLE ScanPluginLog")
        .execute(&mut *conn)
        .await;

    // Rebuild ScanPluginResult with NOT NULL revision FK.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ScanPluginResult_new (\
         id TEXT PRIMARY KEY,\
         plugin_id TEXT NOT NULL,\
         plugin_revision_id TEXT NOT NULL,\
         entrypoint_id TEXT NOT NULL DEFAULT 'default',\
         scan_id TEXT NOT NULL,\
         ok INTEGER NOT NULL DEFAULT 0,\
         data_json TEXT,\
         error TEXT,\
         FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,\
         FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,\
         FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT\
         )",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO ScanPluginResult_new \
         (id, plugin_id, plugin_revision_id, entrypoint_id, scan_id, ok, data_json, error) \
         SELECT id, plugin_id, plugin_revision_id, entrypoint_id, scan_id, ok, data_json, error \
         FROM ScanPluginResult \
         WHERE plugin_revision_id IS NOT NULL",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query("DROP TABLE ScanPluginResult")
        .execute(&mut *conn)
        .await?;
    sqlx::query("ALTER TABLE ScanPluginResult_new RENAME TO ScanPluginResult")
        .execute(&mut *conn)
        .await?;

    // Restore ScanPluginLog with FK to rebuilt ScanPluginResult.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ScanPluginLog (\
         id TEXT PRIMARY KEY,\
         scan_result_id TEXT NOT NULL,\
         level TEXT NOT NULL CHECK (level IN ('log', 'warn', 'error')),\
         message TEXT NOT NULL,\
         FOREIGN KEY (scan_result_id) REFERENCES ScanPluginResult(id) ON DELETE CASCADE\
         )",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO ScanPluginLog (id, scan_result_id, level, message) \
         SELECT l.id, l.scan_result_id, l.level, l.message \
         FROM ScanPluginLog_new l \
         WHERE EXISTS (SELECT 1 FROM ScanPluginResult r WHERE r.id = l.scan_result_id)",
    )
    .execute(&mut *conn)
    .await?;

    let _ = sqlx::query("DROP TABLE IF EXISTS ScanPluginLog_new")
        .execute(&mut *conn)
        .await;

    // Remove legacy current-view metadata tables after revision snapshot migration is complete.
    let _ = sqlx::query("DROP TABLE IF EXISTS PluginEntrypoint")
        .execute(&mut *conn)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS PluginInputDef")
        .execute(&mut *conn)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS PluginSettingDef")
        .execute(&mut *conn)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS ProjectPluginSettings")
        .execute(&mut *conn)
        .await;

    Ok(())
}

/// Remove duplicated plugin metadata from `Plugin`.
/// After this step `Plugin` is only logical identity + current revision pointer.
async fn migrate_to_v15(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    // Idempotency: if legacy metadata columns are already absent, skip.
    if !column_exists(conn, "Plugin", "version").await? {
        return Ok(());
    }

    // Rebuild Plugin table with minimal shape.
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS Plugin_new (\
         id TEXT PRIMARY KEY,\
         current_revision_id TEXT\
         )",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO Plugin_new (id, current_revision_id) \
         SELECT id, current_revision_id FROM Plugin",
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query("DROP TABLE Plugin").execute(&mut *conn).await?;
    sqlx::query("ALTER TABLE Plugin_new RENAME TO Plugin")
        .execute(&mut *conn)
        .await?;

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut *conn)
        .await?;

    Ok(())
}

/// Add runtime metric definition/value tables for plugin-level execution statistics.
async fn migrate_to_v16(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    if !table_exists(conn, "PluginRevisionMetricDef").await? {
        sqlx::query(
            "CREATE TABLE PluginRevisionMetricDef (\
             revision_id TEXT NOT NULL,\
             name TEXT NOT NULL,\
             title TEXT NOT NULL,\
             type_ TEXT NOT NULL,\
             type_json TEXT NOT NULL,\
             enum_values_json TEXT,\
             description TEXT,\
             PRIMARY KEY (revision_id, name),\
             FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE\
             )",
        )
        .execute(&mut *conn)
        .await?;
    }

    if !table_exists(conn, "ScanPluginMetric").await? {
        sqlx::query(
            "CREATE TABLE ScanPluginMetric (\
             scan_result_id TEXT NOT NULL,\
             metric_name TEXT NOT NULL,\
             type_json TEXT NOT NULL,\
             value_json TEXT NOT NULL DEFAULT 'null',\
             PRIMARY KEY (scan_result_id, metric_name),\
             FOREIGN KEY (scan_result_id) REFERENCES ScanPluginResult(id) ON DELETE CASCADE\
             )",
        )
        .execute(&mut *conn)
        .await?;
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
    let plugins: Vec<(String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
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
                    let (plugin_id, entrypoint_id) = match ep_key.split_once("::") {
                        Some((p, e)) => (p, e),
                        None => (ep_key.as_str(), "default"),
                    };
                    if let Value::Object(fields) = fields_val {
                        for (field_name, val) in fields {
                            let value_json =
                                serde_json::to_string(val).unwrap_or_else(|_| "null".to_string());
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
        let _ = sqlx::query(stmt).execute(&mut *conn).await;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------

async fn ensure_scan_result_entrypoint_column(
    conn: &mut SqliteConnection,
) -> Result<(), PersistenceError> {
    if !column_exists(conn, "ScanPluginResult", "entrypoint_id").await? {
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
