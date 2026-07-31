use crate::NativeOpenRiskError;
use openrisk_core::project::{
    PluginEntrypointSelection, PluginInputDef, PluginRecord, PluginRegistryRecord,
    ProjectSettingsPayload, ProjectSettingsRecord, ProjectSummary, RegistryPluginRecord,
    ScanDetailRecord, ScanEntrypointInput, ScanPluginResultRecord, ScanSummaryRecord, SettingValue,
};

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeProjectSummary {
    pub id: String,
    pub name: String,
    pub directory: String,
    pub is_preview: bool,
}

impl From<ProjectSummary> for NativeProjectSummary {
    fn from(project: ProjectSummary) -> Self {
        Self {
            id: project.id,
            name: project.name,
            directory: project.directory.to_string_lossy().into_owned(),
            is_preview: project.is_preview,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeProjectLockStatus {
    pub locked: bool,
    pub unlocked: bool,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginEntrypoint {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginInput {
    pub entrypoint_id: String,
    pub name: String,
    pub title: String,
    pub type_name: String,
    pub type_values: Vec<String>,
    pub optional: bool,
    pub description: Option<String>,
    pub default_value_json: Option<String>,
}

impl From<PluginInputDef> for NativePluginInput {
    fn from(input: PluginInputDef) -> Self {
        Self {
            entrypoint_id: input.entrypoint_id,
            name: input.name,
            title: input.title,
            type_name: input.type_.name,
            type_values: input.type_.values.unwrap_or_default(),
            optional: input.optional,
            description: input.description,
            default_value_json: input.default_value.map(|value| value.to_json_string()),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePlugin {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub homepage: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub entrypoints: Vec<NativePluginEntrypoint>,
    pub inputs: Vec<NativePluginInput>,
    pub settings: Vec<NativePluginSetting>,
    pub metrics: Vec<NativePluginMetric>,
    pub can_refresh_metrics: bool,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginSetting {
    pub name: String,
    pub title: String,
    pub type_name: String,
    pub type_values: Vec<String>,
    pub description: Option<String>,
    pub required: bool,
    pub secret: bool,
    pub value_json: Option<String>,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginMetric {
    pub name: String,
    pub title: String,
    pub type_name: String,
    pub description: Option<String>,
    pub value_json: String,
}

impl From<PluginRecord> for NativePlugin {
    fn from(plugin: PluginRecord) -> Self {
        let setting_values = plugin.setting_values;
        let settings = plugin
            .setting_defs
            .into_iter()
            .map(|definition| {
                let value_json = setting_values
                    .iter()
                    .find(|value| value.name == definition.name)
                    .map(|value| value.value.to_json_string())
                    .or_else(|| {
                        definition
                            .default_value
                            .as_ref()
                            .map(SettingValue::to_json_string)
                    });
                NativePluginSetting {
                    name: definition.name,
                    title: definition.title,
                    type_name: definition.type_.name,
                    type_values: definition.type_.values.unwrap_or_default(),
                    description: definition.description,
                    required: definition.required,
                    secret: definition.secret,
                    value_json,
                }
            })
            .collect();
        let metrics = plugin
            .metric_values
            .into_iter()
            .map(|metric| NativePluginMetric {
                name: metric.name,
                title: metric.title,
                type_name: metric.type_.name,
                description: metric.description,
                value_json: metric.value.to_json_string(),
            })
            .collect();
        let description = plugin.manifest.description;
        let homepage = plugin.manifest.homepage;
        let can_refresh_metrics = plugin.manifest.update_metrics_fn.is_some();

        Self {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            description,
            homepage,
            enabled: plugin.enabled,
            status: plugin.status,
            entrypoints: plugin
                .entrypoints
                .into_iter()
                .map(|entrypoint| NativePluginEntrypoint {
                    id: entrypoint.id,
                    name: entrypoint.name,
                    description: entrypoint.description,
                })
                .collect(),
            inputs: plugin.input_defs.into_iter().map(Into::into).collect(),
            settings,
            metrics,
            can_refresh_metrics,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeProjectSettings {
    pub id: String,
    pub description: String,
    pub locale: String,
    pub theme: String,
    pub advanced_mode: bool,
    pub is_preview: bool,
}

impl From<ProjectSettingsRecord> for NativeProjectSettings {
    fn from(settings: ProjectSettingsRecord) -> Self {
        Self {
            id: settings.id,
            description: settings.description,
            locale: settings.locale,
            theme: settings.theme,
            advanced_mode: settings.advanced_mode,
            is_preview: settings.is_preview,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeSettingsSnapshot {
    pub project: NativeProjectSummary,
    pub project_settings: NativeProjectSettings,
    pub plugins: Vec<NativePlugin>,
}

impl From<ProjectSettingsPayload> for NativeSettingsSnapshot {
    fn from(settings: ProjectSettingsPayload) -> Self {
        Self {
            project: settings.project.into(),
            project_settings: settings.project_settings.into(),
            plugins: settings.plugins.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeRegistryPlugin {
    pub id: String,
    pub name: String,
    pub version: String,
    pub versions: Vec<String>,
    pub description: String,
}

impl From<RegistryPluginRecord> for NativeRegistryPlugin {
    fn from(plugin: RegistryPluginRecord) -> Self {
        Self {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            versions: plugin.versions,
            description: plugin.description,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginRegistry {
    pub generated_at: String,
    pub plugins: Vec<NativeRegistryPlugin>,
}

impl From<PluginRegistryRecord> for NativePluginRegistry {
    fn from(registry: PluginRegistryRecord) -> Self {
        Self {
            generated_at: registry.generated_at,
            plugins: registry.plugins.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanSummary {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub created_at: String,
    pub plugin_name: Option<String>,
    pub result_count: i64,
    pub error_result_count: i64,
    pub is_archived: bool,
    pub sort_order: i64,
}

impl From<ScanSummaryRecord> for NativeScanSummary {
    fn from(scan: ScanSummaryRecord) -> Self {
        Self {
            id: scan.id,
            status: scan.status,
            preview: scan.preview,
            created_at: scan.created_at,
            plugin_name: scan.plugin_name,
            result_count: scan.result_count,
            error_result_count: scan.error_result_count,
            is_archived: scan.is_archived,
            sort_order: scan.sort_order,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativePluginSelection {
    pub plugin_id: String,
    pub entrypoint_id: String,
}

impl From<NativePluginSelection> for PluginEntrypointSelection {
    fn from(selection: NativePluginSelection) -> Self {
        Self {
            plugin_id: selection.plugin_id,
            entrypoint_id: selection.entrypoint_id,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanInput {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub field_name: String,
    pub value_json: String,
}

impl TryFrom<NativeScanInput> for ScanEntrypointInput {
    type Error = NativeOpenRiskError;

    fn try_from(input: NativeScanInput) -> Result<Self, Self::Error> {
        let value = serde_json::from_str(&input.value_json)
            .map_err(NativeOpenRiskError::operation)
            .map(|value| SettingValue::from_json(&value))?;
        Ok(Self {
            plugin_id: input.plugin_id,
            entrypoint_id: input.entrypoint_id,
            field_name: input.field_name,
            value,
        })
    }
}

impl From<ScanEntrypointInput> for NativeScanInput {
    fn from(input: ScanEntrypointInput) -> Self {
        Self {
            plugin_id: input.plugin_id,
            entrypoint_id: input.entrypoint_id,
            field_name: input.field_name,
            value_json: input.value.to_json_string(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanResult {
    pub plugin_id: String,
    pub entrypoint_id: String,
    pub ok: bool,
    pub data_json: Option<String>,
    pub error: Option<String>,
    pub logs: Vec<String>,
}

impl From<ScanPluginResultRecord> for NativeScanResult {
    fn from(result: ScanPluginResultRecord) -> Self {
        Self {
            plugin_id: result.plugin_id,
            entrypoint_id: result.entrypoint_id,
            ok: result.output.ok,
            data_json: result.output.data_json,
            error: result.output.error,
            logs: result
                .output
                .logs
                .into_iter()
                .map(|log| log.message)
                .collect(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeScanDetail {
    pub id: String,
    pub status: String,
    pub preview: Option<String>,
    pub created_at: String,
    pub selected_plugins: Vec<NativePluginSelection>,
    pub inputs: Vec<NativeScanInput>,
    pub results: Vec<NativeScanResult>,
}

impl From<ScanDetailRecord> for NativeScanDetail {
    fn from(scan: ScanDetailRecord) -> Self {
        Self {
            id: scan.id,
            status: scan.status,
            preview: scan.preview,
            created_at: scan.created_at,
            selected_plugins: scan
                .selected_plugins
                .into_iter()
                .map(|selection| NativePluginSelection {
                    plugin_id: selection.plugin_id,
                    entrypoint_id: selection.entrypoint_id,
                })
                .collect(),
            inputs: scan.inputs.into_iter().map(Into::into).collect(),
            results: scan.results.into_iter().map(Into::into).collect(),
        }
    }
}
