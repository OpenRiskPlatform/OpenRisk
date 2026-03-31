//! DAO functions for the scan lifecycle.

use super::helpers::{conn_unavailable, load_scan_logs};
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;
use uuid::Uuid;

#[derive(sqlx::FromRow)]
struct ScanSummaryRow {
    id: String,
    status: String,
    preview: Option<String>,
    is_archived: i64,
    sort_order: i64,
}

fn map_scan_summary(row: ScanSummaryRow) -> ScanSummaryRecord {
    ScanSummaryRecord {
        id: row.id,
        status: row.status,
        preview: row.preview,
        is_archived: row.is_archived != 0,
        sort_order: row.sort_order,
    }
}

pub(super) async fn create_scan(
    this: &SqliteProjectPersistence,
    preview: Option<String>,
) -> Result<ScanSummaryRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    let id = Uuid::new_v4().to_string();
    let fallback = format!("New Scan {}", &id[..8]);
    let final_preview = preview
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or(fallback);

    sqlx::query("UPDATE Scan SET sort_order = sort_order + 1 WHERE project_id = ?1")
        .bind(&project_id)
        .execute(&mut *conn)
        .await?;

    sqlx::query(
        "INSERT INTO Scan (id, project_id, status, preview, is_archived, sort_order) \
         VALUES (?1, ?2, ?3, ?4, 0, 0)",
    )
        .bind(&id)
        .bind(&project_id)
        .bind("Draft")
        .bind(&final_preview)
        .execute(&mut *conn)
        .await?;

    Ok(ScanSummaryRecord {
        id,
        status: "Draft".to_string(),
        preview: Some(final_preview),
        is_archived: false,
        sort_order: 0,
    })
}

pub(super) async fn list_scans(
    this: &SqliteProjectPersistence,
) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    let rows = sqlx::query_as::<_, ScanSummaryRow>(
        "SELECT id, status, preview, is_archived, sort_order \
         FROM Scan WHERE project_id = ?1 \
         ORDER BY is_archived ASC, sort_order ASC, rowid DESC",
    )
    .bind(project_id)
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows.into_iter().map(map_scan_summary).collect())
}

pub(super) async fn get_scan(
    this: &SqliteProjectPersistence,
    scan_id: &str,
) -> Result<ScanDetailRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    #[derive(sqlx::FromRow)]
    struct ScanRow {
        id: String,
        status: String,
        preview: Option<String>,
    }

    let scan =
        sqlx::query_as::<_, ScanRow>("SELECT id, status, preview FROM Scan WHERE id = ?1 LIMIT 1")
            .bind(scan_id)
            .fetch_one(&mut *conn)
            .await?;

    let sel_rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT plugin_id, entrypoint_id FROM ScanSelectedPlugin WHERE scan_id = ?1",
    )
    .bind(scan_id)
    .fetch_all(&mut *conn)
    .await?;

    let selected_plugins = sel_rows
        .into_iter()
        .map(|(p, e)| PluginEntrypointSelection {
            plugin_id: p,
            entrypoint_id: e,
        })
        .collect();

    let inp_rows: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT plugin_id, entrypoint_id, field_name, value_json \
         FROM ScanEntrypointInput WHERE scan_id = ?1",
    )
    .bind(scan_id)
    .fetch_all(&mut *conn)
    .await?;

    let inputs = inp_rows
        .into_iter()
        .map(|(p, e, f, vj)| {
            let value = serde_json::from_str::<serde_json::Value>(&vj)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            ScanEntrypointInput {
                plugin_id: p,
                entrypoint_id: e,
                field_name: f,
                value,
            }
        })
        .collect();

    #[derive(sqlx::FromRow)]
    struct ResultRow {
        id: String,
        plugin_id: String,
        entrypoint_id: String,
        ok: i64,
        error: Option<String>,
        data_json: Option<String>,
    }

    let result_rows = sqlx::query_as::<_, ResultRow>(
        "SELECT id, plugin_id, entrypoint_id, ok, error, data_json \
         FROM ScanPluginResult WHERE scan_id = ?1",
    )
    .bind(scan_id)
    .fetch_all(&mut *conn)
    .await?;

    let mut results = Vec::new();
    for row in result_rows {
        let logs = load_scan_logs(conn, &row.id).await?;
        results.push(ScanPluginResultRecord {
            plugin_id: row.plugin_id,
            entrypoint_id: row.entrypoint_id,
            output: PluginOutput {
                ok: row.ok != 0,
                data_json: row.data_json,
                error: row.error,
                logs,
            },
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

pub(super) async fn begin_scan_run(
    this: &SqliteProjectPersistence,
    scan_id: &str,
    selected_plugins: &[PluginEntrypointSelection],
    inputs: &[ScanEntrypointInput],
) -> Result<ScanRunContext, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    #[derive(sqlx::FromRow)]
    struct ScanRow {
        status: String,
        preview: Option<String>,
    }

    let scan =
        sqlx::query_as::<_, ScanRow>("SELECT status, preview FROM Scan WHERE id = ?1 LIMIT 1")
            .bind(scan_id)
            .fetch_one(&mut *conn)
            .await?;

    if scan.status != "Draft" {
        return Err(PersistenceError::Validation(
            "Scan already launched and cannot be rerun".into(),
        ));
    }

    let psid: String = sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    sqlx::query("UPDATE Scan SET status = 'Running' WHERE id = ?1")
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;

    sqlx::query("DELETE FROM ScanSelectedPlugin WHERE scan_id = ?1")
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;
    for sel in selected_plugins {
        sqlx::query(
            "INSERT OR IGNORE INTO ScanSelectedPlugin \
             (scan_id, plugin_id, entrypoint_id) VALUES (?1, ?2, ?3)",
        )
        .bind(scan_id)
        .bind(&sel.plugin_id)
        .bind(&sel.entrypoint_id)
        .execute(&mut *conn)
        .await?;
    }

    sqlx::query("DELETE FROM ScanEntrypointInput WHERE scan_id = ?1")
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;
    for inp in inputs {
        let vj = inp.value.to_json_string();
        sqlx::query(
            "INSERT OR IGNORE INTO ScanEntrypointInput \
             (scan_id, plugin_id, entrypoint_id, field_name, value_json) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(scan_id)
        .bind(&inp.plugin_id)
        .bind(&inp.entrypoint_id)
        .bind(&inp.field_name)
        .bind(&vj)
        .execute(&mut *conn)
        .await?;
    }

    sqlx::query("DELETE FROM ScanPluginResult WHERE scan_id = ?1")
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;

    let mut plugins = Vec::new();
    for sel in selected_plugins {
        let code: Option<String> =
            sqlx::query_scalar("SELECT code FROM Plugin WHERE id = ?1 LIMIT 1")
                .bind(&sel.plugin_id)
                .fetch_optional(&mut *conn)
                .await?
                .flatten()
                .filter(|c: &String| !c.trim().is_empty());

        let ep_fn: Option<String> = sqlx::query_scalar(
            "SELECT function_name FROM PluginEntrypoint \
             WHERE plugin_id = ?1 AND id = ?2 LIMIT 1",
        )
        .bind(&sel.plugin_id)
        .bind(&sel.entrypoint_id)
        .fetch_optional(&mut *conn)
        .await?;

        let entrypoint_function = ep_fn.unwrap_or_else(|| sel.entrypoint_id.clone());

        let sv_rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT setting_name, value_json FROM ProjectPluginSettingValue \
             WHERE plugin_id = ?1 AND project_settings_id = ?2",
        )
        .bind(&sel.plugin_id)
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

        plugins.push(PluginLoadData {
            plugin_id: sel.plugin_id.clone(),
            entrypoint_id: sel.entrypoint_id.clone(),
            entrypoint_function,
            settings,
            code,
        });
    }

    Ok(ScanRunContext {
        scan_preview: scan.preview,
        plugins,
    })
}

pub(super) async fn end_scan_run(
    this: &SqliteProjectPersistence,
    scan_id: &str,
    preview: Option<String>,
    results: Vec<ScanPluginResultRecord>,
) -> Result<ScanSummaryRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    for result in &results {
        let rid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO ScanPluginResult \
             (id, plugin_id, entrypoint_id, scan_id, ok, error, data_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(&rid)
        .bind(&result.plugin_id)
        .bind(&result.entrypoint_id)
        .bind(scan_id)
        .bind(result.output.ok as i64)
        .bind(result.output.error.as_deref())
        .bind(result.output.data_json.as_deref())
        .execute(&mut *conn)
        .await?;

        for log in &result.output.logs {
            let level = match log.level {
                LogLevel::Warn => "warn",
                LogLevel::Error => "error",
                LogLevel::Log => "log",
            };
            sqlx::query(
                "INSERT INTO ScanPluginLog (id, scan_result_id, level, message) \
                 VALUES (?1, ?2, ?3, ?4)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&rid)
            .bind(level)
            .bind(&log.message)
            .execute(&mut *conn)
            .await?;
        }
    }

    sqlx::query(
        "UPDATE Scan SET status = 'Completed', \
         preview = COALESCE(?1, preview) WHERE id = ?2",
    )
    .bind(preview.as_deref())
    .bind(scan_id)
    .execute(&mut *conn)
    .await?;

    let row = sqlx::query_as::<_, ScanSummaryRow>(
        "SELECT id, status, preview, is_archived, sort_order FROM Scan WHERE id = ?1 LIMIT 1",
    )
    .bind(scan_id)
    .fetch_one(&mut *conn)
    .await?;

    Ok(map_scan_summary(row))
}

pub(super) async fn update_scan_preview(
    this: &SqliteProjectPersistence,
    scan_id: &str,
    preview: String,
) -> Result<ScanSummaryRecord, PersistenceError> {
    let next = preview.trim().to_string();
    if next.is_empty() {
        return Err(PersistenceError::Validation(
            "Scan name must not be empty".into(),
        ));
    }

    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    sqlx::query("UPDATE Scan SET preview = ?1 WHERE id = ?2")
        .bind(&next)
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;

    let row = sqlx::query_as::<_, ScanSummaryRow>(
        "SELECT id, status, preview, is_archived, sort_order FROM Scan WHERE id = ?1 LIMIT 1",
    )
    .bind(scan_id)
    .fetch_one(&mut *conn)
    .await?;

    Ok(map_scan_summary(row))
}

pub(super) async fn set_scan_archived(
    this: &SqliteProjectPersistence,
    scan_id: &str,
    archived: bool,
) -> Result<ScanSummaryRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    sqlx::query("UPDATE Scan SET is_archived = ?1 WHERE id = ?2")
        .bind(archived as i64)
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;

    let row = sqlx::query_as::<_, ScanSummaryRow>(
        "SELECT id, status, preview, is_archived, sort_order FROM Scan WHERE id = ?1 LIMIT 1",
    )
    .bind(scan_id)
    .fetch_one(&mut *conn)
    .await?;

    Ok(map_scan_summary(row))
}

pub(super) async fn reorder_scans(
    this: &SqliteProjectPersistence,
    ordered_scan_ids: &[String],
) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
        .fetch_one(&mut *conn)
        .await?;

    let existing_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM Scan WHERE project_id = ?1")
        .bind(&project_id)
        .fetch_all(&mut *conn)
        .await?;

    if existing_ids.len() != ordered_scan_ids.len() {
        return Err(PersistenceError::Validation(
            "Scan reorder payload must include all project scans".into(),
        ));
    }

    for existing_id in &existing_ids {
        if !ordered_scan_ids.iter().any(|id| id == existing_id) {
            return Err(PersistenceError::Validation(
                "Scan reorder payload does not match current project scans".into(),
            ));
        }
    }

    for (index, scan_id) in ordered_scan_ids.iter().enumerate() {
        sqlx::query("UPDATE Scan SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3")
            .bind(index as i64)
            .bind(scan_id)
            .bind(&project_id)
            .execute(&mut *conn)
            .await?;
    }

    let rows = sqlx::query_as::<_, ScanSummaryRow>(
        "SELECT id, status, preview, is_archived, sort_order \
         FROM Scan WHERE project_id = ?1 \
         ORDER BY is_archived ASC, sort_order ASC, rowid DESC",
    )
    .bind(&project_id)
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows.into_iter().map(map_scan_summary).collect())
}
