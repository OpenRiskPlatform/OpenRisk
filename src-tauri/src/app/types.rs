use crate::app::errors::PersistenceResult;
use crate::plugin_manifest::OpenRiskPluginManifest;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};

// Project domain

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub audit: Option<String>,
    pub directory: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsRecord {
    pub id: String,
    pub description: String,
    pub locale: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettingsPayload {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest: Value,
    pub input_schema: Value,
    pub settings_schema: Value,
    pub settings: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsPayload {
    pub project: ProjectSummary,
    pub project_settings: ProjectSettingsRecord,
    pub plugins: Vec<PluginSettingsPayload>,
}

#[async_trait]
pub trait ProjectPersistence: Send + Sync {
    async fn create_project(
        &self,
        name: &str,
        parent_dir: &Path,
    ) -> PersistenceResult<ProjectSummary>;

    async fn open_project(&self, project_dir: &Path) -> PersistenceResult<ProjectSummary>;

    async fn load_settings(&self, project_dir: &Path) -> PersistenceResult<ProjectSettingsPayload>;
}

// Plugin domain

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDetail {
    pub id: String,
    pub manifest: OpenRiskPluginManifest,
    pub settings: Value,
}

#[derive(Debug, Clone)]
pub struct PluginRuntimeBundle {
    pub manifest: OpenRiskPluginManifest,
    pub settings: Value,
    pub code: String,
}

pub trait PluginPersistence: Send + Sync {
    fn list_plugins(&self) -> PersistenceResult<Vec<PluginSummary>>;
    fn get_plugin(&self, plugin_id: &str) -> PersistenceResult<PluginDetail>;
    fn save_plugin_settings(&self, plugin_id: &str, settings: Value) -> PersistenceResult<()>;
    fn open_plugin_manifest(&self, file_path: &Path) -> PersistenceResult<OpenRiskPluginManifest>;
    fn load_runtime_bundle(&self, plugin_id: &str) -> PersistenceResult<PluginRuntimeBundle>;
}
