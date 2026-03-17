use crate::app::plugin as plugin_app;
use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest};
use async_trait::async_trait;
use serde::Serialize;
use serde_json::{json, Map, Value};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode},
    Connection, SqliteConnection,
};
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use uuid::Uuid;

const DB_FILE_NAME: &str = "project.db";
const PLUGINS_DIR_NAME: &str = "plugins";
const CURRENT_SCHEMA_VERSION: i64 = 4;

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
    pub output: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanDetailRecord {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub selected_plugins: Vec<String>,
    pub inputs: Value,
    pub results: Vec<ScanPluginResultRecord>,
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

    async fn connect(db_path: &Path) -> Result<SqliteConnection, PersistenceError> {
        let options = SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .busy_timeout(Duration::from_secs(5))
            .foreign_keys(true);

        SqliteConnection::connect_with(&options)
            .await
            .map_err(PersistenceError::from)
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
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS SchemaVersion (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL)",
        )
        .execute(&mut *conn)
        .await?;

        let existing =
            sqlx::query_scalar::<_, i64>("SELECT version FROM SchemaVersion WHERE id = 1")
                .fetch_optional(&mut *conn)
                .await?;

        let mut current_version = match existing {
            Some(version) => version,
            None => {
                let has_theme = Self::column_exists(conn, "ProjectSettings", "theme").await?;
                let detected = if has_theme { 2 } else { 1 };
                sqlx::query(
                    "INSERT INTO SchemaVersion (id, version) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET version = excluded.version",
                )
                .bind(detected)
                .execute(&mut *conn)
                .await?;
                detected
            }
        };

        while current_version < CURRENT_SCHEMA_VERSION {
            let next = current_version + 1;
            match next {
                2 => Self::migrate_to_v2(conn).await?,
                3 => Self::migrate_to_v3(conn).await?,
                4 => Self::migrate_to_v4(conn).await?,
                _ => {
                    return Err(PersistenceError::Validation(format!(
                        "Missing migration for schema version {}",
                        next
                    )))
                }
            }

            sqlx::query("UPDATE SchemaVersion SET version = ?1 WHERE id = 1")
                .bind(next)
                .execute(&mut *conn)
                .await?;
            current_version = next;
        }

        Ok(())
    }

    async fn migrate_to_v2(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        let has_theme = Self::column_exists(conn, "ProjectSettings", "theme").await?;
        if !has_theme {
            sqlx::query("ALTER TABLE ProjectSettings ADD COLUMN theme TEXT")
                .execute(&mut *conn)
                .await?;
        }

        Ok(())
    }

    async fn migrate_to_v3(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        let has_scan = Self::table_exists(conn, "Scan").await?;
        if !has_scan {
            sqlx::query(
                "CREATE TABLE Scan (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('Draft','Running','Completed','Failed')),
                    preview TEXT,
                    inputs_json TEXT CHECK (inputs_json IS NULL OR json_valid(inputs_json)),
                    selected_plugins_json TEXT CHECK (selected_plugins_json IS NULL OR json_valid(selected_plugins_json)),
                    FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE
                )",
            )
            .execute(&mut *conn)
            .await?;
            return Ok(());
        }

        // Rebuild Scan table to update status enum and migrate old Finished -> Completed.
        sqlx::query("ALTER TABLE Scan RENAME TO Scan_old")
            .execute(&mut *conn)
            .await?;

        // Rebuild dependent results table to keep FK pointing to the final Scan table.
        sqlx::query("ALTER TABLE ScanPluginResult RENAME TO ScanPluginResult_old")
            .execute(&mut *conn)
            .await?;

        sqlx::query(
            "CREATE TABLE Scan (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('Draft','Running','Completed','Failed')),
                preview TEXT,
                inputs_json TEXT CHECK (inputs_json IS NULL OR json_valid(inputs_json)),
                selected_plugins_json TEXT CHECK (selected_plugins_json IS NULL OR json_valid(selected_plugins_json)),
                FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE
            )",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "CREATE TABLE ScanPluginResult (
                id TEXT PRIMARY KEY,
                plugin_id TEXT NOT NULL,
                scan_id TEXT NOT NULL,
                output_json_ir TEXT CHECK (output_json_ir IS NULL OR json_valid(output_json_ir)),
                FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
                FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE
            )",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "INSERT INTO Scan (id, project_id, status, preview, inputs_json, selected_plugins_json)
             SELECT id, project_id,
                CASE status
                    WHEN 'Finished' THEN 'Completed'
                    WHEN 'Draft' THEN 'Draft'
                    WHEN 'Running' THEN 'Running'
                    ELSE 'Failed'
                END,
                preview,
                inputs_json,
                selected_plugins_json
             FROM Scan_old",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "INSERT INTO ScanPluginResult (id, plugin_id, scan_id, output_json_ir)
             SELECT id, plugin_id, scan_id, output_json_ir FROM ScanPluginResult_old",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query("DROP TABLE Scan_old")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DROP TABLE ScanPluginResult_old")
            .execute(&mut *conn)
            .await?;

        Ok(())
    }

    async fn migrate_to_v4(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
        let has_scan = Self::table_exists(conn, "Scan").await?;
        let has_scan_old = Self::table_exists(conn, "Scan_old").await?;

        if !has_scan {
            sqlx::query(
                "CREATE TABLE Scan (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('Draft','Running','Completed','Failed')),
                    preview TEXT,
                    inputs_json TEXT CHECK (inputs_json IS NULL OR json_valid(inputs_json)),
                    selected_plugins_json TEXT CHECK (selected_plugins_json IS NULL OR json_valid(selected_plugins_json)),
                    FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE
                )",
            )
            .execute(&mut *conn)
            .await?;
        }

        if has_scan_old {
            sqlx::query(
                "INSERT OR IGNORE INTO Scan (id, project_id, status, preview, inputs_json, selected_plugins_json)
                 SELECT id, project_id,
                    CASE status
                        WHEN 'Finished' THEN 'Completed'
                        WHEN 'Draft' THEN 'Draft'
                        WHEN 'Running' THEN 'Running'
                        WHEN 'Completed' THEN 'Completed'
                        ELSE 'Failed'
                    END,
                    preview,
                    inputs_json,
                    selected_plugins_json
                 FROM Scan_old",
            )
            .execute(&mut *conn)
            .await?;

            sqlx::query("DROP TABLE Scan_old")
                .execute(&mut *conn)
                .await?;
        }

        Self::rebuild_scan_results_table(conn, "ScanPluginResult").await?;
        Self::rebuild_scan_results_table(conn, "ScanPluginResult_old").await?;
        Self::rebuild_scan_results_table(conn, "ScanPluginResult_old_v4").await?;

        Ok(())
    }

    async fn rebuild_scan_results_table(
        conn: &mut SqliteConnection,
        source_table: &str,
    ) -> Result<(), PersistenceError> {
        if !Self::table_exists(conn, source_table).await? {
            return Ok(());
        }

        let has_target = Self::table_exists(conn, "ScanPluginResult").await?;
        if !has_target {
            sqlx::query(
                "CREATE TABLE ScanPluginResult (
                    id TEXT PRIMARY KEY,
                    plugin_id TEXT NOT NULL,
                    scan_id TEXT NOT NULL,
                    output_json_ir TEXT CHECK (output_json_ir IS NULL OR json_valid(output_json_ir)),
                    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
                    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE
                )",
            )
            .execute(&mut *conn)
            .await?;
        }

        if source_table != "ScanPluginResult" {
            let insert_sql = format!(
                "INSERT OR IGNORE INTO ScanPluginResult (id, plugin_id, scan_id, output_json_ir)
                 SELECT id, plugin_id, scan_id, output_json_ir FROM {} WHERE scan_id IN (SELECT id FROM Scan)",
                source_table
            );
            sqlx::query(&insert_sql).execute(&mut *conn).await?;
            let drop_sql = format!("DROP TABLE {}", source_table);
            sqlx::query(&drop_sql).execute(&mut *conn).await?;
            return Ok(());
        }

        // Rebuild target table in place to ensure FK points to Scan (not stale Scan_old).
        sqlx::query("ALTER TABLE ScanPluginResult RENAME TO ScanPluginResult_old_v4")
            .execute(&mut *conn)
            .await?;

        sqlx::query(
            "CREATE TABLE ScanPluginResult (
                id TEXT PRIMARY KEY,
                plugin_id TEXT NOT NULL,
                scan_id TEXT NOT NULL,
                output_json_ir TEXT CHECK (output_json_ir IS NULL OR json_valid(output_json_ir)),
                FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
                FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE
            )",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query(
            "INSERT OR IGNORE INTO ScanPluginResult (id, plugin_id, scan_id, output_json_ir)
             SELECT id, plugin_id, scan_id, output_json_ir FROM ScanPluginResult_old_v4 WHERE scan_id IN (SELECT id FROM Scan)",
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query("DROP TABLE ScanPluginResult_old_v4")
            .execute(&mut *conn)
            .await?;

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

    fn project_dir(parent_dir: &Path, trimmed_name: &str) -> PathBuf {
        parent_dir.join(trimmed_name)
    }

    fn db_path(project_dir: &Path) -> PathBuf {
        project_dir.join(DB_FILE_NAME)
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
        parent_dir: &Path,
    ) -> Result<ProjectSummary, PersistenceError> {
        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            return Err(PersistenceError::Validation(
                "Project name must not be empty".into(),
            ));
        }

        let project_dir = Self::project_dir(parent_dir, trimmed_name);
        if project_dir.exists() {
            return Err(PersistenceError::Validation(format!(
                "Project directory {:?} already exists. Rename project or open existing one.",
                project_dir
            )));
        }

        fs::create_dir_all(&project_dir)?;

        let db_path = Self::db_path(&project_dir);
        let mut conn = Self::connect(&db_path).await?;
        Self::apply_schema(&mut conn).await?;
        Self::apply_migrations_to_latest(&mut conn).await?;

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
            directory: project_dir,
        })
    }

    async fn open_project(&self, project_dir: &Path) -> Result<ProjectSummary, PersistenceError> {
        let db_path = Self::db_path(project_dir);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project in the directory {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect(&db_path).await?;
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
            directory: project_dir.to_path_buf(),
        })
    }

    async fn load_settings(
        &self,
        project_dir: &Path,
    ) -> Result<ProjectSettingsPayload, PersistenceError> {
        let db_path = Self::db_path(project_dir);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project in the directory {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect(&db_path).await?;
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
            directory: project_dir.to_path_buf(),
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
        project_dir: &Path,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError> {
        let db_path = Self::db_path(project_dir);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project in the directory {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect(&db_path).await?;
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
        project_dir: &Path,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        if !settings.is_object() {
            return Err(PersistenceError::Validation(
                "Plugin settings must be a JSON object".to_string(),
            ));
        }

        let db_path = Self::db_path(project_dir);
        if !db_path.exists() {
            return Err(PersistenceError::Validation(format!(
                "There is no project in the directory {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect(&db_path).await?;
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

pub async fn create_project(name: String, dir_path: PathBuf) -> Result<ProjectSummary, String> {
    let store = SqliteProjectPersistence::new();
    store
        .create_project(&name, &dir_path)
        .await
        .map_err(|e| e.to_string())
}

pub async fn open_project(dir_path: PathBuf) -> Result<ProjectSummary, String> {
    // check if project.db exists
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
    }
    let store = SqliteProjectPersistence::new();
    store
        .open_project(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

pub async fn load_settings(dir_path: PathBuf) -> Result<ProjectSettingsPayload, String> {
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
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
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
    }

    let store = SqliteProjectPersistence::new();
    store
        .update_project_settings(&dir_path, theme)
        .await
        .map_err(|e| e.to_string())
}

pub async fn update_project_plugin_settings(
    dir_path: PathBuf,
    plugin_id: String,
    settings: Value,
) -> Result<PluginSettingsPayload, String> {
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
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
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
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

    let mut conn = SqliteProjectPersistence::connect(&db_path)
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
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
    }

    let mut conn = SqliteProjectPersistence::connect(&db_path)
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
    let inputs_json = "{}".to_string();
    let selected_plugins_json = "[]".to_string();

    sqlx::query(
        "INSERT INTO Scan (id, project_id, status, preview, inputs_json, selected_plugins_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(&project_id)
    .bind("Draft")
    .bind(preview.clone())
    .bind(inputs_json)
    .bind(selected_plugins_json)
    .execute(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    Ok(ScanSummaryRecord {
        id,
        status: "Draft".to_string(),
        preview,
    })
}

pub async fn list_scans(dir_path: PathBuf) -> Result<Vec<ScanSummaryRecord>, String> {
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
    }

    let mut conn = SqliteProjectPersistence::connect(&db_path)
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
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
    }

    let mut conn = SqliteProjectPersistence::connect(&db_path)
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
    let selected_plugins = match selected_plugins_raw {
        Value::Array(items) => items
            .into_iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        _ => Vec::new(),
    };

    let result_rows = sqlx::query_as::<_, ScanResultRow>(
        "SELECT plugin_id, output_json_ir FROM ScanPluginResult WHERE scan_id = ?1",
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
    selected_plugins: Vec<String>,
    inputs: Value,
) -> Result<ScanSummaryRecord, String> {
    let db_path = dir_path.join(DB_FILE_NAME);
    if !db_path.exists() {
        return Err(format!("No project found in directory {:?}", dir_path));
    }
    if selected_plugins.is_empty() {
        return Err("Select at least one plugin before run".to_string());
    }

    let mut conn = SqliteProjectPersistence::connect(&db_path)
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
        .bind(selected_plugins_json)
        .bind(inputs_json)
        .bind(&scan_id)
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    if !selected_plugins.is_empty() {
        sqlx::query("DELETE FROM ScanPluginResult WHERE scan_id = ?1")
            .bind(&scan_id)
            .execute(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
    }

    let inputs_by_plugin = if inputs.is_object() {
        inputs
    } else {
        Value::Object(Map::new())
    };

    for plugin_id in &selected_plugins {
        let plugin_inputs = inputs_by_plugin
            .get(plugin_id)
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));

        let runtime_row = sqlx::query_as::<_, (Option<String>, Option<String>)>(
            "SELECT ProjectPluginSettings.settings_json, Plugin.code
             FROM ProjectPluginSettings
             INNER JOIN Plugin ON Plugin.id = ProjectPluginSettings.plugin_id
             WHERE ProjectPluginSettings.plugin_id = ?1 AND ProjectPluginSettings.project_settings_id = ?2
             LIMIT 1",
        )
        .bind(plugin_id)
        .bind(&project_settings_id)
        .fetch_optional(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

        let (settings_json, plugin_code) = runtime_row
            .ok_or_else(|| format!("Plugin '{}' is not registered in project DB", plugin_id))?;

        let plugin_settings = match settings_json {
            Some(raw) if !raw.trim().is_empty() => {
                serde_json::from_str::<Value>(&raw).map_err(|e| e.to_string())?
            }
            _ => Value::Object(Map::new()),
        };

        let code = plugin_code
            .filter(|c| !c.trim().is_empty())
            .ok_or_else(|| format!("Plugin '{}' has empty code in project DB", plugin_id))?;

        let execute_result = tauri::async_runtime::spawn_blocking(move || {
            plugin_app::execute_plugin_code_with_settings(code, plugin_inputs, plugin_settings)
        })
        .await
        .map_err(|e| format!("Failed to join plugin execution task: {}", e))?;

        match execute_result {
            Ok(output) => {
                let output_json = serde_json::to_string(&output).map_err(|e| e.to_string())?;
                sqlx::query(
                    "INSERT INTO ScanPluginResult (id, plugin_id, scan_id, output_json_ir) VALUES (?1, ?2, ?3, ?4)",
                )
                .bind(Uuid::new_v4().to_string())
                .bind(plugin_id)
                .bind(&scan_id)
                .bind(output_json)
                .execute(&mut conn)
                .await
                .map_err(|e| e.to_string())?;
            }
            Err(err) => {
                sqlx::query("UPDATE Scan SET status = 'Failed' WHERE id = ?1")
                    .bind(&scan_id)
                    .execute(&mut conn)
                    .await
                    .map_err(|e| e.to_string())?;
                return Err(format!("Plugin '{}' failed: {}", plugin_id, err));
            }
        }
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
