//! Plugin subsystem: execution of plugin code via the Deno V8 runtime.

mod runtime;

use serde_json::Value;

/// Execute plugin source code directly (used by the scan runner with code stored in the DB).
///
/// Merges `inputs` and `settings` into a single object and calls `entrypoint_fn`
/// and returns `(result, logs, metrics)`.
pub fn execute_plugin_code_with_settings(
    code: String,
    inputs: Value,
    settings: Value,
    entrypoint_fn: String,
) -> Result<(Value, Value, Value), String> {
    let mut merged = match inputs {
        Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(s) = settings {
        for (k, v) in s {
            merged.insert(k, v);
        }
    }
    runtime::run_plugin_module(code, Value::Object(merged), &entrypoint_fn)
}
