use crate::app::{PluginSettingsPayload, ProjectSettingsRecord, PersistenceResult};
use crate::persistence::constants::DEFAULT_LOCALE;
use crate::plugin_manifest::OpenRiskPluginManifest;
use serde_json::{Map, Value};
use sqlx::FromRow;

#[derive(Debug, Clone)]
pub struct LocalPluginBundle {
    pub id: String,
    pub manifest: OpenRiskPluginManifest,
    pub manifest_json: Value,
    pub code: String,
}

#[derive(FromRow)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub audit: Option<String>,
    pub project_settings_id: String,
}

#[derive(FromRow)]
pub struct ProjectSettingsRow {
    pub id: String,
    pub description: Option<String>,
    pub locale: Option<String>,
}

impl ProjectSettingsRow {
    pub fn into_record(self) -> ProjectSettingsRecord {
        ProjectSettingsRecord {
            id: self.id,
            description: self.description.unwrap_or_default(),
            locale: self.locale.unwrap_or_else(|| DEFAULT_LOCALE.to_string()),
        }
    }
}

#[derive(FromRow)]
pub struct PluginRow {
    pub plugin_id: String,
    pub plugin_name: String,
    pub plugin_version: String,
    pub input_schema_json: Option<String>,
    pub settings_schema_json: Option<String>,
    pub manifest_json: Option<String>,
    pub settings_json: Option<String>,
}

impl PluginRow {
    pub fn into_payload(self) -> PersistenceResult<PluginSettingsPayload> {
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

pub fn parse_json_text(raw: Option<String>) -> PersistenceResult<Value> {
    match raw {
        Some(text) if !text.trim().is_empty() => Ok(serde_json::from_str(&text)?),
        _ => Ok(Value::Null),
    }
}
