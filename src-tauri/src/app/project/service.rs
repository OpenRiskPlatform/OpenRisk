//! Project service layer — business logic that orchestrates the DAO.

use super::dao::ProjectPersistence;
use super::plugins::{
    build_default_settings, extract_manifest_id, load_plugin_bundle_from_url,
    load_plugin_bundle_from_zip, load_plugin_bundle_with_id,
};
use super::types::{
    LogEntry, PersistenceError, PluginEntrypointSelection, PluginMetricDef, PluginMetricValue,
    PluginOutput, PluginRecord, PluginSettingValue, ScanEntrypointInput, ScanPluginResultRecord,
    ScanSummaryRecord, SettingValue,
};
use serde_json::{Map, Value};
use std::path::Path;

// ---------------------------------------------------------------------------
// Scan execution
// ---------------------------------------------------------------------------

/// Execute a scan: load plugin data from the DAO, run all entrypoints, persist results.
pub async fn run_scan(
    dao: &dyn ProjectPersistence,
    scan_id: &str,
    selected_plugins: Vec<PluginEntrypointSelection>,
    inputs: Vec<ScanEntrypointInput>,
) -> Result<ScanSummaryRecord, PersistenceError> {
    if selected_plugins.is_empty() {
        return Err(PersistenceError::Validation(
            "Select at least one plugin entrypoint before run".into(),
        ));
    }

    let ctx = dao
        .begin_scan_run(scan_id, &selected_plugins, &inputs)
        .await?;

    let mut results: Vec<ScanPluginResultRecord> = Vec::with_capacity(ctx.plugins.len());

    for load_data in ctx.plugins {
        let output = match load_data.code.filter(|c| !c.trim().is_empty()) {
            None => PluginOutput {
                ok: false,
                data_json: None,
                error: Some(format!(
                    "Plugin '{}' not found or has no code in database",
                    load_data.plugin_id
                )),
                logs: vec![],
                metrics: vec![],
            },
            Some(code) => {
                // Build settings Value for the JS runtime.
                let mut settings_map = Map::new();
                for sv in &load_data.settings {
                    settings_map.insert(sv.name.clone(), sv.value.to_json());
                }
                let plugin_settings = Value::Object(settings_map);

                // Build inputs Value for this specific entrypoint.
                let mut input_map = Map::new();
                for inp in &inputs {
                    if inp.plugin_id == load_data.plugin_id
                        && inp.entrypoint_id == load_data.entrypoint_id
                    {
                        input_map.insert(inp.field_name.clone(), inp.value.to_json());
                    }
                }
                let plugin_inputs = Value::Object(input_map);
                let entrypoint_fn = load_data.entrypoint_function.clone();

                let result = tauri::async_runtime::spawn_blocking(move || {
                    crate::app::plugin::execute_plugin_code_with_settings(
                        code,
                        plugin_inputs,
                        plugin_settings,
                        entrypoint_fn,
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
                    Ok((output_val, logs_val, metrics_val)) => {
                        let data_json = serde_json::to_string(&output_val)
                            .ok()
                            .filter(|s| s != "null");
                        let mut logs = parse_logs(&logs_val);
                        let metrics =
                            parse_metrics(&metrics_val, &load_data.metric_defs, &mut logs);
                        PluginOutput {
                            ok: true,
                            data_json,
                            error: None,
                            logs,
                            metrics,
                        }
                    }
                    Err(err) => PluginOutput {
                        ok: false,
                        data_json: None,
                        error: Some(err),
                        logs: vec![],
                        metrics: vec![],
                    },
                }
            }
        };

        results.push(ScanPluginResultRecord {
            plugin_id: load_data.plugin_id,
            plugin_revision_id: Some(load_data.plugin_revision_id),
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
pub async fn upsert_plugin_from_dir(
    dao: &dyn ProjectPersistence,
    plugin_dir: &Path,
) -> Result<PluginRecord, PersistenceError> {
    let plugin_id = extract_manifest_id(plugin_dir)?;
    let bundle = load_plugin_bundle_with_id(plugin_dir, plugin_id.clone())?;

    dao.save_plugin(&bundle).await?;

    let existing = dao.get_plugin_setting_values(&plugin_id).await?;
    let defaults = build_default_settings(&bundle.manifest);
    let merged = merge_with_defaults(existing, defaults);
    dao.save_plugin_setting_values(&plugin_id, &merged).await?;

    dao.get_plugin_record(&plugin_id).await
}

/// Register or refresh a plugin fetched from a remote `plugin.json` URL.
///
/// Downloads `plugin.json` and the plugin main file from the same remote directory.
pub async fn upsert_plugin_from_url(
    dao: &dyn ProjectPersistence,
    manifest_url: &str,
) -> Result<PluginRecord, PersistenceError> {
    let bundle = load_plugin_bundle_from_url(manifest_url).await?;
    let plugin_id = bundle.id.clone();

    dao.save_plugin(&bundle).await?;

    let existing = dao.get_plugin_setting_values(&plugin_id).await?;
    let defaults = build_default_settings(&bundle.manifest);
    let merged = merge_with_defaults(existing, defaults);
    dao.save_plugin_setting_values(&plugin_id, &merged).await?;

    dao.get_plugin_record(&plugin_id).await
}

/// Register or refresh a plugin from a `.zip` archive into the project.
pub async fn upsert_plugin_from_zip(
    dao: &dyn ProjectPersistence,
    zip_path: &Path,
) -> Result<PluginRecord, PersistenceError> {
    let bundle = load_plugin_bundle_from_zip(zip_path)?;
    let plugin_id = bundle.id.clone();

    dao.save_plugin(&bundle).await?;

    let existing = dao.get_plugin_setting_values(&plugin_id).await?;
    let defaults = build_default_settings(&bundle.manifest);
    let merged = merge_with_defaults(existing, defaults);
    dao.save_plugin_setting_values(&plugin_id, &merged).await?;

    dao.get_plugin_record(&plugin_id).await
}

/// Merge existing values with defaults: add defaults only for missing keys.
fn merge_with_defaults(
    existing: Vec<PluginSettingValue>,
    defaults: Vec<PluginSettingValue>,
) -> Vec<PluginSettingValue> {
    let mut merged = existing;
    for def in defaults {
        if !merged.iter().any(|sv| sv.name == def.name) {
            merged.push(def);
        }
    }
    merged
}

/// Parse the logs array returned by the plugin runtime into typed `LogEntry` values.
fn parse_logs(logs_val: &Value) -> Vec<LogEntry> {
    match logs_val.as_array() {
        Some(arr) => arr.iter().filter_map(LogEntry::from_json).collect(),
        None => vec![],
    }
}

fn parse_metrics(
    metrics_val: &Value,
    defs: &[PluginMetricDef],
    logs: &mut Vec<LogEntry>,
) -> Vec<PluginMetricValue> {
    let metric_map = match metrics_val.as_object() {
        Some(v) => v,
        None => return vec![],
    };

    let mut metrics = Vec::with_capacity(defs.len());
    for def in defs {
        let Some(raw_value) = metric_map.get(&def.name) else {
            continue;
        };

        if !metric_value_matches_type(raw_value, &def.type_.name, def.type_.values.as_deref()) {
            logs.push(LogEntry {
                level: super::types::LogLevel::Warn,
                message: format!(
                    "Metric '{}' ignored: value does not match declared type '{}'",
                    def.name, def.type_.name
                ),
            });
            continue;
        }

        metrics.push(PluginMetricValue {
            name: def.name.clone(),
            title: def.title.clone(),
            type_: def.type_.clone(),
            description: def.description.clone(),
            value: SettingValue::from_json(raw_value),
        });
    }

    metrics
}

fn metric_value_matches_type(
    raw_value: &Value,
    type_name: &str,
    enum_values: Option<&[String]>,
) -> bool {
    match type_name {
        "string" | "date" | "url" => raw_value.is_string(),
        "number" => raw_value.is_number(),
        "integer" => raw_value.as_i64().is_some() || raw_value.as_u64().is_some(),
        "boolean" => raw_value.is_boolean(),
        "enum" => {
            let Some(s) = raw_value.as_str() else {
                return false;
            };
            enum_values
                .map(|values| values.iter().any(|v| v == s))
                .unwrap_or(false)
        }
        _ => true,
    }
}
