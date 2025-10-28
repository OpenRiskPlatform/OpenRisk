use rustyscript::{
    deno_core::{error::ModuleLoaderError, ModuleSpecifier, RequestedModuleType, ResolutionKind}, module_loader::ImportProvider, Module, Runtime, RuntimeOptions
};
use std::fs;
use std::path::PathBuf;
use serde_json::Value;

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

#[tauri::command]
fn execute(code: String) -> Result<String, String> {
    let wrapper = Module::new(
        "index.js",
        r#"
        import mod from "script://main.ts";
        export default async () => {
            if (typeof mod !== 'function') {
                throw new TypeError("The script must export a function named 'default'");
            }
            return Deno.inspect(await mod()); // To prettify the output
        }
        "#
    );

    let import_provider = ScriptImportProvider::new(code);
    let mut runtime = Runtime::new(RuntimeOptions {
        import_provider: Some(Box::new(import_provider)),
        ..Default::default()
    })
    .expect("Failed to create runtime");

    match runtime.load_module(&wrapper) {
        Ok(handle) => runtime
            .call_entrypoint::<String>(&handle, &())
            .map_err(|e| e.to_string()),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn execute_plugin(plugin_id: String, inputs_json: String, settings_json: String) -> Result<String, String> {
    // Get the plugin directory
    let plugin_dir = get_plugin_dir(&plugin_id)?;
    
    // Read plugin code
    let code_path = plugin_dir.join("index.ts");
    let code = fs::read_to_string(&code_path)
        .map_err(|e| format!("Failed to read plugin code: {}", e))?;

    // Parse inputs and settings
    let mut inputs: Value = serde_json::from_str(&inputs_json)
        .map_err(|e| format!("Invalid inputs JSON: {}", e))?;
    let settings: Value = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Invalid settings JSON: {}", e))?;

    // Merge settings into inputs
    if let (Some(inputs_obj), Some(settings_obj)) = (inputs.as_object_mut(), settings.as_object()) {
        for (key, value) in settings_obj {
            inputs_obj.insert(key.clone(), value.clone());
        }
    }

    let merged_inputs = serde_json::to_string(&inputs)
        .map_err(|e| format!("Failed to serialize merged inputs: {}", e))?;

    // Create wrapper that passes inputs to the plugin function
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
        Ok(handle) => {
            let result = runtime
                .call_entrypoint::<Value>(&handle, &())
                .map_err(|e| e.to_string())?;
            
            serde_json::to_string(&result)
                .map_err(|e| format!("Failed to serialize result: {}", e))
        },
        Err(err) => Err(err.to_string()),
    }
}

fn get_plugin_dir(plugin_id: &str) -> Result<PathBuf, String> {
    // In development, plugins are in src-tauri/plugins
    // In production, they would be in a different location
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("plugins");
    path.push(plugin_id);

    if !path.exists() {
        return Err(format!("Plugin directory not found: {:?}", path));
    }

    Ok(path)
}

#[tauri::command]
fn list_plugins() -> Result<String, String> {
    let mut plugins_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    plugins_dir.push("plugins");

    if !plugins_dir.exists() {
        return Ok("[]".to_string());
    }

    let mut plugins = Vec::new();

    match fs::read_dir(&plugins_dir) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_dir() {
                        // Try to read plugin.json
                        let manifest_path = path.join("plugin.json");
                        if manifest_path.exists() {
                            match fs::read_to_string(&manifest_path) {
                                Ok(manifest_content) => {
                                    // Parse and add plugin ID
                                    if let Ok(mut manifest) = serde_json::from_str::<Value>(&manifest_content) {
                                        if let Some(plugin_name) = entry.file_name().to_str() {
                                            if let Some(obj) = manifest.as_object_mut() {
                                                obj.insert("id".to_string(), Value::String(plugin_name.to_string()));
                                            }
                                        }
                                        plugins.push(manifest);
                                    }
                                }
                                Err(e) => eprintln!("Failed to read manifest for {:?}: {}", path, e),
                            }
                        }
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read plugins directory: {}", e)),
    }

    serde_json::to_string(&plugins)
        .map_err(|e| format!("Failed to serialize plugins: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![execute, execute_plugin, list_plugins])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
