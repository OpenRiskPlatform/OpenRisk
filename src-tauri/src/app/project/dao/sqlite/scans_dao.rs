//! DAO functions for the scan lifecycle.

use super::helpers::{conn_unavailable, load_scan_logs, project_id, project_settings_id};
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;
use sqlx::SqliteConnection;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;
use serde_json::Value;

async fn load_scan_result_count(
    conn: &mut sqlx::SqliteConnection,
    scan_id: &str,
) -> Result<i64, PersistenceError> {
    let payloads = sqlx::query_scalar!(
        r#"SELECT data_json as "data_json?: String" FROM ScanPluginResult WHERE scan_id = ?1 AND ok = 1"#,
        scan_id
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut unique_entities = HashSet::new();
    for data_json in payloads.into_iter().flatten() {
        let parsed = match serde_json::from_str::<Value>(&data_json) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let Some(items) = parsed.as_array() else {
            continue;
        };

        for item in items {
            let Some(entity_type) = item.get("$entity").and_then(Value::as_str) else {
                continue;
            };
            let Some(id) = item.get("id").and_then(Value::as_str) else {
                continue;
            };
            unique_entities.insert(format!("{}:{}", entity_type, id));
        }
    }

    Ok(unique_entities.len() as i64)
}

struct ScanSummaryRow {
    id: String,
    status: String,
    preview: Option<String>,
    created_at: String,
    plugin_name: Option<String>,
    is_archived: i64,
    sort_order: i64,
}

fn map_scan_summary(row: ScanSummaryRow, result_count: i64) -> ScanSummaryRecord {
    ScanSummaryRecord {
        id: row.id,
        status: row.status,
        preview: row.preview,
        created_at: row.created_at,
        plugin_name: row.plugin_name,
        result_count,
        is_archived: row.is_archived != 0,
        sort_order: row.sort_order,
    }
}

async fn fetch_scan_summary_by_id(
    conn: &mut SqliteConnection,
    scan_id: &str,
) -> Result<ScanSummaryRecord, PersistenceError> {
    let row = sqlx::query!(
        r#"SELECT id as "id!", status as "status!", preview,
                  COALESCE(created_at, CURRENT_TIMESTAMP) as "created_at!: String",
                  (SELECT pr.name 
                   FROM ScanSelectedPlugin ssp 
                   JOIN PluginRevision pr ON pr.id = ssp.plugin_revision_id 
                   WHERE ssp.scan_id = Scan.id 
                   ORDER BY ssp.rowid ASC 
                   LIMIT 1) AS "plugin_name?: String",
                  is_archived as "is_archived!", sort_order as "sort_order!"
           FROM Scan WHERE id = ?1 LIMIT 1"#,
        scan_id,
    )
    .fetch_one(&mut *conn)
    .await?;

    let result_count = load_scan_result_count(conn, scan_id).await?;

    Ok(map_scan_summary(
        ScanSummaryRow {
            id: row.id,
            status: row.status,
            preview: row.preview,
            created_at: row.created_at,
            plugin_name: row.plugin_name,
            is_archived: row.is_archived,
            sort_order: row.sort_order,
        },
        result_count,
    ))
}

async fn list_scan_summaries_by_project(
    conn: &mut SqliteConnection,
    project_id: &str,
) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
    let rows = sqlx::query!(
        r#"SELECT id as "id!", status as "status!", preview,
                  COALESCE(created_at, CURRENT_TIMESTAMP) as "created_at!: String",
                  (SELECT pr.name 
                   FROM ScanSelectedPlugin ssp 
                   JOIN PluginRevision pr ON pr.id = ssp.plugin_revision_id 
                   WHERE ssp.scan_id = Scan.id 
                   ORDER BY ssp.rowid ASC 
                   LIMIT 1) AS "plugin_name?: String",
                  is_archived as "is_archived!", sort_order as "sort_order!"
           FROM Scan WHERE project_id = ?1
           ORDER BY is_archived ASC, sort_order ASC, rowid DESC"#,
        project_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut summaries = Vec::new();
    for row in rows {
        let result_count = load_scan_result_count(conn, &row.id).await?;
        summaries.push(map_scan_summary(
            ScanSummaryRow {
                id: row.id.clone(),
                status: row.status,
                preview: row.preview,
                created_at: row.created_at,
                plugin_name: row.plugin_name,
                is_archived: row.is_archived,
                sort_order: row.sort_order,
            },
            result_count,
        ));
    }

    Ok(summaries)
}

async fn load_scan_preview_if_draft(
    conn: &mut SqliteConnection,
    scan_id: &str,
) -> Result<Option<String>, PersistenceError> {
    let row = sqlx::query!(
        r#"SELECT status as "status!", preview FROM Scan WHERE id = ?1 LIMIT 1"#,
        scan_id,
    )
    .fetch_one(&mut *conn)
    .await?;

    if row.status != "Draft" {
        return Err(PersistenceError::Validation(
            "Scan already launched and cannot be rerun".into(),
        ));
    }

    Ok(row.preview)
}

async fn prepare_scan_for_run(
    conn: &mut SqliteConnection,
    scan_id: &str,
) -> Result<(), PersistenceError> {
    sqlx::query!(
        r#"UPDATE Scan SET status = 'Running' WHERE id = ?1"#,
        scan_id
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query!(
        r#"DELETE FROM ScanSelectedPlugin WHERE scan_id = ?1"#,
        scan_id
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query!(
        "DELETE FROM ScanEntrypointInput WHERE scan_id = ?1",
        scan_id
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query!(
        r#"DELETE FROM ScanPluginResult WHERE scan_id = ?1"#,
        scan_id
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}

async fn resolve_plugin_revision_id(
    conn: &mut SqliteConnection,
    project_id: &str,
    plugin_id: &str,
) -> Result<String, PersistenceError> {
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
    .await?;

    revision_row.map(|r| r.revision_id).ok_or_else(|| {
        PersistenceError::Validation(format!("Plugin '{}' has no active revision", plugin_id))
    })
}

async fn persist_selected_plugins(
    conn: &mut SqliteConnection,
    scan_id: &str,
    project_id: &str,
    selected_plugins: &[PluginEntrypointSelection],
) -> Result<HashMap<(String, String), String>, PersistenceError> {
    let mut selected_revision_map: HashMap<(String, String), String> = HashMap::new();

    for sel in selected_plugins {
        let revision_id = resolve_plugin_revision_id(conn, project_id, &sel.plugin_id).await?;
        let revision_id_for_selected = revision_id.clone();

        sqlx::query!(
            "INSERT OR IGNORE INTO ScanSelectedPlugin \
             (scan_id, plugin_id, plugin_revision_id, entrypoint_id) VALUES (?1, ?2, ?3, ?4)",
            scan_id,
            sel.plugin_id,
            revision_id_for_selected,
            sel.entrypoint_id,
        )
        .execute(&mut *conn)
        .await?;

        selected_revision_map.insert(
            (sel.plugin_id.clone(), sel.entrypoint_id.clone()),
            revision_id,
        );
    }

    Ok(selected_revision_map)
}

async fn persist_scan_inputs(
    conn: &mut SqliteConnection,
    scan_id: &str,
    inputs: &[ScanEntrypointInput],
    selected_revision_map: &HashMap<(String, String), String>,
) -> Result<(), PersistenceError> {
    for inp in inputs {
        let value_json = inp.value.to_json_string();
        let revision_id = selected_revision_map
            .get(&(inp.plugin_id.clone(), inp.entrypoint_id.clone()))
            .cloned()
            .ok_or_else(|| {
                PersistenceError::Validation(format!(
                    "Input references unselected plugin entrypoint '{}::{}'",
                    inp.plugin_id, inp.entrypoint_id
                ))
            })?;

        sqlx::query!(
            "INSERT OR IGNORE INTO ScanEntrypointInput \
             (scan_id, plugin_id, plugin_revision_id, entrypoint_id, field_name, value_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            scan_id,
            inp.plugin_id,
            revision_id,
            inp.entrypoint_id,
            inp.field_name,
            value_json,
        )
        .execute(&mut *conn)
        .await?;
    }

    Ok(())
}

async fn load_plugin_run_data(
    conn: &mut SqliteConnection,
    psid: &str,
    sel: &PluginEntrypointSelection,
    revision_id: String,
) -> Result<PluginLoadData, PersistenceError> {
    let revision_id_for_code = revision_id.clone();
    let code = sqlx::query_scalar!(
        r#"SELECT code FROM PluginRevision WHERE id = ?1 LIMIT 1"#,
        revision_id_for_code,
    )
    .fetch_optional(&mut *conn)
    .await?
    .flatten()
    .filter(|c: &String| !c.trim().is_empty());

    let revision_id_for_metrics_fn = revision_id.clone();
    let update_metrics_fn = sqlx::query_scalar!(
        "SELECT update_metrics_fn FROM PluginRevision WHERE id = ?1 LIMIT 1",
        revision_id_for_metrics_fn,
    )
    .fetch_optional(&mut *conn)
    .await?
    .flatten();

    let revision_id_for_entrypoint = revision_id.clone();
    let ep_fn = sqlx::query_scalar!(
        r#"SELECT function_name as "function_name!" FROM PluginRevisionEntrypoint
           WHERE revision_id = ?1 AND id = ?2 LIMIT 1"#,
        revision_id_for_entrypoint,
        sel.entrypoint_id,
    )
    .fetch_optional(&mut *conn)
    .await?;

    let entrypoint_function = ep_fn.unwrap_or_else(|| sel.entrypoint_id.clone());

    let sv_rows = sqlx::query!(
        r#"SELECT setting_name as "setting_name!", value_json as "value_json!"
           FROM ProjectPluginSettingValue
           WHERE plugin_id = ?1 AND project_settings_id = ?2"#,
        sel.plugin_id,
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
             type_json as "type_json!", description
         FROM PluginRevisionMetricDef WHERE revision_id = ?1 ORDER BY rowid"#,
        revision_id_for_metric_defs,
    )
    .fetch_all(&mut *conn)
    .await?;

    let metric_defs = metric_rows
        .into_iter()
        .map(|row| PluginMetricDef {
            name: row.name,
            title: row.title,
            type_: serde_json::from_str::<PluginFieldTypeDef>(&row.type_json).unwrap_or(
                PluginFieldTypeDef {
                    name: "string".to_string(),
                    values: None,
                },
            ),
            description: row.description,
        })
        .collect();

    Ok(PluginLoadData {
        plugin_id: sel.plugin_id.clone(),
        plugin_revision_id: revision_id,
        entrypoint_id: sel.entrypoint_id.clone(),
        entrypoint_function,
        metric_defs,
        settings,
        code,
        update_metrics_fn,
    })
}

async fn persist_scan_results(
    conn: &mut SqliteConnection,
    scan_id: &str,
    results: &[ScanPluginResultRecord],
) -> Result<(), PersistenceError> {
    for result in results {
        let plugin_revision_id = result.plugin_revision_id.clone().ok_or_else(|| {
            PersistenceError::Validation(format!(
                "Plugin result '{}::{}' is missing plugin revision id",
                result.plugin_id, result.entrypoint_id
            ))
        })?;

        let result_id = Uuid::new_v4().to_string();
        let ok_i64 = result.output.ok as i64;
        let error = result.output.error.as_deref();
        let data_json = result.output.data_json.as_deref();

        sqlx::query!(
            "INSERT INTO ScanPluginResult \
               (id, plugin_id, plugin_revision_id, entrypoint_id, scan_id, ok, error, data_json) \
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            result_id,
            result.plugin_id,
            plugin_revision_id,
            result.entrypoint_id,
            scan_id,
            ok_i64,
            error,
            data_json,
        )
        .execute(&mut *conn)
        .await?;

        for log in &result.output.logs {
            let level = match log.level {
                LogLevel::Warn => "warn",
                LogLevel::Error => "error",
                LogLevel::Log => "log",
            };
            let log_id = Uuid::new_v4().to_string();

            sqlx::query!(
                "INSERT INTO ScanPluginLog (id, scan_result_id, level, message) \
                 VALUES (?1, ?2, ?3, ?4)",
                log_id,
                result_id,
                level,
                log.message,
            )
            .execute(&mut *conn)
            .await?;
        }
    }

    Ok(())
}

async fn complete_scan(
    conn: &mut SqliteConnection,
    scan_id: &str,
    preview: Option<&str>,
) -> Result<(), PersistenceError> {
    sqlx::query!(
        "UPDATE Scan SET status = 'Completed', \
         preview = COALESCE(?1, preview) WHERE id = ?2",
        preview,
        scan_id,
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}

async fn upsert_scan_metrics(
    conn: &mut SqliteConnection,
    results: &[ScanPluginResultRecord],
) -> Result<(), PersistenceError> {
    for result in results {
        for metric in &result.metrics {
            let metric_value_json = metric.value.to_json_string();
            sqlx::query!(
                "INSERT INTO PluginMetric (plugin_id, metric_name, value_json) \
                 VALUES (?1, ?2, ?3) \
                 ON CONFLICT(plugin_id, metric_name) DO UPDATE SET value_json = excluded.value_json",
                result.plugin_id,
                metric.name,
                metric_value_json,
            )
            .execute(&mut *conn)
            .await?;
        }
    }

    Ok(())
}

pub(super) async fn create_scan(
    this: &SqliteProjectPersistence,
    preview: Option<String>,
) -> Result<ScanSummaryRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let project_id = project_id(&mut *conn).await?;

    let id = Uuid::new_v4().to_string();
    let fallback = format!("New Scan {}", &id[..8]);
    let final_preview = preview
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or(fallback);

    sqlx::query!(
        r#"UPDATE Scan SET sort_order = sort_order + 1 WHERE project_id = ?1"#,
        project_id
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query!(
        r#"INSERT INTO Scan (id, project_id, status, preview, created_at, is_archived, sort_order)
              VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP, 0, 0)"#,
        id,
        project_id,
        "Draft",
        final_preview,
    )
    .execute(&mut *conn)
    .await?;

    let created_at = sqlx::query_scalar!(
        r#"SELECT COALESCE(created_at, CURRENT_TIMESTAMP) as "created_at!: String" FROM Scan WHERE id = ?1 LIMIT 1"#,
        id,
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(ScanSummaryRecord {
        id,
        status: "Draft".to_string(),
        preview: Some(final_preview),
        created_at,
        plugin_name: None,
        result_count: 0,
        is_archived: false,
        sort_order: 0,
    })
}

pub(super) async fn list_scans(
    this: &SqliteProjectPersistence,
) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let project_id = project_id(&mut *conn).await?;
    list_scan_summaries_by_project(&mut *conn, &project_id).await
}

pub(super) async fn get_scan(
    this: &SqliteProjectPersistence,
    scan_id: &str,
) -> Result<ScanDetailRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let scan = fetch_scan_summary_by_id(&mut *conn, scan_id).await?;

    let sel_rows = sqlx::query!(
        r#"SELECT plugin_id as "plugin_id!", entrypoint_id as "entrypoint_id!"
           FROM ScanSelectedPlugin WHERE scan_id = ?1"#,
        scan_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    let selected_plugins = sel_rows
        .into_iter()
        .map(|row| PluginEntrypointSelection {
            plugin_id: row.plugin_id,
            entrypoint_id: row.entrypoint_id,
        })
        .collect();

    let inp_rows = sqlx::query!(
        r#"SELECT plugin_id as "plugin_id!", entrypoint_id as "entrypoint_id!",
                  field_name as "field_name!", value_json as "value_json!"
           FROM ScanEntrypointInput WHERE scan_id = ?1"#,
        scan_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    let inputs = inp_rows
        .into_iter()
        .map(|row| {
            let value = serde_json::from_str::<serde_json::Value>(&row.value_json)
                .map(|v| SettingValue::from_json(&v))
                .unwrap_or(SettingValue::Null);
            ScanEntrypointInput {
                plugin_id: row.plugin_id,
                entrypoint_id: row.entrypoint_id,
                field_name: row.field_name,
                value,
            }
        })
        .collect();

    #[derive(sqlx::FromRow)]
    struct ResultRow {
        id: String,
        plugin_id: String,
        plugin_revision_id: Option<String>,
        entrypoint_id: String,
        ok: i64,
        error: Option<String>,
        data_json: Option<String>,
    }

    let result_rows = sqlx::query!(
        r#"SELECT id as "id!", plugin_id as "plugin_id!",
                  plugin_revision_id, entrypoint_id as "entrypoint_id!",
                  ok as "ok!", error, data_json
           FROM ScanPluginResult WHERE scan_id = ?1"#,
        scan_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut results = Vec::new();
    for row in result_rows.into_iter().map(|r| ResultRow {
        id: r.id,
        plugin_id: r.plugin_id,
        plugin_revision_id: Some(r.plugin_revision_id),
        entrypoint_id: r.entrypoint_id,
        ok: r.ok,
        error: r.error,
        data_json: r.data_json,
    }) {
        let logs = load_scan_logs(conn, &row.id).await?;
        results.push(ScanPluginResultRecord {
            plugin_id: row.plugin_id,
            plugin_revision_id: row.plugin_revision_id,
            entrypoint_id: row.entrypoint_id,
            output: PluginOutput {
                ok: row.ok != 0,
                data_json: row.data_json,
                error: row.error,
                logs,
            },
            metrics: vec![],
        });
    }

    Ok(ScanDetailRecord {
        id: scan.id,
        status: scan.status,
        preview: scan.preview,
        created_at: scan.created_at,
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
    let scan_preview = load_scan_preview_if_draft(&mut *conn, scan_id).await?;

    let psid = project_settings_id(&mut *conn).await?;
    let project_id = project_id(&mut *conn).await?;
    prepare_scan_for_run(&mut *conn, scan_id).await?;

    let selected_revision_map =
        persist_selected_plugins(&mut *conn, scan_id, &project_id, selected_plugins).await?;
    persist_scan_inputs(&mut *conn, scan_id, inputs, &selected_revision_map).await?;

    let mut plugins = Vec::new();
    for sel in selected_plugins {
        let revision_id = selected_revision_map
            .get(&(sel.plugin_id.clone(), sel.entrypoint_id.clone()))
            .cloned()
            .ok_or_else(|| {
                PersistenceError::Validation(format!(
                    "Plugin '{}' is missing selected revision",
                    sel.plugin_id
                ))
            })?;

        plugins.push(load_plugin_run_data(&mut *conn, &psid, sel, revision_id).await?);
    }

    Ok(ScanRunContext {
        scan_preview,
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

    persist_scan_results(&mut *conn, scan_id, &results).await?;
    complete_scan(&mut *conn, scan_id, preview.as_deref()).await?;
    upsert_scan_metrics(&mut *conn, &results).await?;

    fetch_scan_summary_by_id(&mut *conn, scan_id).await
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

    sqlx::query!(
        r#"UPDATE Scan SET preview = ?1 WHERE id = ?2"#,
        next,
        scan_id
    )
    .execute(&mut *conn)
    .await?;

    fetch_scan_summary_by_id(&mut *conn, scan_id).await
}

pub(super) async fn set_scan_archived(
    this: &SqliteProjectPersistence,
    scan_id: &str,
    archived: bool,
) -> Result<ScanSummaryRecord, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let archived_i64 = archived as i64;
    sqlx::query!(
        "UPDATE Scan SET is_archived = ?1 WHERE id = ?2",
        archived_i64,
        scan_id
    )
    .execute(&mut *conn)
    .await?;

    fetch_scan_summary_by_id(&mut *conn, scan_id).await
}

pub(super) async fn reorder_scans(
    this: &SqliteProjectPersistence,
    ordered_scan_ids: &[String],
) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let project_id = project_id(&mut *conn).await?;

    let project_id_for_existing = project_id.clone();
    let existing_ids = sqlx::query_scalar!(
        r#"SELECT id as "id!" FROM Scan WHERE project_id = ?1"#,
        project_id_for_existing,
    )
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
        let sort_order = index as i64;
        let project_id_for_update = project_id.clone();
        sqlx::query!(
            "UPDATE Scan SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3",
            sort_order,
            scan_id,
            project_id_for_update,
        )
        .execute(&mut *conn)
        .await?;
    }

    list_scan_summaries_by_project(&mut *conn, &project_id).await
}
