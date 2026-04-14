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

pub(super) async fn load_scan_logs(
    conn: &mut SqliteConnection,
    scan_result_id: &str,
) -> Result<Vec<LogEntry>, PersistenceError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT level, message FROM ScanPluginLog \
            WHERE scan_result_id = ?1 ORDER BY ScanPluginLog.rowid",
    )
    .bind(scan_result_id)
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(level, message)| {
            let level = match level.as_str() {
                "warn" => LogLevel::Warn,
                "error" => LogLevel::Error,
                _ => LogLevel::Log,
            };
            LogEntry { level, message }
        })
        .collect())
}

pub(super) async fn load_plugin_record(
    conn: &mut SqliteConnection,
    plugin_id: &str,
    project_id: &str,
    project_settings_id: &str,
) -> Result<PluginRecord, PersistenceError> {
    #[derive(sqlx::FromRow)]
    struct PluginRow {
        id: String,
        name: String,
        version: String,
        enabled: i64,
        description: Option<String>,
        license: Option<String>,
        authors_json: Option<String>,
        icon: Option<String>,
        homepage: Option<String>,
        update_metrics_fn: Option<String>,
    }

    let row = sqlx::query_as::<_, PluginRow>(
        "SELECT p.id, pr.name, pr.version, COALESCE(pp.enabled, 1) as enabled, \
         pr.description, pr.license, pr.authors_json, pr.icon, pr.homepage, pr.update_metrics_fn \
         FROM Plugin p \
         LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2 \
         INNER JOIN PluginRevision pr ON pr.id = COALESCE(pp.pinned_revision_id, p.current_revision_id) \
         WHERE p.id = ?1 \
         LIMIT 1",
    )
    .bind(plugin_id)
    .bind(project_id)
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
        description: row.description.clone().unwrap_or_default(),
        license: row.license.clone().unwrap_or_default(),
        authors,
        icon: row.icon.clone(),
        homepage: row.homepage.clone(),
        update_metrics_fn: row.update_metrics_fn.clone(),
    };

    #[derive(sqlx::FromRow)]
    struct EpRow {
        id: String,
        name: String,
        function_name: String,
        description: Option<String>,
    }

    let ep_rows = sqlx::query_as::<_, EpRow>(
        "SELECT pre.id, pre.name, pre.function_name, pre.description \
         FROM Plugin p \
         LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2 \
         INNER JOIN PluginRevisionEntrypoint pre ON pre.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id) \
         WHERE p.id = ?1 \
            ORDER BY pre.rowid",
    )
    .bind(plugin_id)
    .bind(project_id)
    .fetch_all(&mut *conn)
    .await?;

    let entrypoints = ep_rows
        .into_iter()
        .map(|ep| PluginEntrypointRecord {
            id: ep.id,
            name: ep.name,
            function_name: ep.function_name,
            description: ep.description,
        })
        .collect();

    let input_rows: Vec<(
        String,
        String,
        String,
        String,
        Option<String>,
        i64,
        Option<String>,
        Option<String>,
    )> =
        sqlx::query_as(
            "SELECT prid.entrypoint_id, prid.name, prid.title, prid.type_json, prid.enum_values_json, \
                    prid.optional, prid.description, prid.default_value_json \
             FROM Plugin p \
             LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2 \
             INNER JOIN PluginRevisionInputDef prid ON prid.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id) \
             WHERE p.id = ?1 \
               ORDER BY prid.rowid",
        )
        .bind(plugin_id)
        .bind(project_id)
        .fetch_all(&mut *conn)
        .await?;

    let input_defs = input_rows
        .into_iter()
        .map(
            |(
                entrypoint_id,
                name,
                title,
                type_json,
                enum_values_json,
                optional,
                description,
                dvj,
            )| {
                let mut field_type = serde_json::from_str::<PluginFieldTypeDef>(&type_json)
                    .unwrap_or(PluginFieldTypeDef {
                        name: "string".to_string(),
                        values: None,
                    });
                if field_type.values.is_none() {
                    field_type.values = enum_values_json.as_deref().and_then(|s| {
                        serde_json::from_str::<Vec<String>>(s)
                            .ok()
                            .filter(|v| !v.is_empty())
                    });
                }
                let default_value = dvj.as_deref().and_then(|s| {
                    serde_json::from_str::<serde_json::Value>(s)
                        .ok()
                        .map(|v| SettingValue::from_json(&v))
                });
                PluginInputDef {
                    entrypoint_id,
                    name,
                    title,
                    type_: field_type,
                    optional: optional != 0,
                    description,
                    default_value,
                }
            },
        )
        .collect();

    let sdef_rows: Vec<(
        String,
        String,
        String,
        Option<String>,
        Option<String>,
        i64,
        Option<String>,
    )> =
        sqlx::query_as(
            "SELECT prs.name, prs.title, prs.type_json, prs.enum_values_json, prs.description, \
                    prs.required, prs.default_value_json \
             FROM Plugin p \
             LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2 \
             INNER JOIN PluginRevisionSettingDef prs ON prs.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id) \
             WHERE p.id = ?1 \
               ORDER BY prs.rowid",
        )
        .bind(plugin_id)
        .bind(project_id)
        .fetch_all(&mut *conn)
        .await?;

    let setting_defs = sdef_rows
        .into_iter()
        .map(
            |(name, title, type_json, enum_values_json, description, required, dvj)| {
                let mut field_type = serde_json::from_str::<PluginFieldTypeDef>(&type_json)
                    .unwrap_or(PluginFieldTypeDef {
                        name: "string".to_string(),
                        values: None,
                    });
                if field_type.values.is_none() {
                    field_type.values = enum_values_json.as_deref().and_then(|s| {
                        serde_json::from_str::<Vec<String>>(s)
                            .ok()
                            .filter(|v| !v.is_empty())
                    });
                }
                let default_value = dvj.as_deref().and_then(|s| {
                    serde_json::from_str::<serde_json::Value>(s)
                        .ok()
                        .map(|v| SettingValue::from_json(&v))
                });
                PluginSettingDef {
                    name,
                    title,
                    type_: field_type,
                    description,
                    required: required != 0,
                    default_value,
                }
            },
        )
        .collect();

    let mdef_rows: Vec<(String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT prm.name, prm.title, prm.type_json, prm.enum_values_json, prm.description \
         FROM Plugin p \
         LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2 \
         INNER JOIN PluginRevisionMetricDef prm ON prm.revision_id = COALESCE(pp.pinned_revision_id, p.current_revision_id) \
         WHERE p.id = ?1 \
           ORDER BY prm.rowid",
    )
    .bind(plugin_id)
    .bind(project_id)
    .fetch_all(&mut *conn)
    .await?;

    let metric_defs = mdef_rows
        .into_iter()
        .map(|(name, title, type_json, enum_values_json, description)| {
            let mut field_type = serde_json::from_str::<PluginFieldTypeDef>(&type_json).unwrap_or(
                PluginFieldTypeDef {
                    name: "string".to_string(),
                    values: None,
                },
            );
            if field_type.values.is_none() {
                field_type.values = enum_values_json.as_deref().and_then(|s| {
                    serde_json::from_str::<Vec<String>>(s)
                        .ok()
                        .filter(|v| !v.is_empty())
                });
            }

            PluginMetricDef {
                name,
                title,
                type_: field_type,
                description,
            }
        })
        .collect();

    let mval_rows: Vec<(String, String, String, Option<String>, String)> = sqlx::query_as(
          "SELECT m.metric_name, d.type_json, m.value_json, d.description, COALESCE(d.title, m.metric_name) \
            FROM PluginMetric m \
            INNER JOIN PluginRevisionMetricDef d \
              ON d.name = m.metric_name \
              AND d.revision_id = ( \
                  SELECT COALESCE(pp2.pinned_revision_id, p2.current_revision_id) \
                  FROM Plugin p2 \
                  LEFT JOIN ProjectPlugin pp2 ON pp2.plugin_id = p2.id AND pp2.project_id = ?2 \
                  WHERE p2.id = ?1 \
              ) \
            WHERE m.plugin_id = ?1 \
            ORDER BY m.metric_name",
    )
    .bind(plugin_id)
    .bind(project_id)
    .fetch_all(&mut *conn)
    .await?;

    let metric_values = mval_rows
        .into_iter()
        .map(|(name, type_json, value_json, description, title)| {
            let type_ = serde_json::from_str::<PluginFieldTypeDef>(&type_json).unwrap_or(
                PluginFieldTypeDef {
                    name: "string".to_string(),
                    values: None,
                },
            );
            let value = serde_json::from_str::<serde_json::Value>(&value_json)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            PluginMetricValue {
                name,
                title,
                type_,
                description,
                value,
            }
        })
        .collect();

    let sv_rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT setting_name, value_json FROM ProjectPluginSettingValue \
         WHERE plugin_id = ?1 AND project_settings_id = ?2",
    )
    .bind(plugin_id)
    .bind(project_settings_id)
    .fetch_all(&mut *conn)
    .await?;

    let setting_values = sv_rows
        .into_iter()
        .map(|(name, vj)| {
            let value = serde_json::from_str::<serde_json::Value>(&vj)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            PluginSettingValue { name, value }
        })
        .collect();

    Ok(PluginRecord {
        id: row.id,
        name: row.name,
        version: row.version,
        enabled: row.enabled != 0,
        manifest,
        entrypoints,
        input_defs,
        setting_defs,
        metric_defs,
        metric_values,
        setting_values,
    })
}
