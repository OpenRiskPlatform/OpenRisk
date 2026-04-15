//! Shared low-level helpers used across DAO sub-modules.

use crate::app::project::types::*;
use sqlx::SqliteConnection;

pub(super) fn conn_unavailable() -> PersistenceError {
    PersistenceError::Validation(
        "Project connection is temporarily unavailable during an encryption operation. \
         Please reopen the project."
            .into(),
    )
}

pub(super) fn normalize_theme(value: Option<String>) -> String {
    match value.as_deref() {
        Some("light") => "light".to_string(),
        Some("dark") => "dark".to_string(),
        _ => "system".to_string(),
    }
}

pub(super) async fn project_id(conn: &mut SqliteConnection) -> Result<String, PersistenceError> {
    let row = sqlx::query!(r#"SELECT id as "id!: String" FROM Project LIMIT 1"#)
        .fetch_one(conn)
        .await?;
    Ok(row.id)
}

pub(super) async fn project_settings_id(
    conn: &mut SqliteConnection,
) -> Result<String, PersistenceError> {
    let row = sqlx::query!(
        r#"SELECT project_settings_id as "project_settings_id!: String" FROM Project LIMIT 1"#
    )
    .fetch_one(conn)
    .await?;
    Ok(row.project_settings_id)
}

pub(super) async fn load_scan_logs(
    conn: &mut SqliteConnection,
    scan_result_id: &str,
) -> Result<Vec<LogEntry>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT level as "level!", message as "message!"
           FROM ScanPluginLog
           WHERE scan_result_id = ?1 ORDER BY ScanPluginLog.rowid"#,
        scan_result_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let level = match row.level.as_str() {
                "warn" => LogLevel::Warn,
                "error" => LogLevel::Error,
                _ => LogLevel::Log,
            };
            LogEntry {
                level,
                message: row.message,
            }
        })
        .collect())
}

fn parse_setting_value_json(value_json: &str) -> SettingValue {
    serde_json::from_str::<serde_json::Value>(value_json)
        .map(|v| SettingValue::from_json(&v))
        .unwrap_or(SettingValue::Null)
}

fn parse_field_type(type_json: &str, enum_values_json: Option<&str>) -> PluginFieldTypeDef {
    let mut field_type =
        serde_json::from_str::<PluginFieldTypeDef>(type_json).unwrap_or(PluginFieldTypeDef {
            name: "string".to_string(),
            values: None,
        });

    if field_type.values.is_none() {
        field_type.values = enum_values_json.and_then(|s| {
            serde_json::from_str::<Vec<String>>(s)
                .ok()
                .filter(|v| !v.is_empty())
        });
    }

    field_type
}

fn parse_default_setting_value(default_value_json: Option<&str>) -> Option<SettingValue> {
    default_value_json.and_then(|s| {
        serde_json::from_str::<serde_json::Value>(s)
            .ok()
            .map(|v| SettingValue::from_json(&v))
    })
}

struct PluginHead {
    id: String,
    name: String,
    version: String,
    enabled: bool,
    manifest: PluginManifestRecord,
}

async fn load_plugin_head(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
) -> Result<PluginHead, PersistenceError> {
    let row = sqlx::query!(
        r#"SELECT p.id as "id!", pr.name as "name!",
              pr.version as "version!", COALESCE(pp.enabled, 1) as "enabled!: i64",
                pr.description, pr.license, pr.authors_json, pr.icon, pr.homepage, pr.update_metrics_fn
            FROM Plugin p
            LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2
            INNER JOIN PluginRevision pr ON pr.id = COALESCE(pp.pinned_revision_id, p.current_revision_id)
            WHERE p.id = ?1
            LIMIT 1"#,
        plugin_id,
        project_id,
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| PersistenceError::Validation(format!("Plugin '{}' not found", plugin_id)))?;

    let authors: Vec<PluginAuthor> = row
        .authors_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let manifest = PluginManifestRecord {
        id: row.id.clone(),
        name: row.name.clone(),
        version: row.version.clone(),
        description: row.description.unwrap_or_default(),
        license: row.license.unwrap_or_default(),
        authors,
        icon: row.icon,
        homepage: row.homepage,
        update_metrics_fn: row.update_metrics_fn,
    };

    Ok(PluginHead {
        id: row.id,
        name: row.name,
        version: row.version,
        enabled: row.enabled != 0,
        manifest,
    })
}

async fn load_plugin_entrypoints(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
) -> Result<Vec<PluginEntrypointRecord>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT pre.id as "id!", pre.name as "name!",
                pre.function_name as "function_name!", pre.description
            FROM Plugin p
            LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2
            INNER JOIN PluginRevisionEntrypoint pre ON pre.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id)
            WHERE p.id = ?1
            ORDER BY pre.rowid"#,
        plugin_id,
        project_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| PluginEntrypointRecord {
            id: row.id,
            name: row.name,
            function_name: row.function_name,
            description: row.description,
        })
        .collect())
}

async fn load_plugin_input_defs(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
) -> Result<Vec<PluginInputDef>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT prid.entrypoint_id as "entrypoint_id!",
                      prid.name as "name!", prid.title as "title!",
                      prid.type_json as "type_json!", prid.enum_values_json,
                      prid.optional, prid.description, prid.default_value_json
               FROM Plugin p
               LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2
               INNER JOIN PluginRevisionInputDef prid ON prid.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id)
               WHERE p.id = ?1
               ORDER BY prid.rowid"#,
        plugin_id,
        project_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| PluginInputDef {
            entrypoint_id: row.entrypoint_id,
            name: row.name,
            title: row.title,
            type_: parse_field_type(&row.type_json, row.enum_values_json.as_deref()),
            optional: row.optional != 0,
            description: row.description,
            default_value: parse_default_setting_value(row.default_value_json.as_deref()),
        })
        .collect())
}

async fn load_plugin_setting_defs(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
) -> Result<Vec<PluginSettingDef>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT prs.name as "name!", prs.title as "title!",
                      prs.type_json as "type_json!", prs.enum_values_json, prs.description,
                      prs.required, prs.default_value_json
               FROM Plugin p
               LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2
               INNER JOIN PluginRevisionSettingDef prs ON prs.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id)
               WHERE p.id = ?1
               ORDER BY prs.rowid"#,
        plugin_id,
        project_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| PluginSettingDef {
            name: row.name,
            title: row.title,
            type_: parse_field_type(&row.type_json, row.enum_values_json.as_deref()),
            description: row.description,
            required: row.required != 0,
            default_value: parse_default_setting_value(row.default_value_json.as_deref()),
        })
        .collect())
}

async fn load_plugin_metric_defs(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
) -> Result<Vec<PluginMetricDef>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT prm.name as "name!", prm.title as "title!",
                  prm.type_json as "type_json!", prm.enum_values_json, prm.description
           FROM Plugin p
           LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2
           INNER JOIN PluginRevisionMetricDef prm ON prm.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id)
           WHERE p.id = ?1
           ORDER BY prm.rowid"#,
        plugin_id,
        project_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| PluginMetricDef {
            name: row.name,
            title: row.title,
            type_: parse_field_type(&row.type_json, row.enum_values_json.as_deref()),
            description: row.description,
        })
        .collect())
}

async fn load_plugin_metric_values(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
) -> Result<Vec<PluginMetricValue>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT m.metric_name as "metric_name!", d.type_json as "type_json!",
                                    m.value_json as "value_json!", d.description,
                                      COALESCE(d.title, m.metric_name) as "title!: String"
                     FROM PluginMetric m
                     INNER JOIN PluginRevisionMetricDef d
                         ON d.name = m.metric_name
                         AND d.revision_id = (
                                 SELECT COALESCE(pp2.pinned_revision_id, p2.current_revision_id)
                                 FROM Plugin p2
                                 LEFT JOIN ProjectPlugin pp2 ON pp2.plugin_id = p2.id AND pp2.project_id = ?2
                                 WHERE p2.id = ?1
                         )
                     WHERE m.plugin_id = ?1
                     ORDER BY m.metric_name"#,
        plugin_id,
        project_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| PluginMetricValue {
            name: row.metric_name,
            title: row.title,
            type_: parse_field_type(&row.type_json, None),
            description: row.description,
            value: parse_setting_value_json(&row.value_json),
        })
        .collect())
}

async fn load_plugin_setting_values(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_settings_id: &str,
) -> Result<Vec<PluginSettingValue>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT setting_name as "setting_name!", value_json as "value_json!"
           FROM ProjectPluginSettingValue
           WHERE plugin_id = ?1 AND project_settings_id = ?2"#,
        plugin_id,
        project_settings_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| PluginSettingValue {
            name: row.setting_name,
            value: parse_setting_value_json(&row.value_json),
        })
        .collect())
}

pub(super) async fn load_plugin_record(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
    project_settings_id: &str,
) -> Result<PluginRecord, PersistenceError> {
    let head = load_plugin_head(conn, plugin_id, project_id).await?;
    let entrypoints = load_plugin_entrypoints(conn, plugin_id, project_id).await?;
    let input_defs = load_plugin_input_defs(conn, plugin_id, project_id).await?;
    let setting_defs = load_plugin_setting_defs(conn, plugin_id, project_id).await?;
    let metric_defs = load_plugin_metric_defs(conn, plugin_id, project_id).await?;
    let metric_values = load_plugin_metric_values(conn, plugin_id, project_id).await?;
    let setting_values = load_plugin_setting_values(conn, plugin_id, project_settings_id).await?;

    Ok(PluginRecord {
        id: head.id,
        name: head.name,
        version: head.version,
        enabled: head.enabled,
        manifest: head.manifest,
        entrypoints,
        input_defs,
        setting_defs,
        metric_defs,
        metric_values,
        setting_values,
    })
}
