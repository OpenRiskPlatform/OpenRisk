use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest};
use rustyscript::{
    deno_core::{error::ModuleLoaderError, ModuleSpecifier, RequestedModuleType, ResolutionKind},
    module_loader::ImportProvider,
    Module, Runtime, RuntimeOptions,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const SETTINGS_FILE: &str = "settings.json";
const PLUGIN_MANIFEST_FILE: &str = "plugin.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginDetail {
    pub id: String,
    pub manifest: OpenRiskPluginManifest,
    pub settings: Value,
}

fn plugins_root() -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("plugins");
    path
}

fn plugin_dir(plugin_id: &str) -> Result<PathBuf, String> {
    let mut path = plugins_root();
    path.push(plugin_id);
    if !path.exists() {
        return Err(format!("Plugin directory not found: {:?}", path));
    }
    Ok(path)
}

fn read_manifest(dir: &Path) -> Result<OpenRiskPluginManifest, String> {
    let manifest_path = dir.join(PLUGIN_MANIFEST_FILE);
    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest {:?}: {}", manifest_path, e))?;
    parse_manifest(&content).map_err(|e| e.to_string())
}

fn read_settings(dir: &Path, manifest: &OpenRiskPluginManifest) -> Result<Value, String> {
    let settings_path = dir.join(SETTINGS_FILE);
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings {:?}: {}", settings_path, e))?;
        let value: Value = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid settings JSON {:?}: {}", settings_path, e))?;
        return Ok(value);
    }
    // Build defaults from manifest if no file
    let mut obj = serde_json::Map::new();
    for s in &manifest.settings {
        if let Some(default) = &s.default {
            obj.insert(s.name.to_string(), default.clone());
        }
    }
    Ok(Value::Object(obj))
}

pub fn list_plugins() -> Result<Vec<PluginSummary>, String> {
    let root = plugins_root();
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut out = Vec::new();
    let entries = fs::read_dir(&root).map_err(|e| format!("Failed to read plugins dir: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        // Load manifest
        match read_manifest(&path) {
            Ok(m) => {
                let id = entry.file_name().to_string_lossy().to_string();
                out.push(PluginSummary {
                    id,
                    name: m.name.to_string(),
                    version: m.version.to_string(),
                    description: m.description.to_string(),
                    icon: m.icon.as_ref().map(|s| s.to_string()),
                });
            }
            Err(err) => {
                eprintln!("Skipping plugin {:?}: {}", path, err);
            }
        }
    }
    Ok(out)
}

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

pub fn configure_plugin(plugin_id: &str, new_settings: Value) -> Result<(), String> {
    let dir = plugin_dir(plugin_id)?;
    // Ensure settings is an object
    if !new_settings.is_object() {
        return Err("Settings must be a JSON object".to_string());
    }
    let path = dir.join(SETTINGS_FILE);
    let data = serde_json::to_string_pretty(&new_settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write settings {:?}: {}", path, e))
}

// Local import provider for runtime
struct ScriptImportProvider {
    module_source: String,
    imported: bool,
    locked: bool,
}

impl ScriptImportProvider {
    fn new(code: String) -> Self {
        Self {
            module_source: code,
            imported: false,
            locked: false,
        }
    }
}

impl ImportProvider for ScriptImportProvider {
    fn resolve(
        &mut self,
        specifier: &ModuleSpecifier,
        _: &str,
        _: ResolutionKind,
    ) -> Option<Result<ModuleSpecifier, ModuleLoaderError>> {
        if !self.locked && specifier.to_string() == "script://main.ts" {
            if self.imported {
                self.locked = true;
            }
            Some(Ok(specifier.clone()))
        } else {
            None
        }
    }

    fn import(
        &mut self,
        specifier: &ModuleSpecifier,
        _: Option<&ModuleSpecifier>,
        _: bool,
        _: RequestedModuleType,
    ) -> Option<Result<String, ModuleLoaderError>> {
        if !self.imported && specifier.to_string() == "script://main.ts" {
            self.imported = true;
            Some(Ok(self.module_source.clone()))
        } else {
            None
        }
    }
}

fn run_plugin_module(code: String, merged_inputs: Value) -> Result<Value, String> {
    let wrapper_code = format!(
        r#"
        import mod from "script://main.ts";
        export default async () => {{
            if (typeof mod !== 'function') {{
                throw new TypeError("The plugin must export a default function");
            }}
            const inputs = {};
            const result = await mod(inputs);
            return result;
        }}
        "#,
        merged_inputs
    );

    let wrapper = Module::new("wrapper.js", &wrapper_code);
    let import_provider = ScriptImportProvider::new(code);
    let mut runtime = Runtime::new(RuntimeOptions {
        import_provider: Some(Box::new(import_provider)),
        ..Default::default()
    })
    .expect("Failed to create runtime");

    match runtime.load_module(&wrapper) {
        Ok(handle) => runtime
            .call_entrypoint::<Value>(&handle, &())
            .map_err(|e| e.to_string()),
        Err(err) => Err(err.to_string()),
    }
}

pub fn execute_plugin_code_with_settings(
    code: String,
    inputs: Value,
    settings: Value,
) -> Result<Value, String> {
    let mut merged = match inputs {
        Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(s) = settings {
        for (k, v) in s {
            merged.insert(k, v);
        }
    }

    run_plugin_module(code, Value::Object(merged))
}

pub fn execute_plugin_with_settings(
    plugin_id: &str,
    inputs: Value,
    settings_override: Option<Value>,
) -> Result<Value, String> {
    let dir = plugin_dir(plugin_id)?;
    let manifest = read_manifest(&dir)?;
    let settings = match settings_override {
        Some(value) if value.is_object() => value,
        Some(_) => return Err("Plugin settings must be a JSON object".to_string()),
        None => read_settings(&dir, &manifest)?,
    };

    let entry = manifest.entrypoint.to_string();
    let code_path = dir.join(entry);
    let code = fs::read_to_string(&code_path)
        .map_err(|e| format!("Failed to read plugin code {:?}: {}", code_path, e))?;

    let mut merged = match inputs {
        Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(s) = settings {
        for (k, v) in s {
            merged.insert(k, v);
        }
    }

    run_plugin_module(code, Value::Object(merged))
}
