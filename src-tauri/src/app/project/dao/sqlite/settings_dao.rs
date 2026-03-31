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
    }

    let proj = sqlx::query_as::<_, ProjRow>(
        "SELECT p.id, p.name, p.audit, p.project_settings_id, \
         ps.description, ps.locale, ps.theme \
         FROM Project p \
         INNER JOIN ProjectSettings ps ON ps.id = p.project_settings_id \
         LIMIT 1",
    )
    .fetch_one(&mut *conn)
    .await?;

    let psid = proj.project_settings_id.clone();

    let plugin_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT plugin_id FROM ProjectPlugin WHERE project_id = ?1 AND enabled = 1",
    )
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
        },
        plugins,
    })
}

pub(super) async fn update_project_settings(
    this: &SqliteProjectPersistence,
    name: Option<String>,
    theme: Option<String>,
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

    let normalized = normalize_theme(theme);
    sqlx::query("UPDATE ProjectSettings SET theme = ?1 WHERE id = ?2")
        .bind(&normalized)
        .bind(&psid)
        .execute(&mut *conn)
        .await?;

    #[derive(sqlx::FromRow)]
    struct Row {
        id: String,
        description: Option<String>,
        locale: Option<String>,
        theme: Option<String>,
    }

    let row = sqlx::query_as::<_, Row>(
        "SELECT id, description, locale, theme FROM ProjectSettings WHERE id = ?1",
    )
    .bind(&psid)
    .fetch_one(&mut *conn)
    .await?;

    Ok(ProjectSettingsRecord {
        id: row.id,
        description: row.description.unwrap_or_default(),
        locale: row.locale.unwrap_or_else(|| "en-US".to_string()),
        theme: normalize_theme(row.theme),
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
