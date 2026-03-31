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
         WHERE scan_result_id = ?1 ORDER BY rowid",
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
    project_settings_id: &str,
) -> Result<PluginRecord, PersistenceError> {
    #[derive(sqlx::FromRow)]
    struct PluginRow {
        id: String,
        name: String,
        version: String,
        description: Option<String>,
        license: Option<String>,
        authors_json: Option<String>,
        icon: Option<String>,
        homepage: Option<String>,
    }

    let row = sqlx::query_as::<_, PluginRow>(
        "SELECT id, name, version, description, license, authors_json, icon, homepage \
         FROM Plugin WHERE id = ?1 LIMIT 1",
    )
    .bind(plugin_id)
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
    };

    #[derive(sqlx::FromRow)]
    struct EpRow {
        id: String,
        name: String,
        function_name: String,
        description: Option<String>,
    }

    let ep_rows = sqlx::query_as::<_, EpRow>(
        "SELECT id, name, function_name, description \
         FROM PluginEntrypoint WHERE plugin_id = ?1 ORDER BY rowid",
    )
    .bind(plugin_id)
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
            "SELECT entrypoint_id, name, title, type_json, enum_values_json, optional, description, default_value_json \
             FROM PluginInputDef WHERE plugin_id = ?1 ORDER BY rowid",
        )
        .bind(plugin_id)
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
            "SELECT name, title, type_json, enum_values_json, description, required, default_value_json \
             FROM PluginSettingDef WHERE plugin_id = ?1 ORDER BY rowid",
        )
        .bind(plugin_id)
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
        manifest,
        entrypoints,
        input_defs,
        setting_defs,
        setting_values,
    })
}
