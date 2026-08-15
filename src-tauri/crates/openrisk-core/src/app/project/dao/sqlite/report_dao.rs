//! Read-only report snapshots built from the exact revisions used by a scan.

use super::helpers::conn_unavailable;
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;

pub(super) async fn get_scan_report_snapshot(
    this: &SqliteProjectPersistence,
    scan_id: &str,
) -> Result<ScanReportSnapshot, PersistenceError> {
    let mut guard = this.conn.lock().await;
    let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

    let head = sqlx::query!(
        r#"SELECT p.name as "project_name!", p.audit,
                  COALESCE(ps.locale, 'en-US') as "locale!: String",
                  COALESCE(s.preview, 'Untitled') as "scan_title!: String",
                  s.status as "scan_status!",
                  COALESCE(s.created_at, CURRENT_TIMESTAMP) as "scan_created_at!: String"
           FROM Scan s
           INNER JOIN Project p ON p.id = s.project_id
           INNER JOIN ProjectSettings ps ON ps.id = p.project_settings_id
           WHERE s.id = ?1
           LIMIT 1"#,
        scan_id,
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| {
        PersistenceError::Validation(format!("Investigation '{}' was not found", scan_id))
    })?;

    if !matches!(head.scan_status.as_str(), "Completed" | "Failed") {
        return Err(PersistenceError::Validation(
            "Only completed or failed investigations can be exported to PDF".into(),
        ));
    }

    let input_rows = sqlx::query!(
        r#"SELECT sei.plugin_id as "plugin_id!", sei.entrypoint_id as "entrypoint_id!",
                  sei.field_name as "field_name!", sei.value_json as "value_json!"
           FROM ScanEntrypointInput sei
           WHERE sei.scan_id = ?1
           ORDER BY sei.rowid"#,
        scan_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    let inputs = input_rows
        .into_iter()
        .map(|row| ReportInputSnapshot {
            plugin_id: row.plugin_id,
            entrypoint_id: row.entrypoint_id,
            field_name: row.field_name,
            value: serde_json::from_str(&row.value_json).unwrap_or(serde_json::Value::Null),
        })
        .collect();

    let result_rows = sqlx::query!(
        r#"SELECT spr.plugin_id as "plugin_id!", spr.entrypoint_id as "entrypoint_id!",
                  spr.ok as "ok!", spr.data_json,
                  COALESCE(pre.name, spr.entrypoint_id) as "entrypoint_name!: String"
           FROM ScanPluginResult spr
           LEFT JOIN PluginRevisionEntrypoint pre
             ON pre.revision_id = spr.plugin_revision_id
            AND pre.id = spr.entrypoint_id
           WHERE spr.scan_id = ?1
           ORDER BY spr.rowid"#,
        scan_id,
    )
    .fetch_all(&mut *conn)
    .await?;

    let executions = result_rows
        .into_iter()
        .map(|row| ReportExecutionSnapshot {
            plugin_id: row.plugin_id,
            entrypoint_id: row.entrypoint_id,
            entrypoint_name: row.entrypoint_name,
            ok: row.ok != 0,
            data: row
                .data_json
                .as_deref()
                .and_then(|raw| serde_json::from_str(raw).ok()),
        })
        .collect();

    Ok(ScanReportSnapshot {
        schema_version: "1".to_string(),
        locale: head.locale,
        project: ReportProjectSnapshot {
            name: head.project_name,
            audit: head.audit,
        },
        scan: ReportScanSnapshot {
            title: head.scan_title,
            status: head.scan_status,
            created_at: head.scan_created_at,
        },
        include_search_details: true,
        include_results: true,
        inputs,
        executions,
    })
}
