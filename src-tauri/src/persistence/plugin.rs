use crate::app::{PluginDetail, PluginPersistence, PluginRuntimeBundle, PluginSummary};
use crate::app::{PersistenceError, PersistenceErrorKind, PersistenceResult};
use crate::persistence::constants::{PLUGINS_DIR_NAME, PLUGIN_MANIFEST_FILE, PLUGIN_SETTINGS_FILE};
use crate::plugin_manifest::{parse_manifest, OpenRiskPluginManifest};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct FsPluginPersistence {
    root_dir: PathBuf,
}

impl Default for FsPluginPersistence {
    fn default() -> Self {
        let mut root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        root.push(PLUGINS_DIR_NAME);
        Self { root_dir: root }
    }
}

impl FsPluginPersistence {
    pub fn new(root_dir: PathBuf) -> Self {
        Self { root_dir }
    }

    fn plugins_root(&self) -> &Path {
        &self.root_dir
    }

    fn plugin_dir(&self, plugin_id: &str) -> PersistenceResult<PathBuf> {
        let mut path = self.plugins_root().to_path_buf();
        path.push(plugin_id);
        if !path.exists() {
            return Err(PersistenceError::with_metadata(
                PersistenceErrorKind::NotFound,
                format!("Plugin directory not found: {}", plugin_id),
                path_metadata(&path),
            ));
        }
        if !path.is_dir() {
            return Err(PersistenceError::with_metadata(
                PersistenceErrorKind::Validation,
                format!("Plugin path is not a directory: {}", plugin_id),
                path_metadata(&path),
            ));
        }
        Ok(path)
    }

    fn manifest_path(&self, dir: &Path) -> PathBuf {
        dir.join(PLUGIN_MANIFEST_FILE)
    }

    fn settings_path(&self, dir: &Path) -> PathBuf {
        dir.join(PLUGIN_SETTINGS_FILE)
    }

    fn read_manifest(&self, dir: &Path) -> PersistenceResult<OpenRiskPluginManifest> {
        let manifest_path = self.manifest_path(dir);
        if !manifest_path.exists() {
            return Err(PersistenceError::with_metadata(
                PersistenceErrorKind::NotFound,
                "Missing plugin manifest file",
                path_metadata(&manifest_path),
            ));
        }
        let content = fs::read_to_string(&manifest_path).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Io,
                format!("Failed to read manifest: {}", err),
                path_metadata(&manifest_path),
            )
        })?;

        parse_manifest(&content).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Validation,
                err.to_string(),
                path_metadata(&manifest_path),
            )
        })
    }

    fn read_settings(
        &self,
        dir: &Path,
        manifest: &OpenRiskPluginManifest,
    ) -> PersistenceResult<Value> {
        let settings_path = self.settings_path(dir);
        if settings_path.exists() {
            let content = fs::read_to_string(&settings_path).map_err(|err| {
                PersistenceError::with_metadata(
                    PersistenceErrorKind::Io,
                    format!("Failed to read settings: {}", err),
                    path_metadata(&settings_path),
                )
            })?;
            let value: Value = serde_json::from_str(&content)?;
            return Ok(value);
        }

        Ok(build_default_settings(manifest))
    }

    fn load_code(&self, dir: &Path, entrypoint: &str) -> PersistenceResult<String> {
        let code_path = dir.join(entrypoint);
        if !code_path.exists() {
            return Err(PersistenceError::with_metadata(
                PersistenceErrorKind::NotFound,
                "Missing plugin entrypoint file",
                path_metadata(&code_path),
            ));
        }
        fs::read_to_string(&code_path).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Io,
                format!("Failed to read plugin code: {}", err),
                path_metadata(&code_path),
            )
        })
    }
}

impl PluginPersistence for FsPluginPersistence {
    fn list_plugins(&self) -> PersistenceResult<Vec<PluginSummary>> {
        let root = self.plugins_root();
        if !root.exists() {
            return Ok(vec![]);
        }

        let entries = fs::read_dir(root).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Io,
                format!("Failed to read plugins dir: {}", err),
                path_metadata(root),
            )
        })?;

        let mut result = Vec::new();
        for entry in entries {
            let entry = match entry {
                Ok(ent) => ent,
                Err(err) => {
                    eprintln!("Skipping plugin entry: {}", err);
                    continue;
                }
            };
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            match self.read_manifest(&path) {
                Ok(manifest) => {
                    let id = entry.file_name().to_string_lossy().to_string();
                    result.push(PluginSummary {
                        id,
                        name: manifest.name.to_string(),
                        version: manifest.version.to_string(),
                        description: manifest.description.to_string(),
                        icon: manifest.icon.as_ref().map(|s| s.to_string()),
                    });
                }
                Err(err) => {
                    eprintln!("Skipping plugin {:?}: {}", path, err);
                }
            }
        }

        Ok(result)
    }

    fn get_plugin(&self, plugin_id: &str) -> PersistenceResult<PluginDetail> {
        let dir = self.plugin_dir(plugin_id)?;
        let manifest = self.read_manifest(&dir)?;
        let settings = self.read_settings(&dir, &manifest)?;
        Ok(PluginDetail {
            id: plugin_id.to_string(),
            manifest,
            settings,
        })
    }

    fn save_plugin_settings(&self, plugin_id: &str, settings: Value) -> PersistenceResult<()> {
        let dir = self.plugin_dir(plugin_id)?;
        let settings_path = self.settings_path(&dir);
        let data = serde_json::to_string_pretty(&settings)?;

        fs::write(&settings_path, data).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Io,
                format!("Failed to write settings: {}", err),
                path_metadata(&settings_path),
            )
        })
    }

    fn open_plugin_manifest(&self, file_path: &Path) -> PersistenceResult<OpenRiskPluginManifest> {
        let content = fs::read_to_string(file_path).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Io,
                format!("Failed to read plugin file: {}", err),
                path_metadata(file_path),
            )
        })?;

        parse_manifest(&content).map_err(|err| {
            PersistenceError::with_metadata(
                PersistenceErrorKind::Validation,
                err.to_string(),
                path_metadata(file_path),
            )
        })
    }

    fn load_runtime_bundle(&self, plugin_id: &str) -> PersistenceResult<PluginRuntimeBundle> {
        let dir = self.plugin_dir(plugin_id)?;
        let manifest = self.read_manifest(&dir)?;
        let settings = self.read_settings(&dir, &manifest)?;
        let entrypoint: String = manifest.entrypoint.clone().into();
        let code = self.load_code(&dir, &entrypoint)?;

        Ok(PluginRuntimeBundle {
            manifest,
            settings,
            code,
        })
    }
}

fn build_default_settings(manifest: &OpenRiskPluginManifest) -> Value {
    let mut map = Map::new();
    for setting in &manifest.settings {
        let key = setting.name.to_string();
        let value = setting.default.clone().unwrap_or(Value::Null);
        map.insert(key, value);
    }
    Value::Object(map)
}

fn path_metadata(path: &Path) -> Value {
    json!({ "path": path.to_string_lossy() })
}
