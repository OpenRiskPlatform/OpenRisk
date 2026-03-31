//! Plugin source abstraction and local filesystem implementation.
//!
//! [`PluginSource`] is the trait for discovering plugin bundles from any origin.
//! Currently only [`LocalPluginSource`] (built-in `src-tauri/plugins/`) is implemented;
//! additional sources (GitHub releases, HTTP registries, etc.) implement the same trait.

use crate::app::plugin::plugins_root;
use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest};
use async_trait::async_trait;
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
    pub code: String,
}

/// Abstraction over the origin of a plugin bundle.
///
/// Implement this trait to add new plugin sources: local directory, GitHub releases,
/// HTTP registries, etc. The scan runner and project sync use this to load plugins
/// without coupling to a specific source.
#[allow(dead_code)]
#[async_trait]
pub trait PluginSource: Send + Sync {
    /// Discover all available plugin bundles from this source.
    async fn discover(&self) -> Result<Vec<LocalPluginBundle>, PersistenceError>;
}

/// Loads plugins from the built-in `plugins/` directory compiled into the binary.
#[allow(dead_code)]
pub struct LocalPluginSource;

#[async_trait]
impl PluginSource for LocalPluginSource {
    async fn discover(&self) -> Result<Vec<LocalPluginBundle>, PersistenceError> {
        discover_local_plugins()
    }
}

/// Scan the built-in plugins directory and return a bundle for every valid plugin found.
pub fn discover_local_plugins() -> Result<Vec<LocalPluginBundle>, PersistenceError> {
    let root = plugins_root();
    if !root.exists() {
        return Ok(vec![]);
    }
    let mut bundles = Vec::new();
    for entry in fs::read_dir(&root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        match load_plugin_bundle(&path) {
            Ok(bundle) => bundles.push(bundle),
            Err(err) => eprintln!("Skipping plugin {:?}: {}", path, err),
        }
    }
    Ok(bundles)
}

/// Load a [`LocalPluginBundle`] from a directory, using the directory name as the plugin ID.
///
/// Uses strict manifest validation; suited for built-in plugins.
pub fn load_plugin_bundle(dir: &Path) -> Result<LocalPluginBundle, PersistenceError> {
    let plugin_id = dir
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .ok_or_else(|| PersistenceError::Validation("Invalid plugin directory".into()))?;

    let manifest_path = dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin manifest: {:?}",
            manifest_path
        )));
    }

    let manifest_raw = fs::read_to_string(&manifest_path)?;
    let manifest =
        parse_manifest(&manifest_raw).map_err(|e| PersistenceError::Validation(e.to_string()))?;

    let code_path = dir.join(manifest.entrypoint.clone().to_string());
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
        code,
    })
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

    let code_path = dir.join(manifest.entrypoint.clone().to_string());
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
        code,
    })
}

/// Load a [`LocalPluginBundle`] from a `.zip` archive.
///
/// The zip must contain `plugin.json` and the entrypoint file at its root.
/// Pass `plugin_id_override` to replace the id embedded in the manifest.
pub fn load_plugin_bundle_from_zip(
    zip_path: &Path,
    plugin_id_override: Option<String>,
) -> Result<LocalPluginBundle, PersistenceError> {
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

    let manifest =
        parse_manifest_relaxed(&manifest_raw).map_err(|e| PersistenceError::Validation(e))?;

    let plugin_id = plugin_id_override.unwrap_or_else(|| {
        serde_json::from_str::<Value>(&manifest_raw)
            .ok()
            .and_then(|v| {
                v.get("id")
                    .and_then(|s| s.as_str())
                    .map(|s| s.trim().to_string())
            })
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                zip_path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "plugin".to_string())
            })
    });

    let entrypoint = manifest.entrypoint.clone().to_string();
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
        code,
    })
}

/// Extract the `id` field directly from a `plugin.json` without full schema validation.
pub fn extract_manifest_id(dir: &Path) -> Result<String, PersistenceError> {
    let manifest_path = dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(PersistenceError::Validation(format!(
            "Missing plugin manifest: {:?}",
            manifest_path
        )));
    }
    let raw = fs::read_to_string(&manifest_path)?;
    let value: Value = serde_json::from_str(&raw)?;
    value
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            PersistenceError::Validation("Manifest must contain non-empty id".to_string())
        })
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
/// Tolerates manifests that omit `license`, `authors`, `entrypoint`, `settings`, or `inputs`.
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
    if !obj.contains_key("entrypoint") {
        obj.insert(
            "entrypoint".to_string(),
            Value::String("index.ts".to_string()),
        );
    }
    if !obj.contains_key("settings") {
        obj.insert("settings".to_string(), Value::Array(vec![]));
    }
    if !obj.contains_key("inputs") {
        obj.insert("inputs".to_string(), Value::Array(vec![]));
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

/// Compute the full path to a sidecar file (WAL, SHM, or backup) next to `db_path`.
pub fn sidecar_path(db_path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", db_path.to_string_lossy(), suffix))
}
