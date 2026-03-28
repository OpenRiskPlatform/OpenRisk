//! Plugin domain types returned to the Tauri frontend.

use crate::plugin_manifest::OpenRiskPluginManifest;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Lightweight summary of an installed plugin, shown in list views.
#[derive(Debug, Serialize, Deserialize)]
pub struct PluginSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Full plugin record: manifest metadata plus current settings values.
#[derive(Debug, Serialize, Deserialize)]
pub struct PluginDetail {
    pub id: String,
    pub manifest: OpenRiskPluginManifest,
    pub settings: Value,
}
