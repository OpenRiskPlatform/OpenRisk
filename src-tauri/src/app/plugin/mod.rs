//! Plugin subsystem: discovery, configuration, and execution of built-in plugins.
//!
//! Built-in plugins live in `src-tauri/plugins/<id>/` at compile time.
//! Each plugin directory must contain a `plugin.json` manifest and a TypeScript entrypoint.
//! The `plugins_root` path is also shared with the project module for plugin sync.

mod runtime;
pub mod types;

pub use types::{PluginDetail, PluginSummary};

use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const SETTINGS_FILE: &str = "settings.json";
const PLUGIN_MANIFEST_FILE: &str = "plugin.json";

/// Root directory that contains all built-in plugin subdirectories.
pub fn plugins_root() -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("plugins");
    path
}

/// Resolve the directory for a specific plugin by its ID.
fn plugin_dir(plugin_id: &str) -> Result<PathBuf, String> {
    let mut path = plugins_root();
    path.push(plugin_id);
    if !path.exists() {
        return Err(format!("Plugin directory not found: {:?}", path));
    }
    Ok(path)
}

/// Load and validate `plugin.json` inside `dir`.
pub fn read_manifest(dir: &Path) -> Result<OpenRiskPluginManifest, String> {
    let manifest_path = dir.join(PLUGIN_MANIFEST_FILE);
    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest {:?}: {}", manifest_path, e))?;
    parse_manifest(&content).map_err(|e| e.to_string())
}

/// Read persisted settings for a plugin, falling back to manifest defaults when absent.
fn read_settings(dir: &Path, manifest: &OpenRiskPluginManifest) -> Result<Value, String> {
    let settings_path = dir.join(SETTINGS_FILE);
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings {:?}: {}", settings_path, e))?;
        return serde_json::from_str(&content)
            .map_err(|e| format!("Invalid settings JSON {:?}: {}", settings_path, e));
    }
    let mut obj = serde_json::Map::new();
    for s in &manifest.settings {
        if let Some(default) = &s.default {
            obj.insert(s.name.to_string(), default.clone());
        }
    }
    Ok(Value::Object(obj))
}

/// Return lightweight summaries for all installed built-in plugins.
pub fn list_plugins() -> Result<Vec<PluginSummary>, String> {
    let root = plugins_root();
    if !root.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&root)
        .map_err(|e| format!("Failed to read plugins dir: {}", e))?
        .flatten()
    {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        match read_manifest(&path) {
            Ok(m) => out.push(PluginSummary {
                id: entry.file_name().to_string_lossy().to_string(),
                name: m.name.to_string(),
                version: m.version.to_string(),
                description: m.description.to_string(),
                icon: m.icon.as_ref().map(|s| s.to_string()),
            }),
            Err(err) => eprintln!("Skipping plugin {:?}: {}", path, err),
        }
    }
    Ok(out)
}

/// Parse and validate a manifest file at an arbitrary path (used in the import flow).
pub fn open_plugin_manifest(file_path: &Path) -> Result<OpenRiskPluginManifest, String> {
    if !file_path.exists() {
        return Err(format!("Plugin file not found: {:?}", file_path));
    }
    if !file_path.is_file() {
        return Err(format!(
            "Expected plugin manifest file, got directory: {:?}",
            file_path
        ));
    }
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read plugin file {:?}: {}", file_path, e))?;
    parse_manifest(&content).map_err(|e| e.to_string())
}

/// Fetch the full detail record for an installed plugin (manifest + current settings).
pub fn get_plugin(plugin_id: &str) -> Result<PluginDetail, String> {
    let dir = plugin_dir(plugin_id)?;
    let manifest = read_manifest(&dir)?;
    let settings = read_settings(&dir, &manifest)?;
    Ok(PluginDetail {
        id: plugin_id.to_string(),
        manifest,
        settings,
    })
}

/// Write updated settings to disk for an installed plugin.
pub fn configure_plugin(plugin_id: &str, new_settings: Value) -> Result<(), String> {
    let dir = plugin_dir(plugin_id)?;
    if !new_settings.is_object() {
        return Err("Settings must be a JSON object".to_string());
    }
    let path = dir.join(SETTINGS_FILE);
    let data = serde_json::to_string_pretty(&new_settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write settings {:?}: {}", path, e))
}

/// Execute plugin source code directly (used by the scan runner with code stored in the DB).
///
/// Returns `(result, logs)`.
pub fn execute_plugin_code_with_settings(
    code: String,
    inputs: Value,
    settings: Value,
    entrypoint_fn: Option<String>,
) -> Result<(Value, Value), String> {
    let mut merged = match inputs {
        Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(s) = settings {
        for (k, v) in s {
            merged.insert(k, v);
        }
    }
    let fn_name = entrypoint_fn.as_deref().unwrap_or("default");
    runtime::run_plugin_module(code, Value::Object(merged), fn_name)
}

/// Call the optional `validate(settings)` export to confirm a plugin is ready to run.
///
/// Returns `{ ok: true }` when no `validate` export exists.
pub fn check_plugin_readiness(plugin_id: &str, settings: Value) -> Result<Value, String> {
    let dir = plugin_dir(plugin_id)?;
    let manifest = read_manifest(&dir)?;
    let code_path = dir.join(manifest.entrypoint.to_string());
    let code = fs::read_to_string(&code_path)
        .map_err(|e| format!("Failed to read plugin code {:?}: {}", code_path, e))?;
    let settings_json = serde_json::to_string(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    runtime::run_validate_module(code, settings_json)
}
