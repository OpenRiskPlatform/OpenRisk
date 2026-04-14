//! DAO functions for project settings, plugin records, and plugin setting values.

use super::helpers::{conn_unavailable, load_plugin_record, normalize_theme};
use crate::app::project::plugins::LocalPluginBundle;
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;

pub(super) async fn load_settings(
    this: &SqliteProjectPersistence,
) -> Result<ProjectSettingsPayload, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    #[derive(sqlx::FromRow)]
    struct ProjRow {
        id: String,
        name: String,
        audit: Option<String>,
        project_settings_id: String,
        description: Option<String>,
        locale: Option<String>,
        theme: Option<String>,
        advanced_mode: i64,
    }

    let proj = sqlx::query_as::<_, ProjRow>(
        "SELECT p.id, p.name, p.audit, p.project_settings_id, \
         ps.description, ps.locale, ps.theme, ps.advanced_mode \
         FROM Project p \
         INNER JOIN ProjectSettings ps ON ps.id = p.project_settings_id \
         LIMIT 1",
    )
    .fetch_one(&mut *conn)
    .await?;

    let psid = proj.project_settings_id.clone();

    let plugin_ids: Vec<(String,)> =
        sqlx::query_as("SELECT plugin_id FROM ProjectPlugin WHERE project_id = ?1")
            .bind(&proj.id)
            .fetch_all(&mut *conn)
            .await?;

    let mut plugins = Vec::new();
    for (pid,) in &plugin_ids {
        plugins.push(load_plugin_record(conn, pid, &proj.id, &psid).await?);
    }

    Ok(ProjectSettingsPayload {
        project: ProjectSummary {
            id: proj.id,
            name: proj.name,
            audit: proj.audit,
            directory: this.db_path.clone(),
        },
        project_settings: ProjectSettingsRecord {
            id: psid,
            description: proj.description.unwrap_or_default(),
            locale: proj.locale.unwrap_or_else(|| "en-US".to_string()),
            theme: normalize_theme(proj.theme),
            advanced_mode: proj.advanced_mode != 0,
        },
        plugins,
    })
}

pub(super) async fn update_project_settings(
    this: &SqliteProjectPersistence,
    name: Option<String>,
    theme: Option<String>,
    advanced_mode: Option<bool>,
) -> Result<ProjectSettingsRecord, PersistenceError> {
    if matches!(&name, Some(n) if n.trim().is_empty()) {
        return Err(PersistenceError::Validation(
            "Project name must not be empty".into(),
        ));
    }

    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    if let Some(ref n) = name {
        sqlx::query("UPDATE Project SET name = ?1")
            .bind(n.trim())
            .execute(&mut *conn)
            .await?;
    }

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    if let Some(theme) = theme {
        let normalized = normalize_theme(Some(theme));
        sqlx::query("UPDATE ProjectSettings SET theme = ?1 WHERE id = ?2")
            .bind(&normalized)
            .bind(&psid)
            .execute(&mut *conn)
            .await?;
    }

    if let Some(am) = advanced_mode {
        sqlx::query("UPDATE ProjectSettings SET advanced_mode = ?1 WHERE id = ?2")
            .bind(am as i64)
            .bind(&psid)
            .execute(&mut *conn)
            .await?;
    }

    #[derive(sqlx::FromRow)]
    struct Row {
        id: String,
        description: Option<String>,
        locale: Option<String>,
        theme: Option<String>,
        advanced_mode: i64,
    }

    let row = sqlx::query_as::<_, Row>(
        "SELECT id, description, locale, theme, advanced_mode FROM ProjectSettings WHERE id = ?1",
    )
    .bind(&psid)
    .fetch_one(&mut *conn)
    .await?;

    Ok(ProjectSettingsRecord {
        id: row.id,
        description: row.description.unwrap_or_default(),
        locale: row.locale.unwrap_or_else(|| "en-US".to_string()),
        theme: normalize_theme(row.theme),
        advanced_mode: row.advanced_mode != 0,
    })
}

pub(super) async fn set_plugin_setting(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
    setting_name: &str,
    value: SettingValue,
) -> Result<PluginRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;
    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    sqlx::query(
        "INSERT INTO ProjectPlugin (project_id, plugin_id, pinned_revision_id, enabled) \
         VALUES (?1, ?2, (SELECT current_revision_id FROM Plugin WHERE id = ?2), 1) \
         ON CONFLICT(project_id, plugin_id) DO UPDATE SET enabled = 1",
    )
    .bind(&project_id)
    .bind(plugin_id)
    .execute(&mut *conn)
    .await?;

    let value_json = value.to_json_string();
    sqlx::query(
        "INSERT INTO ProjectPluginSettingValue \
         (plugin_id, project_settings_id, setting_name, value_json) \
         VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(plugin_id, project_settings_id, setting_name) \
         DO UPDATE SET value_json = excluded.value_json",
    )
    .bind(plugin_id)
    .bind(&psid)
    .bind(setting_name)
    .bind(&value_json)
    .execute(&mut *conn)
    .await?;

    load_plugin_record(conn, plugin_id, &project_id, &psid).await
}

pub(super) async fn save_plugin(
    this: &SqliteProjectPersistence,
    bundle: &LocalPluginBundle,
) -> Result<(), PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;
    SqliteProjectPersistence::insert_plugin(conn, bundle).await
}

pub(super) async fn get_plugin_setting_values(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
) -> Result<Vec<PluginSettingValue>, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT setting_name, value_json FROM ProjectPluginSettingValue \
         WHERE plugin_id = ?1 AND project_settings_id = ?2",
    )
    .bind(plugin_id)
    .bind(&psid)
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(name, vj)| {
            let value = serde_json::from_str::<serde_json::Value>(&vj)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            PluginSettingValue { name, value }
        })
        .collect())
}

pub(super) async fn save_plugin_setting_values(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
    values: &[PluginSettingValue],
) -> Result<(), PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;
    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    sqlx::query(
        "INSERT INTO ProjectPlugin (project_id, plugin_id, pinned_revision_id, enabled) \
         VALUES (?1, ?2, (SELECT current_revision_id FROM Plugin WHERE id = ?2), 1) \
         ON CONFLICT(project_id, plugin_id) DO UPDATE SET enabled = 1",
    )
    .bind(&project_id)
    .bind(plugin_id)
    .execute(&mut *conn)
    .await?;

    for sv in values {
        let vj = sv.value.to_json_string();
        sqlx::query(
            "INSERT INTO ProjectPluginSettingValue \
             (plugin_id, project_settings_id, setting_name, value_json) \
             VALUES (?1, ?2, ?3, ?4) \
             ON CONFLICT(plugin_id, project_settings_id, setting_name) \
             DO UPDATE SET value_json = excluded.value_json",
        )
        .bind(plugin_id)
        .bind(&psid)
        .bind(&sv.name)
        .bind(&vj)
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

pub(super) async fn get_plugin_record(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
) -> Result<PluginRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;
    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    load_plugin_record(conn, plugin_id, &project_id, &psid).await
}

pub(super) async fn get_plugin_load_data_for_metrics(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
) -> Result<PluginLoadData, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;
    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    let revision_id: String = sqlx::query_scalar(
        "SELECT COALESCE(pp.pinned_revision_id, p.current_revision_id) \
         FROM Plugin p \
         LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2 \
         WHERE p.id = ?1 \
         LIMIT 1",
    )
    .bind(plugin_id)
    .bind(&project_id)
    .fetch_optional(&mut *conn)
    .await?
    .flatten()
    .ok_or_else(|| PersistenceError::Validation(format!("Plugin '{}' has no active revision", plugin_id)))?;

    let code: Option<String> =
        sqlx::query_scalar("SELECT code FROM PluginRevision WHERE id = ?1 LIMIT 1")
            .bind(&revision_id)
            .fetch_optional(&mut *conn)
            .await?
            .flatten();

    let update_metrics_fn: Option<String> =
        sqlx::query_scalar("SELECT update_metrics_fn FROM PluginRevision WHERE id = ?1 LIMIT 1")
            .bind(&revision_id)
            .fetch_optional(&mut *conn)
            .await?
            .flatten();

    let sv_rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT setting_name, value_json FROM ProjectPluginSettingValue \
         WHERE plugin_id = ?1 AND project_settings_id = ?2",
    )
    .bind(plugin_id)
    .bind(&psid)
    .fetch_all(&mut *conn)
    .await?;

    let settings = sv_rows
        .into_iter()
        .map(|(name, vj)| {
            let value = serde_json::from_str::<serde_json::Value>(&vj)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            PluginSettingValue { name, value }
        })
        .collect();

    let metric_rows: Vec<(String, String, String, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT name, title, type_json, enum_values_json, description \
             FROM PluginRevisionMetricDef WHERE revision_id = ?1 ORDER BY rowid",
        )
        .bind(&revision_id)
        .fetch_all(&mut *conn)
        .await?;

    let metric_defs = metric_rows
        .into_iter()
        .map(|(name, title, type_json, enum_values_json, description)| {
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
            PluginMetricDef {
                name,
                title,
                type_: field_type,
                description,
            }
        })
        .collect();

    Ok(PluginLoadData {
        plugin_id: plugin_id.to_string(),
        plugin_revision_id: revision_id,
        // Not used for metrics refresh path.
        entrypoint_id: "update_metrics".to_string(),
        entrypoint_function: "update_metrics".to_string(),
        metric_defs,
        settings,
        code,
        update_metrics_fn,
    })
}

pub(super) async fn upsert_plugin_metrics(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
    metrics: &[PluginMetricValue],
) -> Result<(), PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    for metric in metrics {
        sqlx::query(
            "INSERT INTO PluginMetric (plugin_id, metric_name, value_json) \
             VALUES (?1, ?2, ?3) \
             ON CONFLICT(plugin_id, metric_name) DO UPDATE SET value_json = excluded.value_json",
        )
        .bind(plugin_id)
        .bind(&metric.name)
        .bind(metric.value.to_json_string())
        .execute(&mut *conn)
        .await?;
    }

    Ok(())
}

pub(super) async fn set_plugin_enabled(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
    enabled: bool,
) -> Result<PluginRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;
    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    let updated = sqlx::query(
        "UPDATE ProjectPlugin SET enabled = ?1 WHERE project_id = ?2 AND plugin_id = ?3",
    )
    .bind(if enabled { 1i64 } else { 0i64 })
    .bind(&project_id)
    .bind(plugin_id)
    .execute(&mut *conn)
    .await?;

    if updated.rows_affected() == 0 {
        return Err(PersistenceError::Validation(format!(
            "Plugin '{}' is not registered in this project",
            plugin_id
        )));
    }

    load_plugin_record(conn, plugin_id, &project_id, &psid).await
}
