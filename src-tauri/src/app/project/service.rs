//! Project service layer — business logic that orchestrates the DAO.
//!
//! This module contains operations that involve more than raw DB access:
//! disk I/O (loading plugin bundles), plugin execution (JS runtime), and
//! settings-merge logic. The DAO ([`ProjectPersistence`]) is kept free of
//! these concerns; every function here takes a `&dyn ProjectPersistence` and
//! calls fine-grained DAO methods.

use super::db::ProjectPersistence;
use super::plugins::{
    build_default_settings, discover_local_plugins, extract_manifest_id, load_plugin_bundle_with_id,
};
use super::types::{
    PersistenceError, PluginEntrypointSelection, PluginSettingsPayload, ScanPluginResultRecord,
    ScanSummaryRecord,
};
use serde_json::{json, Map, Value};
use std::path::Path;

// ---------------------------------------------------------------------------
// Built-in plugin sync
// ---------------------------------------------------------------------------

/// Sync built-in plugins for a newly created project.
///
/// Writes plugin code + default settings for every discovered bundle.
pub async fn sync_bundled_plugins_for_new_project(
    dao: &dyn ProjectPersistence,
) -> Result<(), PersistenceError> {
    for plugin in discover_local_plugins()? {
        dao.save_plugin(&plugin).await?;
        let defaults = build_default_settings(&plugin.manifest);
        let defaults_json = serde_json::to_string(&defaults)?;
        dao.save_plugin_settings_json(&plugin.id, &defaults_json)
            .await?;
    }
    Ok(())
}

/// Sync built-in plugins for an existing project opened from disk.
///
/// Preserves user-configured values while adding any new defaults from manifests.
pub async fn sync_bundled_plugins_for_existing_project(
    dao: &dyn ProjectPersistence,
) -> Result<(), PersistenceError> {
    for plugin in discover_local_plugins()? {
        dao.save_plugin(&plugin).await?;
        let existing_raw = dao.get_plugin_settings_json(&plugin.id).await?;
        let merged = merge_with_defaults(
            existing_raw.as_deref(),
            build_default_settings(&plugin.manifest),
        );
        let merged_json = serde_json::to_string(&merged)?;
        dao.save_plugin_settings_json(&plugin.id, &merged_json)
            .await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Scan execution
// ---------------------------------------------------------------------------

/// Execute a scan: load plugin data from the DAO, run all entrypoints, persist results.
///
/// This is the only place that touches the JS runtime (`execute_plugin_code_with_settings`).
/// The DAO sees only clean DB operations on either side.
pub async fn run_scan(
    dao: &dyn ProjectPersistence,
    scan_id: &str,
    selected_plugins: Vec<PluginEntrypointSelection>,
    inputs: Value,
) -> Result<ScanSummaryRecord, PersistenceError> {
    if selected_plugins.is_empty() {
        return Err(PersistenceError::Validation(
            "Select at least one plugin entrypoint before run".into(),
        ));
    }

    let ctx = dao.begin_scan_run(scan_id, &selected_plugins, &inputs).await?;

    let inputs_obj = if inputs.is_object() {
        inputs
    } else {
        Value::Object(Map::new())
    };

    let mut results: Vec<ScanPluginResultRecord> = Vec::with_capacity(ctx.plugins.len());

    for load_data in ctx.plugins {
        let ep_key = format!("{}::{}", load_data.plugin_id, load_data.entrypoint_id);
        let plugin_inputs = inputs_obj
            .get(&ep_key)
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));

        let output = match load_data.code.filter(|c| !c.trim().is_empty()) {
            None => json!({
                "ok": false,
                "error": format!("Plugin '{}' not found or has no code in database", load_data.plugin_id)
            }),
            Some(code) => {
                let plugin_settings = load_data
                    .settings_json
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or_else(|| Value::Object(Map::new()));

                let manifest_val: Value = load_data
                    .manifest_json
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or(Value::Null);

                let entrypoint_fn = resolve_entrypoint_fn(&manifest_val, &load_data.entrypoint_id);

                let result = tauri::async_runtime::spawn_blocking(move || {
                    crate::app::plugin::execute_plugin_code_with_settings(
                        code,
                        plugin_inputs,
                        plugin_settings,
                        Some(entrypoint_fn),
                    )
                })
                .await
                .map_err(|e| {
                    PersistenceError::Validation(format!(
                        "Failed to join plugin execution task: {}",
                        e
                    ))
                })?;

                match result {
                    Ok((output, logs)) => json!({ "ok": true, "data": output, "logs": logs }),
                    Err(err) => json!({ "ok": false, "error": err }),
                }
            }
        };

        results.push(ScanPluginResultRecord {
            plugin_id: load_data.plugin_id,
            entrypoint_id: load_data.entrypoint_id,
            output,
        });
    }

    dao.end_scan_run(scan_id, ctx.scan_preview, results).await
}

// ---------------------------------------------------------------------------
// Plugin management
// ---------------------------------------------------------------------------

/// Register or refresh a plugin from a directory on disk into the project.
///
/// Reads the plugin bundle from disk, merges settings with existing values
/// (new defaults are applied; existing user values are preserved), then
/// delegates all DB writes to the DAO.
pub async fn upsert_plugin_from_dir(
    dao: &dyn ProjectPersistence,
    plugin_dir: &Path,
    replace_plugin_id: Option<String>,
) -> Result<PluginSettingsPayload, PersistenceError> {
    let manifest_id = extract_manifest_id(plugin_dir)?;
    let plugin_id = match replace_plugin_id {
        Some(id) if !id.trim().is_empty() => id.trim().to_string(),
        _ => manifest_id,
    };
    let bundle = load_plugin_bundle_with_id(plugin_dir, plugin_id.clone())?;

    dao.save_plugin(&bundle).await?;

    let existing_raw = dao.get_plugin_settings_json(&plugin_id).await?;
    let default_settings = build_default_settings(&bundle.manifest);
    let merged = merge_with_defaults(existing_raw.as_deref(), default_settings);
    let merged_json = serde_json::to_string(&merged)?;

    dao.save_plugin_settings_json(&plugin_id, &merged_json).await?;
    dao.get_plugin_payload(&plugin_id).await
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/// Merge `existing_raw` JSON with `defaults`, inserting defaults only for missing keys.
fn merge_with_defaults(existing_raw: Option<&str>, defaults: Value) -> Value {
    let mut merged = existing_raw
        .filter(|s| !s.trim().is_empty())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .unwrap_or_else(|| Value::Object(Map::new()));

    if !merged.is_object() {
        merged = Value::Object(Map::new());
    }

    if let (Value::Object(ref mut m), Value::Object(d)) = (&mut merged, defaults) {
        for (key, value) in d {
            m.entry(key).or_insert(value);
        }
    }

    merged
}

/// Resolve the TypeScript function name for a given entrypoint ID from a manifest value.
///
/// Falls back to the entrypoint ID itself when the manifest has no `entrypoints` array
/// or the ID is not found.
fn resolve_entrypoint_fn(manifest: &Value, entrypoint_id: &str) -> String {
    if let Some(entrypoints) = manifest.get("entrypoints").and_then(|v| v.as_array()) {
        for ep in entrypoints {
            if ep.get("id").and_then(|v| v.as_str()) == Some(entrypoint_id) {
                if let Some(func) = ep.get("function").and_then(|v| v.as_str()) {
                    return func.to_string();
                }
            }
        }
    }
    entrypoint_id.to_string()
}
