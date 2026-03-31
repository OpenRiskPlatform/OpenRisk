//! Data-access layer for open project sessions.
//!
//! Defines [`ProjectPersistence`]: the trait expressing all CRUD operations available on an
//! open project session. The production implementation is
//! `impl ProjectPersistence for SqliteProjectPersistence` below.
//!
//! Session lifecycle (opening, creating, migrating, encrypting) lives in the sibling
//! [`session`] module; business logic (plugin sync, scan execution) lives in [`service`].
//!
//! [`session`]: super::session
//! [`service`]: super::service

use super::session::SqliteProjectPersistence;
use super::plugins::LocalPluginBundle;
use super::security::{
    cache_key, clear_cached_key, validate_non_empty_password, validate_password,
};
use super::types::{
    PersistenceError, PluginEntrypointSelection, PluginLoadData, PluginSettingsPayload,
    ProjectLockStatus, ProjectSettingsPayload, ProjectSettingsRecord, ProjectSummary,
    ScanDetailRecord, ScanPluginResultRecord, ScanRunContext, ScanSummaryRecord,
};
use async_trait::async_trait;
use serde_json::{Map, Value};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// All CRUD operations available on an open project session.
///
/// Implementations hold a live database connection. Factory methods and lifecycle
/// operations (create, open, migrate, encrypt) are provided by [`SqliteProjectPersistence`]
/// directly rather than through this trait, keeping the trait focused on data access.
#[async_trait]
pub trait ProjectPersistence: Send + Sync {
    /// Load the full settings snapshot (project + global settings + all plugin configs).
    async fn load_settings(&self) -> Result<ProjectSettingsPayload, PersistenceError>;

    /// Update the project-wide theme setting.
    async fn update_project_settings(
        &self,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError>;

    /// Rename the project.
    async fn update_project_name(&self, name: &str) -> Result<ProjectSummary, PersistenceError>;

    /// Persist updated settings for one plugin within this project.
    async fn update_project_plugin_settings(
        &self,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError>;

    /// Create a new scan in Draft status.
    async fn create_scan(
        &self,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// List all scans for the project, newest first.
    async fn list_scans(&self) -> Result<Vec<ScanSummaryRecord>, PersistenceError>;

    /// Fetch full details of a single scan including all plugin results.
    async fn get_scan(&self, scan_id: &str) -> Result<ScanDetailRecord, PersistenceError>;

    /// Mark a scan as Running, snapshot its inputs and plugin selection, and return
    /// the code + settings needed to execute each selected entrypoint.
    async fn begin_scan_run(
        &self,
        scan_id: &str,
        selected_plugins: &[PluginEntrypointSelection],
        inputs: &Value,
    ) -> Result<ScanRunContext, PersistenceError>;

    /// Persist the results of a completed scan execution and mark it as Completed.
    async fn end_scan_run(
        &self,
        scan_id: &str,
        preview: Option<String>,
        results: Vec<ScanPluginResultRecord>,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// Update the preview (display name) of a scan.
    async fn update_scan_preview(
        &self,
        scan_id: &str,
        preview: String,
    ) -> Result<ScanSummaryRecord, PersistenceError>;

    /// Insert or update a plugin record (code + metadata) in the database.
    async fn save_plugin(&self, bundle: &LocalPluginBundle) -> Result<(), PersistenceError>;

    /// Return the current raw settings JSON for a plugin, or `None` if not yet configured.
    async fn get_plugin_settings_json(
        &self,
        plugin_id: &str,
    ) -> Result<Option<String>, PersistenceError>;

    /// Upsert the settings JSON for a plugin in this project.
    async fn save_plugin_settings_json(
        &self,
        plugin_id: &str,
        settings_json: &str,
    ) -> Result<(), PersistenceError>;

    /// Fetch a plugin with its current settings by `plugin_id`.
    async fn get_plugin_payload(
        &self,
        plugin_id: &str,
    ) -> Result<PluginSettingsPayload, PersistenceError>;

    /// Encrypt an unencrypted project with `new_password`.
    async fn set_project_password(
        &self,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Re-encrypt the database, replacing the current password with `new_password`.
    async fn change_project_password(
        &self,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;

    /// Remove encryption from the project database.
    async fn remove_project_password(
        &self,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;
}

// ---------------------------------------------------------------------------
// Production implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl ProjectPersistence for SqliteProjectPersistence {
    async fn load_settings(&self) -> Result<ProjectSettingsPayload, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_row = sqlx::query_as::<_, ProjectSettingsRow>(
            "SELECT p.id, p.name, p.audit, p.project_settings_id, \
             ps.description, ps.locale, ps.theme \
             FROM Project p \
             INNER JOIN ProjectSettings ps ON ps.id = p.project_settings_id \
             LIMIT 1",
        )
        .fetch_one(&mut *conn)
        .await?;

        let plugin_rows = sqlx::query_as::<_, PluginRow>(
            "SELECT Plugin.id as plugin_id, Plugin.name as plugin_name, \
             Plugin.version as plugin_version, Plugin.input_schema_json as input_schema_json, \
             Plugin.settings_schema_json as settings_schema_json, \
             Plugin.manifest_json as manifest_json, \
             ProjectPluginSettings.settings_json as settings_json \
             FROM Plugin \
             INNER JOIN ProjectPluginSettings ON ProjectPluginSettings.plugin_id = Plugin.id \
             WHERE ProjectPluginSettings.project_settings_id = ?1",
        )
        .bind(&project_row.project_settings_id)
        .fetch_all(&mut *conn)
        .await?;

        let mut plugins = Vec::with_capacity(plugin_rows.len());
        for row in plugin_rows {
            plugins.push(row.into_payload()?);
        }

        let project_id = project_row.id.clone();
        let project_name = project_row.name.clone();
        let project_audit = project_row.audit.clone();
        let project_settings = project_row.into_settings_record();
        Ok(ProjectSettingsPayload {
            project: ProjectSummary {
                id: project_id,
                name: project_name,
                audit: project_audit,
                directory: self.db_path.clone(),
            },
            project_settings,
            plugins,
        })
    }

    async fn update_project_settings(
        &self,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        let normalized = normalize_theme(theme);
        sqlx::query("UPDATE ProjectSettings SET theme = ?1 WHERE id = ?2")
            .bind(&normalized)
            .bind(&project_settings_id)
            .execute(&mut *conn)
            .await?;

        sqlx::query_as::<_, SettingsOnlyRow>(
            "SELECT id, description, locale, theme FROM ProjectSettings WHERE id = ?1",
        )
        .bind(&project_settings_id)
        .fetch_one(&mut *conn)
        .await
        .map(|r| r.into_record())
        .map_err(Into::into)
    }

    async fn update_project_name(&self, name: &str) -> Result<ProjectSummary, PersistenceError> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(PersistenceError::Validation(
                "Project name must not be empty".into(),
            ));
        }

        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let row = sqlx::query_as::<_, ProjectCoreRow>(
            "SELECT id, audit FROM Project LIMIT 1",
        )
        .fetch_one(&mut *conn)
        .await?;

        sqlx::query("UPDATE Project SET name = ?1 WHERE id = ?2")
            .bind(trimmed)
            .bind(&row.id)
            .execute(&mut *conn)
            .await?;

        Ok(ProjectSummary {
            id: row.id,
            name: trimmed.to_owned(),
            audit: row.audit,
            directory: self.db_path.clone(),
        })
    }

    async fn update_project_plugin_settings(
        &self,
        plugin_id: &str,
        settings: Value,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        if !settings.is_object() {
            return Err(PersistenceError::Validation(
                "Plugin settings must be a JSON object".into(),
            ));
        }

        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        let settings_json = serde_json::to_string(&settings)?;
        let updated = sqlx::query(
            "UPDATE ProjectPluginSettings SET settings_json = ?1 \
             WHERE plugin_id = ?2 AND project_settings_id = ?3",
        )
        .bind(&settings_json)
        .bind(plugin_id)
        .bind(&project_settings_id)
        .execute(&mut *conn)
        .await?;

        if updated.rows_affected() == 0 {
            return Err(PersistenceError::Validation(format!(
                "Plugin '{}' is not configured for this project",
                plugin_id
            )));
        }

        sqlx::query_as::<_, PluginRow>(
            "SELECT Plugin.id as plugin_id, Plugin.name as plugin_name, \
             Plugin.version as plugin_version, Plugin.input_schema_json as input_schema_json, \
             Plugin.settings_schema_json as settings_schema_json, \
             Plugin.manifest_json as manifest_json, \
             ProjectPluginSettings.settings_json as settings_json \
             FROM Plugin \
             INNER JOIN ProjectPluginSettings ON ProjectPluginSettings.plugin_id = Plugin.id \
             WHERE ProjectPluginSettings.project_settings_id = ?1 AND Plugin.id = ?2",
        )
        .bind(&project_settings_id)
        .bind(plugin_id)
        .fetch_one(&mut *conn)
        .await?
        .into_payload()
    }

    async fn create_scan(
        &self,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
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

        sqlx::query(
            "INSERT INTO Scan \
             (id, project_id, status, preview, inputs_json, selected_plugins_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&id)
        .bind(&project_id)
        .bind("Draft")
        .bind(&final_preview)
        .bind("{}")
        .bind("[]")
        .execute(&mut *conn)
        .await?;

        Ok(ScanSummaryRecord {
            id,
            status: "Draft".to_string(),
            preview: Some(final_preview),
        })
    }

    async fn list_scans(&self) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_id: String = sqlx::query_scalar("SELECT id FROM Project LIMIT 1")
            .fetch_one(&mut *conn)
            .await?;

        let rows = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE project_id = ?1 ORDER BY rowid DESC",
        )
        .bind(project_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| r.into_summary()).collect())
    }

    async fn get_scan(&self, scan_id: &str) -> Result<ScanDetailRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let scan = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut *conn)
        .await?;

        let inputs = parse_json_text(scan.inputs_json)?;
        let selected_plugins: Vec<PluginEntrypointSelection> =
            match parse_json_text(scan.selected_plugins_json)? {
                Value::Array(items) => items
                    .into_iter()
                    .filter_map(|v| serde_json::from_value(v).ok())
                    .collect(),
                _ => vec![],
            };

        let has_entrypoint =
            SqliteProjectPersistence::column_exists(conn, "ScanPluginResult", "entrypoint_id")
                .await?;

        let results = if has_entrypoint {
            let result_rows = sqlx::query_as::<_, ScanResultRow>(
                "SELECT plugin_id, entrypoint_id, output_json_ir \
                 FROM ScanPluginResult WHERE scan_id = ?1",
            )
            .bind(&scan.id)
            .fetch_all(&mut *conn)
            .await?;

            result_rows
                .into_iter()
                .map(|row| {
                    Ok(ScanPluginResultRecord {
                        plugin_id: row.plugin_id,
                        entrypoint_id: row.entrypoint_id,
                        output: normalize_scan_output(parse_json_text(row.output_json_ir)?),
                    })
                })
                .collect::<Result<Vec<_>, PersistenceError>>()?
        } else {
            let legacy_rows = sqlx::query_as::<_, LegacyScanResultRow>(
                "SELECT plugin_id, output_json_ir FROM ScanPluginResult WHERE scan_id = ?1",
            )
            .bind(&scan.id)
            .fetch_all(&mut *conn)
            .await?;

            legacy_rows
                .into_iter()
                .map(|row| {
                    Ok(ScanPluginResultRecord {
                        plugin_id: row.plugin_id,
                        entrypoint_id: "default".to_string(),
                        output: normalize_scan_output(parse_json_text(row.output_json_ir)?),
                    })
                })
                .collect::<Result<Vec<_>, PersistenceError>>()?
        };

        Ok(ScanDetailRecord {
            id: scan.id,
            status: scan.status,
            preview: scan.preview,
            selected_plugins,
            inputs,
            results,
        })
    }

    async fn begin_scan_run(
        &self,
        scan_id: &str,
        selected_plugins: &[PluginEntrypointSelection],
        inputs: &Value,
    ) -> Result<ScanRunContext, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let scan = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut *conn)
        .await?;

        if scan.status != "Draft" {
            return Err(PersistenceError::Validation(
                "Scan already launched and cannot be rerun".into(),
            ));
        }

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        sqlx::query(
            "UPDATE Scan SET status = 'Running', \
             selected_plugins_json = ?1, inputs_json = ?2 WHERE id = ?3",
        )
        .bind(serde_json::to_string(selected_plugins)?)
        .bind(serde_json::to_string(inputs)?)
        .bind(scan_id)
        .execute(&mut *conn)
        .await?;

        sqlx::query("DELETE FROM ScanPluginResult WHERE scan_id = ?1")
            .bind(scan_id)
            .execute(&mut *conn)
            .await?;

        let mut plugins = Vec::with_capacity(selected_plugins.len());
        for sel in selected_plugins {
            let row = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>)>(
                "SELECT pps.settings_json, p.code, p.manifest_json \
                 FROM ProjectPluginSettings pps \
                 INNER JOIN Plugin p ON p.id = pps.plugin_id \
                 WHERE pps.plugin_id = ?1 AND pps.project_settings_id = ?2 LIMIT 1",
            )
            .bind(&sel.plugin_id)
            .bind(&project_settings_id)
            .fetch_optional(&mut *conn)
            .await?;

            let (settings_json, code, manifest_json) = row.unwrap_or((None, None, None));
            plugins.push(PluginLoadData {
                plugin_id: sel.plugin_id.clone(),
                entrypoint_id: sel.entrypoint_id.clone(),
                settings_json,
                code,
                manifest_json,
            });
        }

        Ok(ScanRunContext {
            scan_preview: scan.preview,
            plugins,
        })
    }

    async fn end_scan_run(
        &self,
        scan_id: &str,
        preview: Option<String>,
        results: Vec<ScanPluginResultRecord>,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        for result in &results {
            sqlx::query(
                "INSERT INTO ScanPluginResult \
                 (id, plugin_id, entrypoint_id, scan_id, output_json_ir) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&result.plugin_id)
            .bind(&result.entrypoint_id)
            .bind(scan_id)
            .bind(serde_json::to_string(&result.output)?)
            .execute(&mut *conn)
            .await?;
        }

        sqlx::query("UPDATE Scan SET status = 'Completed' WHERE id = ?1")
            .bind(scan_id)
            .execute(&mut *conn)
            .await?;

        Ok(ScanSummaryRecord {
            id: scan_id.to_owned(),
            status: "Completed".to_string(),
            preview,
        })
    }

    async fn save_plugin(&self, bundle: &LocalPluginBundle) -> Result<(), PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;
        SqliteProjectPersistence::insert_plugin(conn, bundle).await
    }

    async fn get_plugin_settings_json(
        &self,
        plugin_id: &str,
    ) -> Result<Option<String>, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        sqlx::query_scalar(
            "SELECT settings_json FROM ProjectPluginSettings \
             WHERE plugin_id = ?1 AND project_settings_id = ?2 LIMIT 1",
        )
        .bind(plugin_id)
        .bind(&project_settings_id)
        .fetch_optional(&mut *conn)
        .await
        .map_err(Into::into)
    }

    async fn save_plugin_settings_json(
        &self,
        plugin_id: &str,
        settings_json: &str,
    ) -> Result<(), PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        sqlx::query(
            "INSERT INTO ProjectPluginSettings (plugin_id, project_settings_id, settings_json) \
             VALUES (?1, ?2, ?3) \
             ON CONFLICT(plugin_id, project_settings_id) DO UPDATE SET \
                 settings_json = excluded.settings_json",
        )
        .bind(plugin_id)
        .bind(&project_settings_id)
        .bind(settings_json)
        .execute(&mut *conn)
        .await?;

        Ok(())
    }

    async fn get_plugin_payload(
        &self,
        plugin_id: &str,
    ) -> Result<PluginSettingsPayload, PersistenceError> {
        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let project_settings_id: String =
            sqlx::query_scalar("SELECT project_settings_id FROM Project LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;

        sqlx::query_as::<_, PluginRow>(
            "SELECT Plugin.id as plugin_id, Plugin.name as plugin_name, \
             Plugin.version as plugin_version, Plugin.input_schema_json as input_schema_json, \
             Plugin.settings_schema_json as settings_schema_json, \
             Plugin.manifest_json as manifest_json, \
             ProjectPluginSettings.settings_json as settings_json \
             FROM Plugin \
             INNER JOIN ProjectPluginSettings ON ProjectPluginSettings.plugin_id = Plugin.id \
             WHERE ProjectPluginSettings.project_settings_id = ?1 AND Plugin.id = ?2",
        )
        .bind(&project_settings_id)
        .bind(plugin_id)
        .fetch_one(&mut *conn)
        .await?
        .into_payload()
    }

    async fn update_scan_preview(
        &self,
        scan_id: &str,
        preview: String,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        let next = preview.trim().to_string();
        if next.is_empty() {
            return Err(PersistenceError::Validation(
                "Scan name must not be empty".into(),
            ));
        }

        let mut guard = self.conn.lock().await;
        let conn = guard.as_mut().ok_or_else(conn_unavailable)?;

        let current = sqlx::query_as::<_, ScanRow>(
            "SELECT id, status, preview, inputs_json, selected_plugins_json \
             FROM Scan WHERE id = ?1 LIMIT 1",
        )
        .bind(scan_id)
        .fetch_one(&mut *conn)
        .await?;

        sqlx::query("UPDATE Scan SET preview = ?1 WHERE id = ?2")
            .bind(&next)
            .bind(scan_id)
            .execute(&mut *conn)
            .await?;

        Ok(ScanSummaryRecord {
            id: scan_id.to_owned(),
            status: current.status,
            preview: Some(next),
        })
    }

    async fn set_project_password(
        &self,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        validate_password(&new_password)?;
        let status = SqliteProjectPersistence::read_lock_status(&self.db_path).await?;
        if status.locked {
            return Err(PersistenceError::Validation(
                "Project already has a password. Use change_project_password instead.".into(),
            ));
        }
        self.rewrite_and_reconnect(None, Some(new_password.clone()))
            .await?;
        cache_key(&self.db_path, new_password);
        Ok(ProjectLockStatus {
            locked: true,
            unlocked: true,
        })
    }

    async fn change_project_password(
        &self,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        validate_password(&new_password)?;
        validate_non_empty_password(&current_password, "Current password")?;
        self.rewrite_and_reconnect(Some(current_password), Some(new_password.clone()))
            .await?;
        cache_key(&self.db_path, new_password);
        Ok(ProjectLockStatus {
            locked: true,
            unlocked: true,
        })
    }

    async fn remove_project_password(
        &self,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        validate_non_empty_password(&current_password, "Current password")?;
        self.rewrite_and_reconnect(Some(current_password), None)
            .await?;
        clear_cached_key(&self.db_path);
        Ok(ProjectLockStatus {
            locked: false,
            unlocked: true,
        })
    }
}

// ---------------------------------------------------------------------------
// SQLx row types
// ---------------------------------------------------------------------------

/// Combined project + settings row for a single JOIN query in `load_settings`.
#[derive(sqlx::FromRow)]
struct ProjectSettingsRow {
    id: String,
    name: String,
    audit: Option<String>,
    project_settings_id: String,
    description: Option<String>,
    locale: Option<String>,
    theme: Option<String>,
}

impl ProjectSettingsRow {
    fn into_settings_record(&self) -> ProjectSettingsRecord {
        ProjectSettingsRecord {
            id: self.project_settings_id.clone(),
            description: self.description.clone().unwrap_or_default(),
            locale: self.locale.clone().unwrap_or_else(|| "en-US".to_string()),
            theme: normalize_theme(self.theme.clone()),
        }
    }
}

/// Bare project row for operations that only need id/audit.
#[derive(sqlx::FromRow)]
struct ProjectCoreRow {
    id: String,
    audit: Option<String>,
}

/// Separate settings-only row for `update_project_settings`.
#[derive(sqlx::FromRow)]
struct SettingsOnlyRow {
    id: String,
    description: Option<String>,
    locale: Option<String>,
    theme: Option<String>,
}

impl SettingsOnlyRow {
    fn into_record(self) -> ProjectSettingsRecord {
        ProjectSettingsRecord {
            id: self.id,
            description: self.description.unwrap_or_default(),
            locale: self.locale.unwrap_or_else(|| "en-US".to_string()),
            theme: normalize_theme(self.theme),
        }
    }
}

#[derive(sqlx::FromRow)]
struct PluginRow {
    plugin_id: String,
    plugin_name: String,
    plugin_version: String,
    input_schema_json: Option<String>,
    settings_schema_json: Option<String>,
    manifest_json: Option<String>,
    settings_json: Option<String>,
}

impl PluginRow {
    fn into_payload(self) -> Result<PluginSettingsPayload, PersistenceError> {
        let manifest = parse_json_text(self.manifest_json)?;
        let input_schema = parse_json_text(self.input_schema_json)?;
        let settings_schema = parse_json_text(self.settings_schema_json)?;
        let mut settings = parse_json_text(self.settings_json)?;
        if !settings.is_object() {
            settings = Value::Object(Map::new());
        }
        Ok(PluginSettingsPayload {
            id: self.plugin_id,
            name: self.plugin_name,
            version: self.plugin_version,
            manifest,
            input_schema,
            settings_schema,
            settings,
        })
    }
}

#[derive(sqlx::FromRow)]
struct ScanRow {
    id: String,
    status: String,
    preview: Option<String>,
    inputs_json: Option<String>,
    selected_plugins_json: Option<String>,
}

impl ScanRow {
    fn into_summary(self) -> ScanSummaryRecord {
        ScanSummaryRecord {
            id: self.id,
            status: self.status,
            preview: self.preview,
        }
    }
}

#[derive(sqlx::FromRow)]
struct ScanResultRow {
    plugin_id: String,
    entrypoint_id: String,
    output_json_ir: Option<String>,
}

#[derive(sqlx::FromRow)]
struct LegacyScanResultRow {
    plugin_id: String,
    output_json_ir: Option<String>,
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

fn conn_unavailable() -> PersistenceError {
    PersistenceError::Validation(
        "Project connection is temporarily unavailable during an encryption operation. \
         Please reopen the project."
            .into(),
    )
}

fn parse_json_text(raw: Option<String>) -> Result<Value, PersistenceError> {
    match raw {
        Some(text) if !text.trim().is_empty() => Ok(serde_json::from_str(&text)?),
        _ => Ok(Value::Null),
    }
}

/// Normalize legacy scan outputs into the `{ok, data, logs}` envelope shape.
pub(super) fn normalize_scan_output(value: Value) -> Value {
    use serde_json::json;
    match value {
        Value::Object(map) if map.contains_key("ok") => Value::Object(map),
        Value::Null => json!({ "ok": false, "error": "No result payload" }),
        other => json!({ "ok": true, "data": other, "logs": [] }),
    }
}

fn normalize_theme(value: Option<String>) -> String {
    match value.as_deref() {
        Some("light") => "light".to_string(),
        Some("dark") => "dark".to_string(),
        _ => "system".to_string(),
    }
}

