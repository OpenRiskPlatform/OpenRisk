//! Native application API used by the macOS SwiftUI client.
//!
//! This boundary deliberately exposes application records rather than Tauri
//! window or IPC types. The existing React client and the native client can
//! therefore call the same project persistence without depending on each
//! other's UI runtime.

use std::path::PathBuf;
use std::sync::Arc;

use crate::app::project::{
    PluginEntrypointSelection, PluginInputDef, PluginRecord, ProjectPersistence, ProjectSummary,
    ScanDetailRecord, ScanEntrypointInput, ScanPluginResultRecord, ScanSummaryRecord, SettingValue,
    SqliteProjectPersistence, service,
};

#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum NativeOpenRiskError {
    #[error("{message}")]
    OperationFailed { message: String },
}

impl NativeOpenRiskError {
    fn operation(error: impl std::fmt::Display) -> Self {
        Self::OperationFailed {
            message: error.to_string(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeProjectSummary {
    pub id: String,
    pub name: String,
    pub directory: String,
    pub is_preview: bool,
}

impl From<ProjectSummary> for NativeProjectSummary {
    fn from(project: ProjectSummary) -> Self {
        Self {
            id: project.id,
            name: project.name,
            directory: project.directory.to_string_lossy().into_owned(),
            is_preview: project.is_preview,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeProjectLockStatus {
    pub locked: bool,
    pub unlocked: bool,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginEntrypoint {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginInput {
    pub entrypoint_id: String,
    pub name: String,
    pub title: String,
    pub type_name: String,
    pub type_values: Vec<String>,
    pub optional: bool,
    pub description: Option<String>,
    pub default_value_json: Option<String>,
}

impl From<PluginInputDef> for NativePluginInput {
    fn from(input: PluginInputDef) -> Self {
        Self {
            entrypoint_id: input.entrypoint_id,
            name: input.name,
            title: input.title,
            type_name: input.type_.name,
            type_values: input.type_.values.unwrap_or_default(),
            optional: input.optional,
            description: input.description,
            default_value_json: input.default_value.map(|value| value.to_json_string()),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePlugin {
    pub id: String,
    pub name: String,
    pub version: String,
    pub enabled: bool,
    pub status: String,
    pub entrypoints: Vec<NativePluginEntrypoint>,
    pub inputs: Vec<NativePluginInput>,
}

impl From<PluginRecord> for NativePlugin {
    fn from(plugin: PluginRecord) -> Self {
        Self {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            enabled: plugin.enabled,
            status: plugin.status,
            entrypoints: plugin
                .entrypoints
                .into_iter()
                .map(|entrypoint| NativePluginEntrypoint {
                    id: entrypoint.id,
                    name: entrypoint.name,
                    description: entrypoint.description,
                })
                .collect(),
            inputs: plugin.input_defs.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanSummary {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub created_at: String,
    pub plugin_name: Option<String>,
    pub result_count: i64,
    pub error_result_count: i64,
    pub is_archived: bool,
    pub sort_order: i64,
}

impl From<ScanSummaryRecord> for NativeScanSummary {
    fn from(scan: ScanSummaryRecord) -> Self {
        Self {
            id: scan.id,
            status: scan.status,
            preview: scan.preview,
            created_at: scan.created_at,
            plugin_name: scan.plugin_name,
            result_count: scan.result_count,
            error_result_count: scan.error_result_count,
            is_archived: scan.is_archived,
            sort_order: scan.sort_order,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginSelection {
    pub plugin_id: String,
    pub entrypoint_id: String,
}

impl From<NativePluginSelection> for PluginEntrypointSelection {
    fn from(selection: NativePluginSelection) -> Self {
        Self {
            plugin_id: selection.plugin_id,
            entrypoint_id: selection.entrypoint_id,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanInput {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub field_name: String,
    pub value_json: String,
}

impl TryFrom<NativeScanInput> for ScanEntrypointInput {
    type Error = NativeOpenRiskError;

    fn try_from(input: NativeScanInput) -> Result<Self, Self::Error> {
        let value = serde_json::from_str(&input.value_json)
            .map_err(NativeOpenRiskError::operation)
            .map(|value| SettingValue::from_json(&value))?;
        Ok(Self {
            plugin_id: input.plugin_id,
            entrypoint_id: input.entrypoint_id,
            field_name: input.field_name,
            value,
        })
    }
}

impl From<ScanEntrypointInput> for NativeScanInput {
    fn from(input: ScanEntrypointInput) -> Self {
        Self {
            plugin_id: input.plugin_id,
            entrypoint_id: input.entrypoint_id,
            field_name: input.field_name,
            value_json: input.value.to_json_string(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanResult {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub ok: bool,
    pub data_json: Option<String>,
    pub error: Option<String>,
    pub logs: Vec<String>,
}

impl From<ScanPluginResultRecord> for NativeScanResult {
    fn from(result: ScanPluginResultRecord) -> Self {
        Self {
            plugin_id: result.plugin_id,
            entrypoint_id: result.entrypoint_id,
            ok: result.output.ok,
            data_json: result.output.data_json,
            error: result.output.error,
            logs: result
                .output
                .logs
                .into_iter()
                .map(|log| log.message)
                .collect(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanDetail {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub created_at: String,
    pub selected_plugins: Vec<NativePluginSelection>,
    pub inputs: Vec<NativeScanInput>,
    pub results: Vec<NativeScanResult>,
}

impl From<ScanDetailRecord> for NativeScanDetail {
    fn from(scan: ScanDetailRecord) -> Self {
        Self {
            id: scan.id,
            status: scan.status,
            preview: scan.preview,
            created_at: scan.created_at,
            selected_plugins: scan
                .selected_plugins
                .into_iter()
                .map(|selection| NativePluginSelection {
                    plugin_id: selection.plugin_id,
                    entrypoint_id: selection.entrypoint_id,
                })
                .collect(),
            inputs: scan.inputs.into_iter().map(Into::into).collect(),
            results: scan.results.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(uniffi::Object)]
pub struct NativeOpenRiskClient {
    project: tokio::sync::Mutex<Option<Arc<SqliteProjectPersistence>>>,
}

#[uniffi::export(async_runtime = "tokio")]
impl NativeOpenRiskClient {
    #[uniffi::constructor]
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            project: tokio::sync::Mutex::new(None),
        })
    }

    pub async fn open_project(
        &self,
        project_path: String,
        password: Option<String>,
    ) -> Result<NativeProjectSummary, NativeOpenRiskError> {
        let path = PathBuf::from(project_path);
        let (summary, persistence) = match password {
            Some(password) => SqliteProjectPersistence::open_with_password(&path, password).await,
            None => SqliteProjectPersistence::open(&path).await,
        }
        .map_err(NativeOpenRiskError::operation)?;

        *self.project.lock().await = Some(Arc::new(persistence));
        Ok(summary.into())
    }

    pub async fn get_project_lock_status(
        &self,
        project_path: String,
    ) -> Result<NativeProjectLockStatus, NativeOpenRiskError> {
        SqliteProjectPersistence::check_lock_status(&PathBuf::from(project_path))
            .await
            .map(|status| NativeProjectLockStatus {
                locked: status.locked,
                unlocked: status.unlocked,
            })
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn close_project(&self) {
        *self.project.lock().await = None;
    }

    pub async fn list_scans(&self) -> Result<Vec<NativeScanSummary>, NativeOpenRiskError> {
        let project = self.project.lock().await.clone().ok_or_else(|| {
            NativeOpenRiskError::OperationFailed {
                message: "No project is open.".to_string(),
            }
        })?;

        project
            .list_scans()
            .await
            .map(|scans| scans.into_iter().map(Into::into).collect())
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn load_plugins(&self) -> Result<Vec<NativePlugin>, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .load_settings()
            .await
            .map(|settings| settings.plugins.into_iter().map(Into::into).collect())
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn create_scan(
        &self,
        preview: Option<String>,
    ) -> Result<NativeScanSummary, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .create_scan(preview)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn get_scan(&self, scan_id: String) -> Result<NativeScanDetail, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .get_scan(&scan_id)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn save_scan_draft(
        &self,
        scan_id: String,
        preview: String,
        selected_plugins: Vec<NativePluginSelection>,
        inputs: Vec<NativeScanInput>,
    ) -> Result<NativeScanSummary, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        let selected_plugins = selected_plugins
            .into_iter()
            .map(Into::into)
            .collect::<Vec<_>>();
        let inputs = inputs
            .into_iter()
            .map(TryInto::try_into)
            .collect::<Result<Vec<_>, NativeOpenRiskError>>()?;
        let preview = normalized_preview(preview);

        project
            .update_scan_preview(&scan_id, preview)
            .await
            .map_err(NativeOpenRiskError::operation)?;
        project
            .update_scan_draft(&scan_id, &selected_plugins, &inputs)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn run_scan(
        &self,
        scan_id: String,
        preview: String,
        selected_plugins: Vec<NativePluginSelection>,
        inputs: Vec<NativeScanInput>,
    ) -> Result<NativeScanDetail, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        let selected_plugins = selected_plugins
            .into_iter()
            .map(Into::into)
            .collect::<Vec<_>>();
        let inputs = inputs
            .into_iter()
            .map(TryInto::try_into)
            .collect::<Result<Vec<_>, NativeOpenRiskError>>()?;

        project
            .update_scan_preview(&scan_id, normalized_preview(preview))
            .await
            .map_err(NativeOpenRiskError::operation)?;
        service::run_scan(project.as_ref(), &scan_id, selected_plugins, inputs)
            .await
            .map_err(NativeOpenRiskError::operation)?;
        project
            .get_scan(&scan_id)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn set_scan_archived(
        &self,
        scan_id: String,
        archived: bool,
    ) -> Result<NativeScanSummary, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .set_scan_archived(&scan_id, archived)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn rename_scan(
        &self,
        scan_id: String,
        preview: String,
    ) -> Result<NativeScanSummary, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .update_scan_preview(&scan_id, normalized_preview(preview))
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn reorder_scans(
        &self,
        ordered_scan_ids: Vec<String>,
    ) -> Result<Vec<NativeScanSummary>, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .reorder_scans(&ordered_scan_ids)
            .await
            .map(|scans| scans.into_iter().map(Into::into).collect())
            .map_err(NativeOpenRiskError::operation)
    }
}

impl NativeOpenRiskClient {
    async fn open_project_handle(
        &self,
    ) -> Result<Arc<SqliteProjectPersistence>, NativeOpenRiskError> {
        self.project
            .lock()
            .await
            .clone()
            .ok_or_else(|| NativeOpenRiskError::OperationFailed {
                message: "No project is open.".to_string(),
            })
    }
}

fn normalized_preview(preview: String) -> String {
    let preview = preview.trim();
    if preview.is_empty() {
        "Untitled".to_string()
    } else {
        preview.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blank_preview_falls_back_to_untitled() {
        assert_eq!(normalized_preview("  ".to_string()), "Untitled");
        assert_eq!(
            normalized_preview("  Company check  ".to_string()),
            "Company check"
        );
    }

    #[test]
    fn native_scan_input_parses_scalar_json() {
        let values = [
            ("\"Acme\"", SettingValue::String("Acme".to_string())),
            ("42.5", SettingValue::Number(42.5)),
            ("true", SettingValue::Boolean(true)),
            ("null", SettingValue::Null),
        ];

        for (value_json, expected) in values {
            let input = NativeScanInput {
                plugin_id: "plugin".to_string(),
                entrypoint_id: "search".to_string(),
                field_name: "query".to_string(),
                value_json: value_json.to_string(),
            };
            let converted = ScanEntrypointInput::try_from(input).expect("valid scalar input");
            assert_eq!(converted.value.to_json(), expected.to_json());
        }
    }
}
