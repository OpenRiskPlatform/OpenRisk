use std::path::PathBuf;
use std::sync::Arc;

use openrisk_core::project::{ProjectPersistence, SettingValue, SqliteProjectPersistence, service};

use crate::NativeOpenRiskError;
use crate::records::*;

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

    pub async fn create_project(
        &self,
        name: String,
        project_path: String,
    ) -> Result<NativeProjectSummary, NativeOpenRiskError> {
        let (summary, persistence) =
            SqliteProjectPersistence::create(&name, &PathBuf::from(project_path))
                .await
                .map_err(NativeOpenRiskError::operation)?;
        *self.project.lock().await = Some(Arc::new(persistence));
        Ok(summary.into())
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

    pub async fn load_settings(&self) -> Result<NativeSettingsSnapshot, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .load_settings()
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn update_project_settings(
        &self,
        name: Option<String>,
        theme: Option<String>,
        advanced_mode: Option<bool>,
    ) -> Result<NativeProjectSettings, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .update_project_settings(name, theme, advanced_mode)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn set_plugin_setting(
        &self,
        plugin_id: String,
        setting_name: String,
        value_json: String,
    ) -> Result<NativePlugin, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        let value = parse_setting_value(&value_json)?;
        project
            .set_plugin_setting(&plugin_id, &setting_name, value)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn set_plugin_enabled(
        &self,
        plugin_id: String,
        enabled: bool,
    ) -> Result<NativePlugin, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .set_plugin_enabled(&plugin_id, enabled)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn refresh_plugin_metrics(
        &self,
        plugin_id: String,
    ) -> Result<NativePlugin, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        service::refresh_plugin_metrics(project.as_ref(), &plugin_id)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn install_plugin_from_directory(
        &self,
        plugin_path: String,
    ) -> Result<NativePlugin, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        service::upsert_plugin_from_dir(project.as_ref(), &PathBuf::from(plugin_path))
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn install_plugin_from_zip(
        &self,
        zip_path: String,
    ) -> Result<NativePlugin, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        service::upsert_plugin_from_zip(project.as_ref(), &PathBuf::from(zip_path))
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn install_plugin_from_url(
        &self,
        manifest_url: String,
    ) -> Result<NativePlugin, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        service::upsert_plugin_from_url(project.as_ref(), &manifest_url)
            .await
            .map(Into::into)
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn get_plugin_registry(&self) -> Result<NativePluginRegistry, NativeOpenRiskError> {
        service::get_plugin_registry()
            .await
            .map(Into::into)
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

    pub async fn set_project_password(
        &self,
        new_password: String,
    ) -> Result<NativeProjectLockStatus, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .set_project_password(new_password)
            .await
            .map(|status| NativeProjectLockStatus {
                locked: status.locked,
                unlocked: status.unlocked,
            })
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn change_project_password(
        &self,
        current_password: String,
        new_password: String,
    ) -> Result<NativeProjectLockStatus, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .change_project_password(current_password, new_password)
            .await
            .map(|status| NativeProjectLockStatus {
                locked: status.locked,
                unlocked: status.unlocked,
            })
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn remove_project_password(
        &self,
        current_password: String,
    ) -> Result<NativeProjectLockStatus, NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .remove_project_password(current_password)
            .await
            .map(|status| NativeProjectLockStatus {
                locked: status.locked,
                unlocked: status.unlocked,
            })
            .map_err(NativeOpenRiskError::operation)
    }

    pub async fn create_preview_project(
        &self,
        destination_path: String,
    ) -> Result<(), NativeOpenRiskError> {
        let project = self.open_project_handle().await?;
        project
            .export_as_preview(&PathBuf::from(destination_path))
            .await
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

fn parse_setting_value(value_json: &str) -> Result<SettingValue, NativeOpenRiskError> {
    serde_json::from_str(value_json)
        .map(|value| SettingValue::from_json(&value))
        .map_err(NativeOpenRiskError::operation)
}

#[cfg(test)]
mod tests {
    use super::*;
    use openrisk_core::project::ScanEntrypointInput;

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

    #[test]
    fn plugin_setting_json_stays_typed() {
        let values = [
            ("\"English\"", SettingValue::String("English".to_string())),
            ("3", SettingValue::Number(3.0)),
            ("false", SettingValue::Boolean(false)),
            ("null", SettingValue::Null),
        ];

        for (value_json, expected) in values {
            let parsed = parse_setting_value(value_json).expect("valid setting value");
            assert_eq!(parsed.to_json(), expected.to_json());
        }
    }
}
