//! Data-access layer for open project sessions.
//!
//! Method implementations are split by concern:
//! - [`settings_dao`] — project/plugin settings, plugin records
//! - [`scans_dao`]    — scan lifecycle: create, list, run, complete
//! - [`security_dao`] — password set / change / remove

mod helpers;
mod scans_dao;
mod security_dao;
mod settings_dao;

use crate::app::project::plugins::LocalPluginBundle;
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;
use async_trait::async_trait;

/// All CRUD operations available on an open project session.
#[async_trait]
pub trait ProjectPersistence: Send + Sync {
    /// Load the full settings snapshot (project + global settings + all plugin configs).
    async fn load_settings(&self) -> Result<ProjectSettingsPayload, PersistenceError>;
    /// Update the project-wide theme setting and optionally rename the project.
    async fn update_project_settings(
        &self,
        name: Option<String>,
        theme: Option<String>,
    ) -> Result<ProjectSettingsRecord, PersistenceError>;
    /// Set a single plugin setting value.
    async fn set_plugin_setting(
        &self,
        plugin_id: &str,
        setting_name: &str,
        value: SettingValue,
    ) -> Result<PluginRecord, PersistenceError>;
    /// Insert or update a plugin record (code + relational metadata) in the database.
    async fn save_plugin(&self, bundle: &LocalPluginBundle) -> Result<(), PersistenceError>;
    /// Return all setting values for a plugin in this project.
    async fn get_plugin_setting_values(
        &self,
        plugin_id: &str,
    ) -> Result<Vec<PluginSettingValue>, PersistenceError>;
    /// Upsert a batch of setting values for a plugin in this project.
    async fn save_plugin_setting_values(
        &self,
        plugin_id: &str,
        values: &[PluginSettingValue],
    ) -> Result<(), PersistenceError>;
    /// Fetch the full plugin record (defs + current settings) by plugin_id.
    async fn get_plugin_record(&self, plugin_id: &str) -> Result<PluginRecord, PersistenceError>;
    /// Create a new scan in Draft status.
    async fn create_scan(
        &self,
        preview: Option<String>,
    ) -> Result<ScanSummaryRecord, PersistenceError>;
    /// List all scans for the project, newest first.
    async fn list_scans(&self) -> Result<Vec<ScanSummaryRecord>, PersistenceError>;
    /// Fetch full details of a single scan including all plugin results.
    async fn get_scan(&self, scan_id: &str) -> Result<ScanDetailRecord, PersistenceError>;
    /// Mark a scan as Running, snapshot its inputs/selection, return execution context.
    async fn begin_scan_run(
        &self,
        scan_id: &str,
        selected_plugins: &[PluginEntrypointSelection],
        inputs: &[ScanEntrypointInput],
    ) -> Result<ScanRunContext, PersistenceError>;
    /// Persist the results of a completed scan and mark it Completed.
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
    /// Encrypt an unencrypted project with `new_password`.
    async fn set_project_password(
        &self,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;
    /// Re-encrypt the project with a new password.
    async fn change_project_password(
        &self,
        current_password: String,
        new_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;
    /// Remove project encryption.
    async fn remove_project_password(
        &self,
        current_password: String,
    ) -> Result<ProjectLockStatus, PersistenceError>;
}

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
