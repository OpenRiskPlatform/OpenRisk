use rustyscript::{
    deno_core::{error::ModuleLoaderError, ModuleSpecifier, RequestedModuleType, ResolutionKind}, module_loader::ImportProvider, Module, Runtime, RuntimeOptions
};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![execute])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
