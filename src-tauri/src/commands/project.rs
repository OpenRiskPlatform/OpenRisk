//! Tauri command handlers for project and scan operations.

use crate::ProjectState;
use openrisk_core::project::{
    AppError, PdfExportReceipt, PdfExportSelection, PluginEntrypointSelection, PluginRecord,
    PluginRegistryRecord, ProjectPersistence, ProjectSettingsPayload, ProjectSettingsRecord,
    ProjectSummary, ReportProfile, ScanDetailRecord, ScanEntrypointInput, ScanSummaryRecord,
    SettingValue, SqliteProjectPersistence, service,
};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;

async fn get_open_project(
    state: &tauri::State<'_, ProjectState>,
) -> Result<Arc<SqliteProjectPersistence>, AppError> {
    state.lock().await.clone().ok_or_else(|| {
        AppError::Validation(
            "No project is open. Call open_project or create_project first.".to_string(),
        )
    })
}

#[cfg(feature = "disable-plugin-installation")]
fn plugin_installation_disabled() -> AppError {
    AppError::Validation("Plugin installation is disabled in this build".into())
}

/// Report whether this build permits installing additional plugins.
#[tauri::command]
#[specta::specta]
pub fn plugin_installation_enabled() -> bool {
    !cfg!(feature = "disable-plugin-installation")
}

/// Create a new project database at `project_path` and open it as the active project.
/// #
#[tauri::command]
#[specta::specta]
pub async fn create_project(
    name: String,
    project_path: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<ProjectSummary, AppError> {
    let (summary, persistence) =
        SqliteProjectPersistence::create(&name, &PathBuf::from(project_path))
            .await
            .map_err(AppError::from)?;
    *state.lock().await = Some(Arc::new(persistence));
    Ok(summary)
}

/// Open an existing project file as the active project.
///
/// Pass `password` when the database is encrypted. This also covers the unlock flow:
/// if a previous `open_project` returned a lock error, call again with the password.
#[tauri::command]
#[specta::specta]
pub async fn open_project(
    project_path: String,
    password: Option<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<ProjectSummary, AppError> {
    let path = PathBuf::from(project_path);
    let (summary, persistence) = match password {
        Some(pw) => SqliteProjectPersistence::open_with_password(&path, pw).await,
        None => SqliteProjectPersistence::open(&path).await,
    }
    .map_err(AppError::from)?;
    *state.lock().await = Some(Arc::new(persistence));
    Ok(summary)
}

/// Close the active project and release its database connection.
/// #
#[tauri::command]
#[specta::specta]
pub async fn close_project(state: tauri::State<'_, ProjectState>) -> Result<(), AppError> {
    *state.lock().await = None;
    Ok(())
}

/// Load the full settings snapshot (project + global settings + all plugin configs).
/// #
#[tauri::command]
#[specta::specta]
pub async fn load_settings(
    state: tauri::State<'_, ProjectState>,
) -> Result<ProjectSettingsPayload, AppError> {
    let project = get_open_project(&state).await?;
    project.load_settings().await.map_err(AppError::from)
}

/// Update the project-wide theme setting.
/// #
#[tauri::command]
#[specta::specta]
pub async fn update_project_settings(
    name: Option<String>,
    theme: Option<String>,
    advanced_mode: Option<bool>,
    interrupted_scan_policy: Option<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<ProjectSettingsRecord, AppError> {
    let project = get_open_project(&state).await?;
    project
        .update_project_settings(name, theme, advanced_mode, interrupted_scan_policy)
        .await
        .map_err(AppError::from)
}

/// Set one plugin setting value within the active project.
/// #
#[tauri::command]
#[specta::specta]
pub async fn set_plugin_setting(
    plugin_id: String,
    setting_name: String,
    value: SettingValue,
    state: tauri::State<'_, ProjectState>,
) -> Result<PluginRecord, AppError> {
    let project = get_open_project(&state).await?;
    project
        .set_plugin_setting(&plugin_id, &setting_name, value)
        .await
        .map_err(AppError::from)
}

/// Register or refresh a plugin from a directory on disk into the active project.
/// #
#[tauri::command]
#[specta::specta]
pub async fn upsert_project_plugin_from_dir(
    plugin_dir: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<PluginRecord, AppError> {
    #[cfg(feature = "disable-plugin-installation")]
    {
        let _ = (plugin_dir, state);
        Err(plugin_installation_disabled())
    }
    #[cfg(not(feature = "disable-plugin-installation"))]
    {
        let project = get_open_project(&state).await?;
        service::upsert_plugin_from_dir(project.as_ref(), &PathBuf::from(plugin_dir))
            .await
            .map_err(AppError::from)
    }
}

/// Register or refresh a plugin from a `.zip` archive into the active project.
/// #
#[tauri::command]
#[specta::specta]
pub async fn upsert_project_plugin_from_zip(
    zip_path: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<PluginRecord, AppError> {
    #[cfg(feature = "disable-plugin-installation")]
    {
        let _ = (zip_path, state);
        Err(plugin_installation_disabled())
    }
    #[cfg(not(feature = "disable-plugin-installation"))]
    {
        let project = get_open_project(&state).await?;
        service::upsert_plugin_from_zip(project.as_ref(), &PathBuf::from(zip_path))
            .await
            .map_err(AppError::from)
    }
}

/// Install a plugin from a remote `plugin.json` URL.
///
/// Downloads the manifest and main entrypoint file from the same remote directory,
/// then registers the plugin in the active project database.
/// #
#[tauri::command]
#[specta::specta]
pub async fn install_plugin_from_url(
    manifest_url: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<PluginRecord, AppError> {
    #[cfg(feature = "disable-plugin-installation")]
    {
        let _ = (manifest_url, state);
        Err(plugin_installation_disabled())
    }
    #[cfg(not(feature = "disable-plugin-installation"))]
    {
        let project = get_open_project(&state).await?;
        service::upsert_plugin_from_url(project.as_ref(), &manifest_url)
            .await
            .map_err(AppError::from)
    }
}

/// Enable or disable a plugin within the active project.
/// #
#[tauri::command]
#[specta::specta]
pub async fn set_plugin_enabled(
    plugin_id: String,
    enabled: bool,
    state: tauri::State<'_, ProjectState>,
) -> Result<PluginRecord, AppError> {
    let project = get_open_project(&state).await?;
    project
        .set_plugin_enabled(&plugin_id, enabled)
        .await
        .map_err(AppError::from)
}

/// Refresh persisted plugin metrics by calling plugin-defined `update_metrics_fn` when available.
/// #
#[tauri::command]
#[specta::specta]
pub async fn refresh_plugin_metrics(
    plugin_id: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<PluginRecord, AppError> {
    let project = get_open_project(&state).await?;
    service::refresh_plugin_metrics(project.as_ref(), &plugin_id)
        .await
        .map_err(AppError::from)
}

/// Create a new scan in Draft status.
/// #
#[tauri::command]
#[specta::specta]
pub async fn create_scan(
    preview: Option<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<ScanSummaryRecord, AppError> {
    let project = get_open_project(&state).await?;
    project.create_scan(preview).await.map_err(AppError::from)
}

/// List all scans for the active project including archived ones.
/// #
#[tauri::command]
#[specta::specta]
pub async fn list_scans(
    state: tauri::State<'_, ProjectState>,
) -> Result<Vec<ScanSummaryRecord>, AppError> {
    let project = get_open_project(&state).await?;
    project.list_scans().await.map_err(AppError::from)
}

/// Fetch full details of a single scan including all plugin results.
/// #
#[tauri::command]
#[specta::specta]
pub async fn get_scan(
    scan_id: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<ScanDetailRecord, AppError> {
    let project = get_open_project(&state).await?;
    project.get_scan(&scan_id).await.map_err(AppError::from)
}

/// Render one completed investigation as an official, print-ready PDF report.
///
/// The report is built from an immutable snapshot using the exact plugin revisions
/// stored with the scan. Rendering and file I/O run off the async command thread.
#[tauri::command]
#[specta::specta]
pub async fn export_scan_pdf(
    scan_id: String,
    dest_path: String,
    profile: ReportProfile,
    selection: Option<PdfExportSelection>,
    state: tauri::State<'_, ProjectState>,
) -> Result<PdfExportReceipt, AppError> {
    let destination = PathBuf::from(dest_path.trim());
    if destination.as_os_str().is_empty()
        || destination
            .extension()
            .and_then(|extension| extension.to_str())
            .is_none_or(|extension| !extension.eq_ignore_ascii_case("pdf"))
    {
        return Err(AppError::Validation(
            "PDF destination must end with .pdf".into(),
        ));
    }

    let project = get_open_project(&state).await?;
    let mut snapshot = project
        .get_scan_report_snapshot(&scan_id)
        .await
        .map_err(AppError::from)?;
    if let Some(selection) = selection {
        if !selection.include_search_details && selection.results.is_empty() {
            return Err(AppError::Validation(
                "Select search details or at least one result to export".into(),
            ));
        }

        let mut selected_results = HashMap::new();
        for result in selection.results {
            let result_index = result.result_index as usize;
            if result_index >= snapshot.executions.len() {
                return Err(AppError::Validation(format!(
                    "Selected result index {result_index} does not exist"
                )));
            }
            if let Some(item_indices) = &result.item_indices {
                if item_indices.is_empty() {
                    return Err(AppError::Validation(format!(
                        "Selected result index {result_index} has no selected items"
                    )));
                }
                let Some(serde_json::Value::Array(items)) =
                    snapshot.executions[result_index].data.as_ref()
                else {
                    return Err(AppError::Validation(format!(
                        "Selected result index {result_index} does not contain selectable items"
                    )));
                };
                if let Some(item_index) = item_indices
                    .iter()
                    .find(|item_index| **item_index as usize >= items.len())
                {
                    return Err(AppError::Validation(format!(
                        "Selected item index {item_index} does not exist in result {result_index}"
                    )));
                }
            }
            if selected_results
                .insert(result_index, result.item_indices)
                .is_some()
            {
                return Err(AppError::Validation(format!(
                    "Selected result index {result_index} is duplicated"
                )));
            }
        }

        snapshot.include_search_details = selection.include_search_details;
        snapshot.include_results = !selected_results.is_empty();
        if !selection.include_search_details {
            snapshot.inputs.clear();
        }
        snapshot.executions = snapshot
            .executions
            .into_iter()
            .enumerate()
            .filter_map(|(result_index, mut execution)| {
                let item_indices = selected_results.remove(&result_index)?;
                if let Some(item_indices) = item_indices {
                    let data = execution.data.take()?;
                    let serde_json::Value::Array(items) = data else {
                        return None;
                    };
                    let selected_item_indices: HashSet<usize> = item_indices
                        .into_iter()
                        .map(|index| index as usize)
                        .collect();
                    execution.data = Some(serde_json::Value::Array(
                        items
                            .into_iter()
                            .enumerate()
                            .filter_map(|(index, item)| {
                                selected_item_indices.contains(&index).then_some(item)
                            })
                            .collect(),
                    ));
                }
                Some(execution)
            })
            .collect();
    }
    let destination_for_render = destination.clone();
    let rendered = tauri::async_runtime::spawn_blocking(move || {
        let rendered = openrisk_pdf::render_scan_report(&snapshot, profile)?;
        openrisk_pdf::write_pdf_atomically(&destination_for_render, &rendered.bytes)?;
        Ok::<_, openrisk_pdf::PdfRenderError>(rendered)
    })
    .await
    .map_err(|error| AppError::Internal(format!("PDF renderer stopped: {error}")))?
    .map_err(|error| AppError::Internal(error.to_string()))?;

    Ok(PdfExportReceipt {
        destination_path: destination.to_string_lossy().into_owned(),
        sha256: rendered.sha256,
        byte_length: rendered.bytes.len() as u64,
        page_count: rendered.page_count,
    })
}

/// Persist the current form state while keeping the scan in Draft status.
/// #
#[tauri::command]
#[specta::specta]
pub async fn update_scan_draft(
    scan_id: String,
    selected_plugins: Vec<PluginEntrypointSelection>,
    inputs: Vec<ScanEntrypointInput>,
    state: tauri::State<'_, ProjectState>,
) -> Result<ScanSummaryRecord, AppError> {
    let project = get_open_project(&state).await?;
    project
        .update_scan_draft(&scan_id, &selected_plugins, &inputs)
        .await
        .map_err(AppError::from)
}

/// Execute a scan: run the selected plugins and persist results.
///
/// Plugin code is read from the project database, not from disk.
#[tauri::command]
#[specta::specta]
pub async fn run_scan(
    scan_id: String,
    selected_plugins: Vec<PluginEntrypointSelection>,
    inputs: Vec<ScanEntrypointInput>,
    state: tauri::State<'_, ProjectState>,
) -> Result<ScanSummaryRecord, AppError> {
    let project = get_open_project(&state).await?;
    service::run_scan(project.as_ref(), &scan_id, selected_plugins, inputs)
        .await
        .map_err(AppError::from)
}

/// Update the preview (display name) of a scan.
/// #
#[tauri::command]
#[specta::specta]
pub async fn update_scan_preview(
    scan_id: String,
    preview: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<ScanSummaryRecord, AppError> {
    let project = get_open_project(&state).await?;
    project
        .update_scan_preview(&scan_id, preview)
        .await
        .map_err(AppError::from)
}

/// Mark a scan as archived or active without deleting it from the database.
/// #
#[tauri::command]
#[specta::specta]
pub async fn set_scan_archived(
    scan_id: String,
    archived: bool,
    state: tauri::State<'_, ProjectState>,
) -> Result<ScanSummaryRecord, AppError> {
    let project = get_open_project(&state).await?;
    project
        .set_scan_archived(&scan_id, archived)
        .await
        .map_err(AppError::from)
}

/// Persist the explicit UI ordering for all scans in the active project.
/// #
#[tauri::command]
#[specta::specta]
pub async fn reorder_scans(
    ordered_scan_ids: Vec<String>,
    state: tauri::State<'_, ProjectState>,
) -> Result<Vec<ScanSummaryRecord>, AppError> {
    let project = get_open_project(&state).await?;
    project
        .reorder_scans(&ordered_scan_ids)
        .await
        .map_err(AppError::from)
}

/// Fetch plugin registry metadata through backend HTTP client.
///
/// Uses Rust `reqwest` (rustls) instead of WebView `fetch` to avoid client TLS stack issues.
#[tauri::command]
#[specta::specta]
pub async fn get_plugin_registry() -> Result<PluginRegistryRecord, AppError> {
    #[cfg(feature = "disable-plugin-installation")]
    {
        Err(plugin_installation_disabled())
    }
    #[cfg(not(feature = "disable-plugin-installation"))]
    {
        service::get_plugin_registry().await.map_err(AppError::from)
    }
}

/// Export the currently open project as a read-only preview copy at `dest_path`.
///
/// The copy retains all plugin code and credentials so plugins can run, but the
/// backend will permanently refuse all settings writes and will never expose
/// credential values to the frontend.
#[tauri::command]
#[specta::specta]
pub async fn create_preview_project(
    dest_path: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<(), AppError> {
    let project = get_open_project(&state).await?;
    project
        .export_as_preview(&std::path::PathBuf::from(dest_path))
        .await
        .map_err(AppError::from)
}
