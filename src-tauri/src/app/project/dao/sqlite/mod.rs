//! SQLite implementation of the project DAO trait.

mod helpers;
mod scans_dao;
mod security_dao;
mod settings_dao;

use super::ProjectPersistence;
use crate::app::project::plugins::LocalPluginBundle;
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;
use async_trait::async_trait;

#[async_trait]
impl ProjectPersistence for SqliteProjectPersistence {
    async fn load_settings(&self) -> Result<ProjectSettingsPayload, PersistenceError> {
        settings_dao::load_settings(self).await
    }
    async fn update_project_settings(
        &self,
        name: Option<String>,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError> {
        settings_dao::update_project_settings(self, name, theme).await
    }
    async fn set_plugin_setting(
        &self,
        plugin_id: &str,
        setting_name: &str,
        value: SettingValue,
    ) -> Result<PluginRecord, PersistenceError> {
        settings_dao::set_plugin_setting(self, plugin_id, setting_name, value).await
    }
    async fn save_plugin(&self, bundle: &LocalPluginBundle) -> Result<(), PersistenceError> {
        settings_dao::save_plugin(self, bundle).await
    }
    async fn get_plugin_setting_values(
        &self,
        plugin_id: &str,
    ) -> Result<Vec<PluginSettingValue>, PersistenceError> {
        settings_dao::get_plugin_setting_values(self, plugin_id).await
    }
    async fn save_plugin_setting_values(
        &self,
        plugin_id: &str,
        values: &[PluginSettingValue],
    ) -> Result<(), PersistenceError> {
        settings_dao::save_plugin_setting_values(self, plugin_id, values).await
    }
    async fn get_plugin_record(&self, plugin_id: &str) -> Result<PluginRecord, PersistenceError> {
        settings_dao::get_plugin_record(self, plugin_id).await
    }
    async fn set_plugin_enabled(
        &self,
        plugin_id: &str,
        enabled: bool,
    ) -> Result<PluginRecord, PersistenceError> {
        settings_dao::set_plugin_enabled(self, plugin_id, enabled).await
    }
    async fn create_scan(
        &self,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        scans_dao::create_scan(self, preview).await
    }
    async fn list_scans(&self) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
        scans_dao::list_scans(self).await
    }
    async fn get_scan(&self, scan_id: &str) -> Result<ScanDetailRecord, PersistenceError> {
        scans_dao::get_scan(self, scan_id).await
    }
    async fn begin_scan_run(
        &self,
        scan_id: &str,
        selected_plugins: &[PluginEntrypointSelection],
        inputs: &[ScanEntrypointInput],
    ) -> Result<ScanRunContext, PersistenceError> {
        scans_dao::begin_scan_run(self, scan_id, selected_plugins, inputs).await
    }
    async fn end_scan_run(
        &self,
        scan_id: &str,
        preview: Option<String>,
        results: Vec<ScanPluginResultRecord>,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        scans_dao::end_scan_run(self, scan_id, preview, results).await
    }
    async fn update_scan_preview(
        &self,
        scan_id: &str,
        preview: String,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        scans_dao::update_scan_preview(self, scan_id, preview).await
    }
    async fn set_scan_archived(
        &self,
        scan_id: &str,
        archived: bool,
    ) -> Result<ScanSummaryRecord, PersistenceError> {
        scans_dao::set_scan_archived(self, scan_id, archived).await
    }
    async fn reorder_scans(
        &self,
        ordered_scan_ids: &[String],
    ) -> Result<Vec<ScanSummaryRecord>, PersistenceError> {
        scans_dao::reorder_scans(self, ordered_scan_ids).await
    }
    async fn set_project_password(
        &self,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        security_dao::set_project_password(self, new_password).await
    }
    async fn change_project_password(
        &self,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        security_dao::change_project_password(self, current_password, new_password).await
    }
    async fn remove_project_password(
        &self,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError> {
        security_dao::remove_project_password(self, current_password).await
    }
}
