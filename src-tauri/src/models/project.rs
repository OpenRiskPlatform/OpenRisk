use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::models::plugin::{PluginId, PluginSettings};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Project.ts")]
pub struct Project {
    pub id: ProjectId,
    pub name: String,
    pub settings: ProjectSettings,
    pub plugin_settings: Vec<ProjectPluginSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[ts(export, export_to = "../../src/bindings/Project.ts")]
pub struct ProjectId(Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[ts(export, export_to = "../../src/bindings/Project.ts")]
pub struct ProjectSettings {
    pub description: String,
    pub locale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Project.ts")]
pub struct ProjectPluginSettings {
    id: PluginId,
    settings: PluginSettings,
}

impl Project {
    pub(crate) fn new(name: impl ToString, settings: ProjectSettings) -> Self {
        Self {
            id: ProjectId(Uuid::new_v4()),
            name: name.to_string(),
            settings,
            plugin_settings: Vec::new(),
        }
    }

    /// Configure project settings
    pub(crate) fn configure_settings(&mut self, settings: ProjectSettings) {
        self.settings = settings;
    }

    /// Change project-specific plugin settings
    pub(crate) fn configure_plugin(&mut self, settings: ProjectPluginSettings) {
        for plugin_settings in self.plugin_settings.iter_mut() {
            if plugin_settings.id == settings.id {
                *plugin_settings = settings;
                break;
            }
        }
    }

    /// Plugin settings specific to the current project
    pub(crate) fn plugin_settings(&self, plugin_id: PluginId) -> Option<PluginSettings> {
        for settings in &self.plugin_settings {
            if settings.id == plugin_id {
                return Some(settings.settings.clone());
            }
        }
        None
    }
}
