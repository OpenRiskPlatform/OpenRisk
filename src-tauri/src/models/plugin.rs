use std::{fs, path::PathBuf};

use derive_more::Deref;
use rustyscript::{
    deno_core::{error::ModuleLoaderError, ModuleSpecifier, RequestedModuleType, ResolutionKind},
    module_loader::ImportProvider,
    Module, Runtime, RuntimeOptions,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::models::project::ProjectId;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct Plugin {
    pub id: PluginId,
    pub name: String,
    pub version: String,
    pub description: String,
    pub authors: Vec<String>,
    pub license: String,
    pub entrypoint: String,
    pub default_settings: PluginSettings,
    pub inputs: PluginInputs,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginId(pub String);

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginSettings(Vec<PluginSetting>);

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginSetting {
    name: String,
    value: PluginSettingValue,
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
#[serde(rename_all = "lowercase")]
pub enum PluginSettingValue {
    String(String),
    Number(i64),
    Float(f64),
    Toggle(bool),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginInputs(Vec<PluginInput>);

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginInput {
    name: String,
    optional: bool,
    input_type: PluginInputType,
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
#[serde(rename_all = "lowercase")]
pub enum PluginInputType {
    String(Option<String>),
    Number(Option<i64>),
    Switch(Vec<PluginSwitchOption>),
    Toggle(Option<bool>),
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginSwitchOption {
    name: String,
    extra_inputs: Vec<PluginInput>,
}

#[derive(Deref, Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct InstalledPlugin {
    #[deref]
    plugin: Plugin,
    enabled: bool,
    pub settings: Vec<ProjectPluginSettings>,
    pub installation_path: PathBuf,
}

#[derive(Deref, Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct ProjectPluginSettings {
    pub project_id: ProjectId,
    #[deref]
    pub settings: PluginSettings,
}

impl InstalledPlugin {
    pub fn execute(&self, input: PluginInputs) -> Result<Value, String> {
        let entry = self.installation_path.join(&self.entrypoint);
        let code = fs::read_to_string(&entry)
            .map_err(|e| format!("Failed to read plugin code {:?}: {}", &entry, e))?;
        let input = serde_json::to_value(input)
            .map_err(|e| format!("Failed to deserialize input: {}", e))?;

        // Wrapper module code
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
            input
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

    fn post_process(
        &mut self,
        _specifier: &ModuleSpecifier,
        source: rustyscript::deno_core::ModuleSource,
    ) -> Result<
        rustyscript::deno_core::ModuleSource,
        rustyscript::deno_core::error::ModuleLoaderError,
    > {
        Ok(source)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn plugin_json_roundtrip() {
        let plugin = Plugin {
            id: PluginId("example.plugin".to_string()),
            name: "Example Plugin".to_string(),
            version: "1.0.0".to_string(),
            description: "Test plugin".to_string(),
            authors: vec!["Test Author".to_string()],
            license: "MIT".to_string(),
            entrypoint: "index.ts".to_string(),
            default_settings: PluginSettings(vec![PluginSetting {
                name: "example_setting".to_string(),
                value: PluginSettingValue::String("Default setting".to_string()),
                description: "A test setting".to_string(),
            }]),
            inputs: PluginInputs(vec![
                PluginInput {
                    name: "name".to_string(),
                    optional: false,
                    input_type: PluginInputType::String(None),
                    description: "Name of the person to search for".to_string(),
                },
                PluginInput {
                    name: "enabled".to_string(),
                    optional: true,
                    input_type: PluginInputType::Toggle(Some(true)),
                    description: "Enable feature".to_string(),
                },
                PluginInput {
                    name: "switch".to_string(),
                    optional: true,
                    input_type: PluginInputType::Switch(vec![
                        PluginSwitchOption {
                            name: "endpoint 1".to_string(),
                            extra_inputs: vec![],
                        },
                        PluginSwitchOption {
                            name: "endpoint 2".to_string(),
                            extra_inputs: vec![PluginInput {
                                name: "age".to_string(),
                                optional: false,
                                input_type: PluginInputType::Number(None),
                                description: "User name".to_string(),
                            }],
                        },
                    ]),
                    description: "Endpoint to use for the search".to_string(),
                },
            ]),
        };

        let path = PathBuf::from("./schemas/example_plugin_schema.json");

        // Serialize and save
        let json = serde_json::to_string_pretty(&plugin).unwrap();
        fs::write(&path, json).unwrap();

        // Read file
        let contents = fs::read_to_string(&path).unwrap();

        // Deserialize
        let loaded: Plugin = serde_json::from_str(&contents).unwrap();

        // Verify fields
        assert_eq!(plugin.id.0, loaded.id.0);
        assert_eq!(plugin.name, loaded.name);
        assert_eq!(plugin.version, loaded.version);
        assert_eq!(plugin.description, loaded.description);
        assert_eq!(plugin.entrypoint, loaded.entrypoint);
        assert_eq!(plugin.authors, loaded.authors);

        // Cleanup
        // fs::remove_file(path).unwrap();
    }
}
