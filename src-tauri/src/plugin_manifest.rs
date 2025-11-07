use jsonschema::JSONSchema;
use std::sync::OnceLock;

// Generated types from the schema (relative to src-tauri/src/)
#[path = "../schemas/plugin-manifest.schema.rs"]
mod manifest_types;
pub use manifest_types::OpenRiskPluginManifest;

static COMPILED_SCHEMA: OnceLock<JSONSchema> = OnceLock::new();

fn get_compiled_schema() -> &'static JSONSchema {
    COMPILED_SCHEMA.get_or_init(|| {
        let schema_json = include_str!("../schemas/plugin-manifest.schema.json");
        let schema: serde_json::Value =
            serde_json::from_str(schema_json).expect("Invalid plugin-manifest.schema.json file");

        JSONSchema::compile(&schema).expect("Failed to compile plugin manifest schema")
    })
}

#[derive(Debug)]
pub enum ManifestError {
    ParseError(String),
    ValidationError(String),
}

impl std::fmt::Display for ManifestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManifestError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            ManifestError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for ManifestError {}

/// Validate manifest JSON against the schema and deserialize into generated types.
/// Single entry-point API for callers.
pub fn parse_manifest(json_str: &str) -> Result<OpenRiskPluginManifest, ManifestError> {
    // Parse JSON for validation
    let raw: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| ManifestError::ParseError(e.to_string()))?;

    // Validate against schema
    let schema = get_compiled_schema();
    if let Err(errors) = schema.validate(&raw) {
        let error_msgs: Vec<String> = errors
            .map(|e| format!("{} (at {})", e, e.instance_path))
            .collect();

        return Err(ManifestError::ValidationError(format!(
            "Schema validation failed:\n  - {}",
            error_msgs.join("\n  - ")
        )));
    }

    // Deserialize into strongly-typed structure
    serde_json::from_value::<OpenRiskPluginManifest>(raw)
        .map_err(|e| ManifestError::ParseError(e.to_string()))
}
