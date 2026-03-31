//! Plugin domain types returned to the Tauri frontend.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

/// Lightweight summary of an installed plugin, shown in list views.
#[derive(Debug, Serialize, Deserialize, Type)]
pub struct PluginSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub icon: Option<String>,
}

/// Full plugin record: manifest metadata plus current settings values.
#[derive(Debug, Serialize, Deserialize, Type)]
pub struct PluginDetail {
    pub id: String,
    pub manifest: Value,
    pub settings: Value,
}
