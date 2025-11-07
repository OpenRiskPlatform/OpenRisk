use crate::app::{ProjectPersistence, ProjectSettingsPayload, ProjectSummary};
use crate::app::{PersistenceError, PersistenceErrorKind, PersistenceResult};
use crate::persistence::constants::{
    DEFAULT_LOCALE, PLUGINS_DIR_NAME, PLUGIN_MANIFEST_FILE, PROJECT_DB_FILE,
};
use crate::persistence::types::{LocalPluginBundle, PluginRow, ProjectRow, ProjectSettingsRow};
use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest};
use async_trait::async_trait;
use serde_json::{json, Map, Value};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode},
    Connection, SqliteConnection,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use uuid::Uuid;

const SCHEMA_SQL: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ProjectSettings (
    id TEXT PRIMARY KEY,
    description TEXT,
    locale TEXT
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
    status TEXT NOT NULL CHECK (status IN ('Draft','Running','Finished')),
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

pub struct SqliteProjectPersistence;

impl SqliteProjectPersistence {
    pub fn new() -> Self {
        Self
    }

    fn project_dir(parent_dir: &Path, name: &str) -> PathBuf {
        parent_dir.join(name)
    }

    fn db_path(project_dir: &Path) -> PathBuf {
        project_dir.join(PROJECT_DB_FILE)
    }

    async fn connect(db_path: &Path) -> PersistenceResult<SqliteConnection> {
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

    async fn apply_schema(conn: &mut SqliteConnection) -> PersistenceResult<()> {
        for statement in SCHEMA_SQL.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }

            sqlx::query(sql).execute(&mut *conn).await?;
        }
        Ok(())
    }

    async fn sync_local_plugins(
        conn: &mut SqliteConnection,
        project_settings_id: &str,
    ) -> PersistenceResult<()> {
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
    ) -> PersistenceResult<()> {
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

impl Default for SqliteProjectPersistence {
    fn default() -> Self {
        Self
    }
}

#[async_trait]
impl ProjectPersistence for SqliteProjectPersistence {
    async fn create_project(
        &self,
        name: &str,
        parent_dir: &Path,
    ) -> PersistenceResult<ProjectSummary> {
        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            return Err(PersistenceError::validation(
                "Project name must not be empty",
            ));
        }

        let project_dir = Self::project_dir(parent_dir, trimmed_name);
        if project_dir.exists() {
            return Err(PersistenceError::conflict(format!(
                "Project directory {:?} already exists. Rename project or open existing one.",
                project_dir
            )));
        }

        fs::create_dir_all(&project_dir).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Io,
                format!("Failed to create project directory: {}", err),
                json!({ "path": project_dir.to_string_lossy() }),
            )
        })?;

        let db_path = Self::db_path(&project_dir);
        let mut conn = Self::connect(&db_path).await?;
        Self::apply_schema(&mut conn).await?;

        let project_settings_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO ProjectSettings (id, description, locale) VALUES (?1, ?2, ?3)")
            .bind(&project_settings_id)
            .bind("")
            .bind(DEFAULT_LOCALE)
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

    async fn open_project(&self, project_dir: &Path) -> PersistenceResult<ProjectSummary> {
        let db_path = Self::db_path(project_dir);
        if !db_path.exists() {
            return Err(PersistenceError::validation(format!(
                "There is no project in the directory {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect(&db_path).await?;
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

    async fn load_settings(&self, project_dir: &Path) -> PersistenceResult<ProjectSettingsPayload> {
        let db_path = Self::db_path(project_dir);
        if !db_path.exists() {
            return Err(PersistenceError::validation(format!(
                "There is no project in the directory {:?}",
                db_path
            )));
        }

        let mut conn = Self::connect(&db_path).await?;
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
            "SELECT id, description, locale FROM ProjectSettings WHERE id = ?1",
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
}

fn discover_local_plugins() -> PersistenceResult<Vec<LocalPluginBundle>> {
    let mut root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    root.push(PLUGINS_DIR_NAME);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut bundles = Vec::new();
    for entry in fs::read_dir(&root).map_err(|err| {
        PersistenceError::with_metadata(
            PersistenceErrorKind::Io,
            format!("Failed to read plugins directory: {}", err),
            json!({ "path": root.to_string_lossy() }),
        )
    })? {
        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                eprintln!("Skipping plugin entry: {}", err);
                continue;
            }
        };
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

fn load_plugin_bundle(dir: &Path) -> PersistenceResult<LocalPluginBundle> {
    let plugin_id = dir
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .ok_or_else(|| PersistenceError::validation("Invalid plugin directory name".to_string()))?;

    let manifest_path = dir.join(PLUGIN_MANIFEST_FILE);
    if !manifest_path.exists() {
        return Err(PersistenceError::with_metadata(
            PersistenceErrorKind::NotFound,
            "Missing plugin manifest file",
            json!({ "path": manifest_path.to_string_lossy() }),
        ));
    }

    let manifest_raw = fs::read_to_string(&manifest_path).map_err(|err| {
        PersistenceError::with_metadata(
            PersistenceErrorKind::Io,
            format!("Failed to read manifest: {}", err),
            json!({ "path": manifest_path.to_string_lossy() }),
        )
    })?;
    let manifest = parse_manifest(&manifest_raw)
        .map_err(|err| PersistenceError::validation(err.to_string()))?;
    let manifest_json = serde_json::to_value(&manifest)?;

    let entrypoint: String = manifest.entrypoint.clone().into();
    let code_path = dir.join(&entrypoint);
    if !code_path.exists() {
        return Err(PersistenceError::with_metadata(
            PersistenceErrorKind::NotFound,
            "Missing plugin entrypoint file",
            json!({ "path": code_path.to_string_lossy() }),
        ));
    }
    let code = fs::read_to_string(&code_path).map_err(|err| {
        PersistenceError::with_metadata(
            PersistenceErrorKind::Io,
            format!("Failed to read plugin code: {}", err),
            json!({ "path": code_path.to_string_lossy() }),
        )
    })?;

    Ok(LocalPluginBundle {
        id: plugin_id,
        manifest,
        manifest_json,
        code,
    })
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

impl From<sqlx::Error> for PersistenceError {
    fn from(value: sqlx::Error) -> Self {
        PersistenceError::new(PersistenceErrorKind::Database, value.to_string())
    }
}
