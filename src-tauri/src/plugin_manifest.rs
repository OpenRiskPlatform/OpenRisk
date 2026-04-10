use jsonschema::JSONSchema;
use serde_json::Value;
use std::sync::OnceLock;

#[path = "../schemas/plugin-manifest.schema.rs"]
mod manifest_types;

pub use manifest_types::FieldType as PluginFieldType;
pub use manifest_types::OpenRiskPluginManifest;
use manifest_types::{FieldTypeObjectName, FieldTypeString};

impl PluginFieldType {
    pub fn name(&self) -> &'static str {
        match self {
            PluginFieldType::String(FieldTypeString::String) => "string",
            PluginFieldType::String(FieldTypeString::Number) => "number",
            PluginFieldType::String(FieldTypeString::Boolean) => "boolean",
            PluginFieldType::String(FieldTypeString::Integer) => "integer",
            PluginFieldType::String(FieldTypeString::Date) => "date",
            PluginFieldType::String(FieldTypeString::Url) => "url",
            PluginFieldType::Object {
                name: FieldTypeObjectName::String,
                ..
            } => "string",
            PluginFieldType::Object {
                name: FieldTypeObjectName::Number,
                ..
            } => "number",
            PluginFieldType::Object {
                name: FieldTypeObjectName::Boolean,
                ..
            } => "boolean",
            PluginFieldType::Object {
                name: FieldTypeObjectName::Integer,
                ..
            } => "integer",
            PluginFieldType::Object {
                name: FieldTypeObjectName::Date,
                ..
            } => "date",
            PluginFieldType::Object {
                name: FieldTypeObjectName::Url,
                ..
            } => "url",
            PluginFieldType::Object {
                name: FieldTypeObjectName::Enum,
                ..
            } => "enum",
        }
    }

    pub fn enum_values(&self) -> Option<&[String]> {
        match self {
            PluginFieldType::Object {
                name: FieldTypeObjectName::Enum,
                values,
            } => Some(values.as_slice()),
            _ => None,
        }
    }

    pub fn to_json_value(&self) -> Value {
        match self {
            PluginFieldType::String(kind) => {
                serde_json::json!({ "name": kind.to_string() })
            }
            PluginFieldType::Object { name, values } => {
                if values.is_empty() {
                    serde_json::json!({ "name": name.to_string() })
                } else {
                    serde_json::json!({ "name": name.to_string(), "values": values })
                }
            }
        }
    }
}

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
    let raw: Value =
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
