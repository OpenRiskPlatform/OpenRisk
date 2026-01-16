use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;
use uuid::Uuid;

// TODO: Create proper interface for updating project settings

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Project.ts")]
pub struct Project {
    id: Uuid,
    name: String,
    pub settings: ProjectSettings,
    plugin_settings: Vec<ProjectPluginSettings>,
}

impl Project {
    pub(crate) fn new(name: impl ToString, settings: ProjectSettings) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            settings,
            plugin_settings: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
pub struct ProjectSettings {
    pub description: String,
    pub locale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ProjectPluginSettings {
    id: String,
    version: String,
    settings: Value,
}
