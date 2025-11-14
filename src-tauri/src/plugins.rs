use rustyscript::{
    Module, Runtime, RuntimeOptions
};
use std::fs;
use std::path::PathBuf;
use serde_json::Value;

// Do we need this function?
#[tauri::command]
pub(crate) fn execute(_code: String) -> Result<String, String> {
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

    let mut runtime = Runtime::new(RuntimeOptions::default())
        .expect("Failed to create runtime");

    match runtime.load_module(&wrapper) {
        Ok(handle) => runtime
            .call_entrypoint::<String>(&handle, &())
            .map_err(|e| e.to_string()),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub(crate) fn execute_plugin(
    plugin_id: String, 
    inputs_json: String, 
    settings_json: String
) -> Result<String, String> {
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
    
    let mut runtime = Runtime::new(RuntimeOptions::default())
        .expect("Failed to create runtime");

    // This is needed to allow for relative imports
    runtime.set_current_dir(plugin_dir).unwrap();
    // println!("Current runtime director: {:?}", runtime.current_dir());

    let module = Module::new("index.ts", code);

    match runtime.load_module(&module) {
        Ok(handle) => {
            let result = runtime
                .call_entrypoint::<Value>(&handle, &inputs)
                .map_err(|e| e.to_string())?;
            
            serde_json::to_string(&result)
                .map_err(|e| format!("Failed to serialize result: {}", e))
        },
        Err(err) => {
            println!("{:?}", err);
            Err(err.to_string())
        },
    }
}

pub(crate) fn get_plugin_dir(plugin_id: &str) -> Result<PathBuf, String> {
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
pub(crate) fn list_plugins() -> Result<String, String> {
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