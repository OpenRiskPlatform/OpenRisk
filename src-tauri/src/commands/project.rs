//! Tauri command handlers for project and scan operations.

use crate::app::project::{
    service, AppError, PluginEntrypointSelection, PluginRecord, ProjectPersistence,
    ProjectSettingsPayload, ProjectSettingsRecord, ProjectSummary, ScanDetailRecord,
    ScanEntrypointInput, ScanSummaryRecord, SettingValue, SqliteProjectPersistence,
};
use crate::ProjectState;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;

const PLUGIN_REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/OpenRiskPlatform/plugins/main/plugins.json";

#[derive(Debug, Clone, Deserialize, serde::Serialize, specta::Type)]
pub struct RegistryAuthorRecord {
    pub name: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, specta::Type)]
pub struct RegistryPluginRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub versions: Vec<String>,
    #[serde(default)]
    pub path: String,
    pub description: String,
    #[serde(default)]
    pub authors: Vec<RegistryAuthorRecord>,
    #[serde(default)]
    pub license: String,
    #[serde(default)]
    pub main: String,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, specta::Type)]
pub struct PluginRegistryRecord {
    #[serde(rename = "generatedAt", alias = "generated_at")]
    pub generated_at: String,
    pub plugins: Vec<RegistryPluginRecord>,
}

async fn get_open_project(
    state: &tauri::State<'_, ProjectState>,
) -> Result<Arc<SqliteProjectPersistence>, AppError> {
    state.lock().await.clone().ok_or_else(|| {
        AppError::Validation(
            "No project is open. Call open_project or create_project first.".to_string(),
        )
    })
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
    state: tauri::State<'_, ProjectState>,
) -> Result<ProjectSettingsRecord, AppError> {
    let project = get_open_project(&state).await?;
    project
        .update_project_settings(name, theme, advanced_mode)
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
    let project = get_open_project(&state).await?;
    service::upsert_plugin_from_dir(project.as_ref(), &PathBuf::from(plugin_dir))
        .await
        .map_err(AppError::from)
}

/// Register or refresh a plugin from a `.zip` archive into the active project.
/// #
#[tauri::command]
#[specta::specta]
pub async fn upsert_project_plugin_from_zip(
    zip_path: String,
    state: tauri::State<'_, ProjectState>,
) -> Result<PluginRecord, AppError> {
    let project = get_open_project(&state).await?;
    service::upsert_plugin_from_zip(project.as_ref(), &PathBuf::from(zip_path))
        .await
        .map_err(AppError::from)
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
    let project = get_open_project(&state).await?;
    service::upsert_plugin_from_url(project.as_ref(), &manifest_url)
        .await
        .map_err(AppError::from)
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
    let response = reqwest::get(PLUGIN_REGISTRY_URL)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch plugin registry: {}", e)))?;

    let response = response
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("Plugin registry request failed: {}", e)))?;

    response
        .json::<PluginRegistryRecord>()
        .await
        .map_err(|e| AppError::Internal(format!("Invalid plugin registry payload: {}", e)))
}
