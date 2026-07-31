use jsonschema::JSONSchema;
use serde_json::Value;
use std::sync::OnceLock;

#[allow(clippy::all)]
#[path = "../schemas/plugin-manifest.schema.rs"]
mod manifest_types;

pub use manifest_types::FieldType as PluginFieldType;
pub use manifest_types::OpenRiskPluginManifest002 as OpenRiskPluginManifest;
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
            PluginFieldType::String(FieldTypeString::JurisdictionIso31662)
            | PluginFieldType::String(FieldTypeString::RegistryJurisdictionCode) => {
                crate::registry_jurisdiction::JURISDICTION_ISO_3166_2_TYPE_NAME
            }
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
                name: FieldTypeObjectName::JurisdictionIso31662,
                ..
            }
            | PluginFieldType::Object {
                name: FieldTypeObjectName::RegistryJurisdictionCode,
                ..
            } => crate::registry_jurisdiction::JURISDICTION_ISO_3166_2_TYPE_NAME,
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
        let name = self.name();
        match self.enum_values() {
            Some(values) if !values.is_empty() => {
                serde_json::json!({ "name": name, "values": values })
            }
            _ => serde_json::json!({ "name": name }),
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

#[cfg(test)]
mod tests {
    use super::parse_manifest;

    #[test]
    fn parse_manifest_accepts_secret_setting_hint() {
        let manifest = parse_manifest(
            r#"{
                "id": "secret-test",
                "version": "0.1.0",
                "name": "Secret Test",
                "description": "Test plugin with secret setting",
                "authors": [{ "name": "OpenRisk" }],
                "license": "MIT",
                "main": "index.ts",
                "entrypoints": [
                    {
                        "id": "search",
                        "name": "Search",
                        "function": "search",
                        "inputs": []
                    }
                ],
                "settings": [
                    {
                        "name": "token",
                        "type": "string",
                        "title": "API Token",
                        "secret": true,
                        "required": true,
                        "default": null
                    }
                ]
            }"#,
        )
        .expect("manifest with secret setting should parse");

        assert!(manifest.settings[0].secret);
    }

    #[test]
    fn parse_manifest_accepts_sdk_v002_field_contract() {
        let manifest = parse_manifest(
            r#"{
                "$schema": "https://openriskplatform.github.io/plugin-sdk/schemas/plugin-manifest-v0.0.2.schema.json",
                "id": "sdk-contract-test",
                "version": "0.1.0",
                "name": "SDK Contract Test",
                "description": "Canonical SDK manifest fields",
                "authors": [{ "name": "OpenRisk" }],
                "license": "MIT",
                "main": "index.ts",
                "entrypoints": [
                    {
                        "id": "search",
                        "name": "Search",
                        "function": "search",
                        "inputs": [
                            {
                                "name": "targetName",
                                "title": "Target name",
                                "type": "jurisdiction-iso-3166-2",
                                "required": true
                            }
                        ]
                    }
                ],
                "settings": [
                    {
                        "name": "apiKey",
                        "title": "API key",
                        "type": "string",
                        "optional": true
                    }
                ],
                "metrics": [
                    {
                        "name": "requestsToday",
                        "title": "Requests today",
                        "type": "number",
                        "default": 0
                    }
                ]
            }"#,
        )
        .expect("SDK v0.0.2 manifest should parse");

        assert_eq!(manifest.entrypoints[0].inputs[0].name, "targetName");
        assert_eq!(
            manifest.entrypoints[0].inputs[0].type_.name(),
            "jurisdiction-iso-3166-2"
        );
        assert_eq!(manifest.settings[0].name, "apiKey");
        assert_eq!(manifest.metrics[0].name, "requestsToday");
    }

    #[test]
    fn legacy_jurisdiction_type_is_normalized_to_sdk_name() {
        let manifest = parse_manifest(
            r#"{
                "id": "legacy-jurisdiction-test",
                "version": "0.1.0",
                "name": "Legacy Jurisdiction Test",
                "description": "Legacy field alias remains supported",
                "authors": [{ "name": "OpenRisk" }],
                "license": "MIT",
                "main": "index.ts",
                "entrypoints": [
                    {
                        "id": "search",
                        "name": "Search",
                        "function": "search",
                        "inputs": [
                            {
                                "name": "jurisdiction",
                                "title": "Jurisdiction",
                                "type": "registry-jurisdiction-code"
                            }
                        ]
                    }
                ]
            }"#,
        )
        .expect("legacy jurisdiction alias should parse");

        assert_eq!(
            manifest.entrypoints[0].inputs[0].type_.name(),
            "jurisdiction-iso-3166-2"
        );
        assert_eq!(
            manifest.entrypoints[0].inputs[0].type_.to_json_value(),
            serde_json::json!({ "name": "jurisdiction-iso-3166-2" })
        );
    }
}
