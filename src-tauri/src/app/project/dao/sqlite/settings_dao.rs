//! DAO functions for project settings, plugin records, and plugin setting values.

use super::helpers::{
    conn_unavailable, load_plugin_record, normalize_theme, project_id, project_settings_id,
};
use crate::app::project::plugins::LocalPluginBundle;
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;

async fn ensure_project_plugin_link(
    conn: &mut sqlx::SqliteConnection,
    project_id: &str,
    plugin_id: &str,
) -> Result<(), PersistenceError> {
    sqlx::query!(
        r#"INSERT INTO ProjectPlugin (project_id, plugin_id, pinned_revision_id, enabled)
           VALUES (?1, ?2, (SELECT current_revision_id FROM Plugin WHERE id = ?2), 1)
           ON CONFLICT(project_id, plugin_id) DO UPDATE SET enabled = 1"#,
        project_id,
        plugin_id,
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}

pub(super) async fn load_settings(
    this: &SqliteProjectPersistence,
) -> Result<ProjectSettingsPayload, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let proj = sqlx::query!(
        r#"SELECT p.id as "id!", p.name as "name!", p.audit,
                  p.project_settings_id as "project_settings_id!",
                  ps.description, ps.locale, ps.theme, ps.advanced_mode as "advanced_mode!"
           FROM Project p
           INNER JOIN ProjectSettings ps ON ps.id = p.project_settings_id
           LIMIT 1"#
    )
    .fetch_one(&mut *conn)
    .await?;

    let psid = proj.project_settings_id.clone();

    let plugin_ids = sqlx::query!(
        r#"SELECT plugin_id as "plugin_id!" FROM ProjectPlugin WHERE project_id = ?1"#,
        proj.id
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut plugins = Vec::new();
    for row in &plugin_ids {
        plugins.push(load_plugin_record(conn, &row.plugin_id, &proj.id, &psid).await?);
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
        let trimmed = n.trim().to_string();
        sqlx::query!(r#"UPDATE Project SET name = ?1"#, trimmed)
            .execute(&mut *conn)
            .await?;
    }

    let psid = project_settings_id(&mut *conn).await?;

    let normalized = normalize_theme(theme);
    sqlx::query!(
        r#"UPDATE ProjectSettings SET theme = ?1 WHERE id = ?2"#,
        normalized,
        psid
    )
    .execute(&mut *conn)
    .await?;

    if let Some(am) = advanced_mode {
        let advanced_mode_i64 = am as i64;
        sqlx::query!(
            r#"UPDATE ProjectSettings SET advanced_mode = ?1 WHERE id = ?2"#,
            advanced_mode_i64,
            psid
        )
        .execute(&mut *conn)
        .await?;
    }

    let row = sqlx::query!(
        r#"SELECT id as "id!", description, locale, theme,
                advanced_mode as "advanced_mode!"
            FROM ProjectSettings WHERE id = ?1"#,
        psid,
    )
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

    let psid = project_settings_id(&mut *conn).await?;
    let project_id = project_id(&mut *conn).await?;

    ensure_project_plugin_link(&mut *conn, &project_id, plugin_id).await?;

    let value_json = value.to_json_string();
    sqlx::query!(
        r#"INSERT INTO ProjectPluginSettingValue
           (plugin_id, project_settings_id, setting_name, value_json)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(plugin_id, project_settings_id, setting_name)
           DO UPDATE SET value_json = excluded.value_json"#,
        plugin_id,
        psid,
        setting_name,
        value_json,
    )
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

    let psid = project_settings_id(&mut *conn).await?;

    let rows = sqlx::query!(
        r#"SELECT setting_name as "setting_name!", value_json as "value_json!"
           FROM ProjectPluginSettingValue
           WHERE plugin_id = ?1 AND project_settings_id = ?2"#,
        plugin_id,
        psid,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let value = serde_json::from_str::<serde_json::Value>(&row.value_json)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            PluginSettingValue {
                name: row.setting_name,
                value,
            }
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

    let psid = project_settings_id(&mut *conn).await?;
    let project_id = project_id(&mut *conn).await?;

    ensure_project_plugin_link(&mut *conn, &project_id, plugin_id).await?;

    for sv in values {
        let vj = sv.value.to_json_string();
        sqlx::query!(
            r#"INSERT INTO ProjectPluginSettingValue
               (plugin_id, project_settings_id, setting_name, value_json)
               VALUES (?1, ?2, ?3, ?4)
               ON CONFLICT(plugin_id, project_settings_id, setting_name)
               DO UPDATE SET value_json = excluded.value_json"#,
            plugin_id,
            psid,
            sv.name,
            vj,
        )
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

    let psid = project_settings_id(&mut *conn).await?;
    let project_id = project_id(&mut *conn).await?;

    load_plugin_record(conn, plugin_id, &project_id, &psid).await
}

pub(super) async fn get_plugin_load_data_for_metrics(
    this: &SqliteProjectPersistence,
    plugin_id: &str,
) -> Result<PluginLoadData, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let psid = project_settings_id(&mut *conn).await?;
    let project_id = project_id(&mut *conn).await?;

    let revision_row = sqlx::query!(
        r#"SELECT COALESCE(pp.pinned_revision_id, p.current_revision_id) as "revision_id!: String"
           FROM Plugin p
           LEFT JOIN ProjectPlugin pp ON pp.plugin_id = p.id AND pp.project_id = ?2
           WHERE p.id = ?1
           LIMIT 1"#,
        plugin_id,
        project_id,
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| {
        PersistenceError::Validation(format!("Plugin '{}' has no active revision", plugin_id))
    })?;
    let revision_id = revision_row.revision_id;

    let revision_id_for_code = revision_id.clone();
    let code = sqlx::query_scalar!(
        r#"SELECT code FROM PluginRevision WHERE id = ?1 LIMIT 1"#,
        revision_id_for_code,
    )
    .fetch_optional(&mut *conn)
    .await?
    .flatten();

    let revision_id_for_update_metrics = revision_id.clone();
    let update_metrics_fn = sqlx::query_scalar!(
        r#"SELECT update_metrics_fn FROM PluginRevision WHERE id = ?1 LIMIT 1"#,
        revision_id_for_update_metrics,
    )
    .fetch_optional(&mut *conn)
    .await?
    .flatten();

    let sv_rows = sqlx::query!(
        r#"SELECT setting_name as "setting_name!", value_json as "value_json!"
           FROM ProjectPluginSettingValue
           WHERE plugin_id = ?1 AND project_settings_id = ?2"#,
        plugin_id,
        psid,
    )
    .fetch_all(&mut *conn)
    .await?;

    let settings = sv_rows
        .into_iter()
        .map(|row| {
            let value = serde_json::from_str::<serde_json::Value>(&row.value_json)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            PluginSettingValue {
                name: row.setting_name,
                value,
            }
        })
        .collect();

    let revision_id_for_metric_defs = revision_id.clone();
    let metric_rows = sqlx::query!(
        r#"SELECT name as "name!", title as "title!",
                type_json as "type_json!", enum_values_json, description
            FROM PluginRevisionMetricDef WHERE revision_id = ?1 ORDER BY rowid"#,
        revision_id_for_metric_defs,
    )
    .fetch_all(&mut *conn)
    .await?;

    let metric_defs = metric_rows
        .into_iter()
        .map(|row| {
            let mut field_type = serde_json::from_str::<PluginFieldTypeDef>(&row.type_json)
                .unwrap_or(PluginFieldTypeDef {
                    name: "string".to_string(),
                    values: None,
                });
            if field_type.values.is_none() {
                field_type.values = row.enum_values_json.as_deref().and_then(|s| {
                    serde_json::from_str::<Vec<String>>(s)
                        .ok()
                        .filter(|v| !v.is_empty())
                });
            }
            PluginMetricDef {
                name: row.name,
                title: row.title,
                type_: field_type,
                description: row.description,
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
        let value_json = metric.value.to_json_string();
        sqlx::query!(
            r#"INSERT INTO PluginMetric (plugin_id, metric_name, value_json)
               VALUES (?1, ?2, ?3)
               ON CONFLICT(plugin_id, metric_name) DO UPDATE SET value_json = excluded.value_json"#,
            plugin_id,
            metric.name,
            value_json,
        )
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

    let psid = project_settings_id(&mut *conn).await?;
    let project_id = project_id(&mut *conn).await?;

    let enabled_i64 = if enabled { 1i64 } else { 0i64 };
    let updated = sqlx::query!(
        r#"UPDATE ProjectPlugin SET enabled = ?1 WHERE project_id = ?2 AND plugin_id = ?3"#,
        enabled_i64,
        project_id,
        plugin_id,
    )
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
