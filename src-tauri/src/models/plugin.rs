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

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct Plugin {
    id: PluginId,
    name: String,
    version: String,
    description: String,
    authors: Vec<String>,
    license: String,
    entrypoint: String,
    pub default_settings: PluginSettings,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginId(String);

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct PluginSettings {
    enabled: bool,
}

#[derive(Deref, Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/Plugin.ts")]
pub struct InstalledPlugin {
    #[deref]
    plugin: Plugin,
    pub settings: PluginSettings,
    pub installation_path: PathBuf,
}

impl InstalledPlugin {
    pub fn execute(&self, input: Value) -> Result<Value, String> {
        let entry = self.installation_path.join(&self.entrypoint);
        let code = fs::read_to_string(&entry)
            .map_err(|e| format!("Failed to read plugin code {:?}: {}", &entry, e))?;

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
