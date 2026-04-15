//! Plugin loading helpers for explicit plugin import actions.

use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest, PluginFieldType};
use serde_json::{json, Value};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use super::types::PersistenceError;

/// An in-memory bundle of a plugin's manifest and source code, ready to be stored in the DB.
#[derive(Debug, Clone)]
pub struct LocalPluginBundle {
    pub id: String,
    pub manifest: OpenRiskPluginManifest,
    pub metric_defs: Vec<PluginMetricDef>,
    pub update_metrics_fn: Option<String>,
    pub code: String,
}

/// Runtime metric definition extracted from plugin manifest `metrics`.
#[derive(Debug, Clone)]
pub struct PluginMetricDef {
    pub name: String,
    pub title: String,
    pub type_: PluginFieldType,
    pub description: Option<String>,
}

///
/// Uses relaxed manifest validation to tolerate missing optional fields; suited for user imports.
pub fn load_plugin_bundle_with_id(
    dir: &Path,
    plugin_id: String,
) -> Result<LocalPluginBundle, PersistenceError> {
    let manifest_path = dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin manifest: {:?}",
            manifest_path
        )));
    }

    let manifest_raw = fs::read_to_string(&manifest_path)?;
    let manifest = parse_manifest_relaxed(&manifest_raw)
        .map_err(|e| PersistenceError::Validation(e.to_string()))?;
    let metric_defs = metric_defs_from_manifest(&manifest).map_err(PersistenceError::Validation)?;
    let update_metrics_fn = manifest.update_metrics_fn.clone().map(Into::into);

    let code_path = dir.join(manifest.main.clone().to_string());
    if !code_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin entrypoint file: {:?}",
            code_path
        )));
    }
    let code = fs::read_to_string(code_path)?;

    Ok(LocalPluginBundle {
        id: plugin_id,
        manifest,
        metric_defs,
        update_metrics_fn,
        code,
    })
}

/// Load a [`LocalPluginBundle`] from a `.zip` archive.
///
/// The zip must contain `plugin.json` and the entrypoint file at its root.
pub fn load_plugin_bundle_from_zip(zip_path: &Path) -> Result<LocalPluginBundle, PersistenceError> {
    let file = fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| PersistenceError::Validation(format!("Invalid zip archive: {}", e)))?;

    let manifest_raw = {
        let mut entry = archive
            .by_name("plugin.json")
            .map_err(|_| PersistenceError::Validation("Zip is missing plugin.json".into()))?;
        let mut s = String::new();
        entry.read_to_string(&mut s)?;
        s
    };

    let manifest = parse_manifest_relaxed(&manifest_raw).map_err(PersistenceError::Validation)?;
    let metric_defs = metric_defs_from_manifest(&manifest).map_err(PersistenceError::Validation)?;
    let update_metrics_fn = manifest.update_metrics_fn.clone().map(Into::into);

    let plugin_id: String = manifest.id.clone().into();

    let entrypoint = manifest.main.clone().to_string();
    let code = {
        let mut entry = archive.by_name(&entrypoint).map_err(|_| {
            PersistenceError::Validation(format!("Zip is missing entrypoint file: {}", entrypoint))
        })?;
        let mut s = String::new();
        entry.read_to_string(&mut s)?;
        s
    };

    Ok(LocalPluginBundle {
        id: plugin_id,
        manifest,
        metric_defs,
        update_metrics_fn,
        code,
    })
}

/// Extract plugin `id` from `plugin.json` via generated manifest types.
pub fn extract_manifest_id(dir: &Path) -> Result<String, PersistenceError> {
    let manifest_path = dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin manifest: {:?}",
            manifest_path
        )));
    }
    let raw = fs::read_to_string(&manifest_path)?;
    let manifest =
        parse_manifest_relaxed(&raw).map_err(|e| PersistenceError::Validation(e.to_string()))?;
    Ok(manifest.id.into())
}

/// Build a list of default setting values from a manifest's `settings` array.
pub fn build_default_settings(
    manifest: &OpenRiskPluginManifest,
) -> Vec<super::types::PluginSettingValue> {
    manifest
        .settings
        .iter()
        .map(|s| {
            let value =
                super::types::SettingValue::from_json(&s.default.clone().unwrap_or(Value::Null));
            super::types::PluginSettingValue {
                name: s.name.to_string(),
                value,
            }
        })
        .collect()
}

/// Parse a plugin manifest, filling in commonly missing optional fields when strict validation fails.
///
/// Tolerates manifests that omit `license`, `authors`, `main`, or `settings`.
/// Entrypoints remain mandatory and must be explicitly declared in plugin.json.
pub fn parse_manifest_relaxed(raw: &str) -> Result<OpenRiskPluginManifest, String> {
    if let Ok(parsed) = parse_manifest(raw) {
        return Ok(parsed);
    }

    let mut value: Value =
        serde_json::from_str(raw).map_err(|e| format!("Invalid plugin.json: {}", e))?;
    let obj = value
        .as_object_mut()
        .ok_or_else(|| "plugin.json must be a JSON object".to_string())?;

    if !obj.contains_key("license") {
        obj.insert("license".to_string(), Value::String("MIT".to_string()));
    }
    if !obj.contains_key("main") {
        obj.insert("main".to_string(), Value::String("index.ts".to_string()));
    }
    if !obj.contains_key("settings") {
        obj.insert("settings".to_string(), Value::Array(vec![]));
    }
    if !obj.contains_key("entrypoints") {
        obj.insert("entrypoints".to_string(), Value::Array(vec![]));
    }
    if !obj.contains_key("authors") {
        obj.insert(
            "authors".to_string(),
            Value::Array(vec![
                json!({ "name": "Unknown", "email": "unknown@example.com" }),
            ]),
        );
    }

    let normalized = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    parse_manifest(&normalized).map_err(|e| e.to_string())
}

fn metric_defs_from_manifest(
    manifest: &OpenRiskPluginManifest,
) -> Result<Vec<PluginMetricDef>, String> {
    let mut names = std::collections::HashSet::new();
    let mut defs = Vec::with_capacity(manifest.metrics.len());
    for metric in &manifest.metrics {
        let name: String = metric.name.clone().into();
        if !names.insert(name.clone()) {
            return Err(format!("Duplicate metric name '{}'", name));
        }
        defs.push(PluginMetricDef {
            name,
            title: metric.title.clone(),
            type_: metric.type_.clone(),
            description: metric.description.clone(),
        });
    }

    Ok(defs)
}

/// Download and parse a plugin from a remote `plugin.json` URL.
///
/// Fetches the manifest from `manifest_url`, derives the base URL (directory),
/// then fetches the `main` entrypoint file from the same base directory.
pub async fn load_plugin_bundle_from_url(
    manifest_url: &str,
) -> Result<LocalPluginBundle, PersistenceError> {
    let manifest_raw = reqwest::get(manifest_url)
        .await
        .map_err(|e| PersistenceError::Http(e.to_string()))?
        .error_for_status()
        .map_err(|e| PersistenceError::Http(format!("Failed to fetch manifest: {}", e)))?
        .text()
        .await
        .map_err(|e| PersistenceError::Http(e.to_string()))?;

    let manifest = parse_manifest_relaxed(&manifest_raw).map_err(PersistenceError::Validation)?;
    let plugin_id: String = manifest.id.clone().into();
    let metric_defs = metric_defs_from_manifest(&manifest).map_err(PersistenceError::Validation)?;
    let update_metrics_fn = manifest.update_metrics_fn.clone().map(Into::into);

    // Derive base URL: everything up to and including the last '/'
    let base_url = manifest_url
        .rfind('/')
        .map(|i| &manifest_url[..=i])
        .unwrap_or(manifest_url);
    let main_url = format!("{}{}", base_url, &*manifest.main);

    let code = reqwest::get(&main_url)
        .await
        .map_err(|e| PersistenceError::Http(e.to_string()))?
        .error_for_status()
        .map_err(|e| PersistenceError::Http(format!("Failed to fetch plugin main file: {}", e)))?
        .text()
        .await
        .map_err(|e| PersistenceError::Http(e.to_string()))?;

    Ok(LocalPluginBundle {
        id: plugin_id,
        manifest,
        metric_defs,
        update_metrics_fn,
        code,
    })
}

/// Compute the full path to a sidecar file (WAL, SHM, or backup) next to `db_path`.
pub fn sidecar_path(db_path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", db_path.to_string_lossy(), suffix))
}
