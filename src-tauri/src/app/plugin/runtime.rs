//! JavaScript plugin runtime built on `rustyscript` (Deno V8).
//!
//! Each plugin execution is fully isolated: a new [`Runtime`] is created per call.
//! Plugin source is served under the stable specifier `script://main.ts` via
//! [`ScriptImportProvider`]; a generated wrapper captures `console.*` output
//! alongside the entrypoint result.

use rustyscript::{
    deno_core::{error::ModuleLoaderError, ModuleSpecifier, RequestedModuleType, ResolutionKind},
    module_loader::ImportProvider,
    Module, Runtime, RuntimeOptions,
};
use serde_json::Value;

/// Serves a single in-memory TypeScript source at the stable specifier `script://main.ts`.
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

/// Execute `entrypoint_fn` from the given plugin `code` with the provided merged inputs.
///
/// Returns `(result, logs, metrics)` where `logs` is an array of `{ level, message }` objects
/// captured from `console.log`, `console.warn`, and `console.error`.
pub fn run_plugin_module(
    code: String,
    merged_inputs: Value,
    entrypoint_fn: &str,
) -> Result<(Value, Value, Value), String> {
    let inputs_json = merged_inputs.to_string();
    let wrapper_code = format!(
        r#"
        import * as __mod__ from "script://main.ts";
        export default async () => {{
            const __logs__ = [];
            const __metrics__ = Object.create(null);
            const __origLog__ = console.log.bind(console);
            const __origWarn__ = console.warn.bind(console);
            const __origError__ = console.error.bind(console);
            globalThis.openrisk = {{
                metrics: {{
                    set: (name, value) => {{
                        if (typeof name !== "string" || !name.trim()) {{
                            throw new TypeError("Metric name must be a non-empty string");
                        }}
                        __metrics__[name] = value;
                        return value;
                    }},
                    get: (name) => __metrics__[name],
                    inc: (name, delta = 1) => {{
                        if (typeof name !== "string" || !name.trim()) {{
                            throw new TypeError("Metric name must be a non-empty string");
                        }}
                        const next = (Number(__metrics__[name] ?? 0) + Number(delta));
                        __metrics__[name] = next;
                        return next;
                    }},
                    all: () => ({{ ...__metrics__ }}),
                }},
            }};
            console.log = (...args) => {{
                __logs__.push({{ level: "log", message: args.map(String).join(" ") }});
                __origLog__(...args);
            }};
            console.warn = (...args) => {{
                __logs__.push({{ level: "warn", message: args.map(String).join(" ") }});
                __origWarn__(...args);
            }};
            console.error = (...args) => {{
                __logs__.push({{ level: "error", message: args.map(String).join(" ") }});
                __origError__(...args);
            }};
            if (Object.prototype.hasOwnProperty.call(__mod__, "default")) {{
                throw new TypeError("Plugin must not use export default. Use named exports only.");
            }}
            const __fn__ = __mod__["{}"];
            if (typeof __fn__ !== 'function') {{
                throw new TypeError("Plugin entrypoint '{}' is not exported or is not a function");
            }}
            const inputs = {};
            const __result__ = await __fn__(inputs);
            return {{ __result__: __result__, __logs__: __logs__, __metrics__: __metrics__ }};
        }}
        "#,
        entrypoint_fn, entrypoint_fn, inputs_json
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
            let returned = runtime
                .call_entrypoint::<Value>(&handle, &())
                .map_err(|e| e.to_string())?;
            let logs = returned
                .get("__logs__")
                .cloned()
                .unwrap_or(Value::Array(vec![]));
            let metrics = returned
                .get("__metrics__")
                .cloned()
                .unwrap_or(Value::Object(Default::default()));
            let result = returned.get("__result__").cloned().unwrap_or(Value::Null);
            Ok((result, logs, metrics))
        }
        Err(err) => Err(err.to_string()),
    }
}
