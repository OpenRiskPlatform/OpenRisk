#![allow(clippy::redundant_closure_call)]
#![allow(clippy::needless_lifetimes)]
#![allow(clippy::match_single_binding)]
#![allow(clippy::clone_on_copy)]

#[doc = r" Error types."]
pub mod error {
    #[doc = r" Error from a `TryFrom` or `FromStr` implementation."]
    pub struct ConversionError(::std::borrow::Cow<'static, str>);
    impl ::std::error::Error for ConversionError {}
    impl ::std::fmt::Display for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Display::fmt(&self.0, f)
        }
    }
    impl ::std::fmt::Debug for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Debug::fmt(&self.0, f)
        }
    }
    impl From<&'static str> for ConversionError {
        fn from(value: &'static str) -> Self {
            Self(value.into())
        }
    }
    impl From<String> for ConversionError {
        fn from(value: String) -> Self {
            Self(value.into())
        }
    }
}
#[doc = "Input/setting type: shorthand string or detailed object."]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Input/setting type: shorthand string or detailed object.\","]
#[doc = "  \"oneOf\": ["]
#[doc = "    {"]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"enum\": ["]
#[doc = "        \"string\","]
#[doc = "        \"number\","]
#[doc = "        \"boolean\","]
#[doc = "        \"integer\","]
#[doc = "        \"date\","]
#[doc = "        \"url\","]
#[doc = "        \"jurisdiction-iso-3166-2\","]
#[doc = "        \"registry-jurisdiction-code\""]
#[doc = "      ]"]
#[doc = "    },"]
#[doc = "    {"]
#[doc = "      \"type\": \"object\","]
#[doc = "      \"required\": ["]
#[doc = "        \"name\""]
#[doc = "      ],"]
#[doc = "      \"properties\": {"]
#[doc = "        \"name\": {"]
#[doc = "          \"type\": \"string\","]
#[doc = "          \"enum\": ["]
#[doc = "            \"string\","]
#[doc = "            \"number\","]
#[doc = "            \"boolean\","]
#[doc = "            \"integer\","]
#[doc = "            \"date\","]
#[doc = "            \"url\","]
#[doc = "            \"enum\","]
#[doc = "            \"jurisdiction-iso-3166-2\","]
#[doc = "            \"registry-jurisdiction-code\""]
#[doc = "          ]"]
#[doc = "        },"]
#[doc = "        \"values\": {"]
#[doc = "          \"description\": \"Enum values when name='enum'.\","]
#[doc = "          \"type\": \"array\","]
#[doc = "          \"items\": {"]
#[doc = "            \"type\": \"string\""]
#[doc = "          }"]
#[doc = "        }"]
#[doc = "      },"]
#[doc = "      \"additionalProperties\": false"]
#[doc = "    }"]
#[doc = "  ]"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged, deny_unknown_fields)]
pub enum FieldType {
    String(FieldTypeString),
    Object {
        name: FieldTypeObjectName,
        #[doc = "Enum values when name='enum'."]
        #[serde(default, skip_serializing_if = "::std::vec::Vec::is_empty")]
        values: ::std::vec::Vec<::std::string::String>,
    },
}
impl ::std::convert::From<&Self> for FieldType {
    fn from(value: &FieldType) -> Self {
        value.clone()
    }
}
impl ::std::convert::From<FieldTypeString> for FieldType {
    fn from(value: FieldTypeString) -> Self {
        Self::String(value)
    }
}
#[doc = "`FieldTypeObjectName`"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"enum\": ["]
#[doc = "    \"string\","]
#[doc = "    \"number\","]
#[doc = "    \"boolean\","]
#[doc = "    \"integer\","]
#[doc = "    \"date\","]
#[doc = "    \"url\","]
#[doc = "    \"enum\","]
#[doc = "    \"jurisdiction-iso-3166-2\","]
#[doc = "    \"registry-jurisdiction-code\""]
#[doc = "  ]"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(
    :: serde :: Deserialize,
    :: serde :: Serialize,
    Clone,
    Copy,
    Debug,
    Eq,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
)]
pub enum FieldTypeObjectName {
    #[serde(rename = "string")]
    String,
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "boolean")]
    Boolean,
    #[serde(rename = "integer")]
    Integer,
    #[serde(rename = "date")]
    Date,
    #[serde(rename = "url")]
    Url,
    #[serde(rename = "enum")]
    Enum,
    #[serde(rename = "jurisdiction-iso-3166-2")]
    JurisdictionIso31662,
    #[serde(rename = "registry-jurisdiction-code")]
    RegistryJurisdictionCode,
}
impl ::std::convert::From<&Self> for FieldTypeObjectName {
    fn from(value: &FieldTypeObjectName) -> Self {
        value.clone()
    }
}
impl ::std::fmt::Display for FieldTypeObjectName {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::String => f.write_str("string"),
            Self::Number => f.write_str("number"),
            Self::Boolean => f.write_str("boolean"),
            Self::Integer => f.write_str("integer"),
            Self::Date => f.write_str("date"),
            Self::Url => f.write_str("url"),
            Self::Enum => f.write_str("enum"),
            Self::JurisdictionIso31662 => f.write_str("jurisdiction-iso-3166-2"),
            Self::RegistryJurisdictionCode => f.write_str("registry-jurisdiction-code"),
        }
    }
}
impl ::std::str::FromStr for FieldTypeObjectName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "string" => Ok(Self::String),
            "number" => Ok(Self::Number),
            "boolean" => Ok(Self::Boolean),
            "integer" => Ok(Self::Integer),
            "date" => Ok(Self::Date),
            "url" => Ok(Self::Url),
            "enum" => Ok(Self::Enum),
            "jurisdiction-iso-3166-2" => Ok(Self::JurisdictionIso31662),
            "registry-jurisdiction-code" => Ok(Self::RegistryJurisdictionCode),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for FieldTypeObjectName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for FieldTypeObjectName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for FieldTypeObjectName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
#[doc = "`FieldTypeString`"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"enum\": ["]
#[doc = "    \"string\","]
#[doc = "    \"number\","]
#[doc = "    \"boolean\","]
#[doc = "    \"integer\","]
#[doc = "    \"date\","]
#[doc = "    \"url\","]
#[doc = "    \"jurisdiction-iso-3166-2\","]
#[doc = "    \"registry-jurisdiction-code\""]
#[doc = "  ]"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(
    :: serde :: Deserialize,
    :: serde :: Serialize,
    Clone,
    Copy,
    Debug,
    Eq,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
)]
pub enum FieldTypeString {
    #[serde(rename = "string")]
    String,
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "boolean")]
    Boolean,
    #[serde(rename = "integer")]
    Integer,
    #[serde(rename = "date")]
    Date,
    #[serde(rename = "url")]
    Url,
    #[serde(rename = "jurisdiction-iso-3166-2")]
    JurisdictionIso31662,
    #[serde(rename = "registry-jurisdiction-code")]
    RegistryJurisdictionCode,
}
impl ::std::convert::From<&Self> for FieldTypeString {
    fn from(value: &FieldTypeString) -> Self {
        value.clone()
    }
}
impl ::std::fmt::Display for FieldTypeString {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::String => f.write_str("string"),
            Self::Number => f.write_str("number"),
            Self::Boolean => f.write_str("boolean"),
            Self::Integer => f.write_str("integer"),
            Self::Date => f.write_str("date"),
            Self::Url => f.write_str("url"),
            Self::JurisdictionIso31662 => f.write_str("jurisdiction-iso-3166-2"),
            Self::RegistryJurisdictionCode => f.write_str("registry-jurisdiction-code"),
        }
    }
}
impl ::std::str::FromStr for FieldTypeString {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "string" => Ok(Self::String),
            "number" => Ok(Self::Number),
            "boolean" => Ok(Self::Boolean),
            "integer" => Ok(Self::Integer),
            "date" => Ok(Self::Date),
            "url" => Ok(Self::Url),
            "jurisdiction-iso-3166-2" => Ok(Self::JurisdictionIso31662),
            "registry-jurisdiction-code" => Ok(Self::RegistryJurisdictionCode),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for FieldTypeString {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for FieldTypeString {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for FieldTypeString {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
#[doc = "`InputDefinition`"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"name\","]
#[doc = "    \"title\","]
#[doc = "    \"type\""]
#[doc = "  ],"]
#[doc = "  \"properties\": {"]
#[doc = "    \"default\": {"]
#[doc = "      \"description\": \"Default value for optional inputs\""]
#[doc = "    },"]
#[doc = "    \"description\": {"]
#[doc = "      \"description\": \"Detailed input description\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Input parameter name passed to the plugin entrypoint\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"optional\": {"]
#[doc = "      \"description\": \"Whether this input is optional\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"required\": {"]
#[doc = "      \"description\": \"Whether this input is required\","]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"title\": {"]
#[doc = "      \"description\": \"Human-readable input name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"type\": {"]
#[doc = "      \"$ref\": \"#/definitions/FieldType\""]
#[doc = "    },"]
#[doc = "    \"validation\": {"]
#[doc = "      \"$ref\": \"#/definitions/ValidationRules\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct InputDefinition {
    #[doc = "Default value for optional inputs"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub default: ::std::option::Option<::serde_json::Value>,
    #[doc = "Detailed input description"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub description: ::std::option::Option<::std::string::String>,
    #[doc = "Input parameter name passed to the plugin entrypoint"]
    pub name: ::std::string::String,
    #[doc = "Whether this input is optional"]
    #[serde(default)]
    pub optional: bool,
    #[doc = "Whether this input is required"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub required: ::std::option::Option<bool>,
    #[doc = "Human-readable input name"]
    pub title: ::std::string::String,
    #[serde(rename = "type")]
    pub type_: FieldType,
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub validation: ::std::option::Option<ValidationRules>,
}
impl ::std::convert::From<&InputDefinition> for InputDefinition {
    fn from(value: &InputDefinition) -> Self {
        value.clone()
    }
}
#[doc = "`MetricDefinition`"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"name\","]
#[doc = "    \"title\","]
#[doc = "    \"type\""]
#[doc = "  ],"]
#[doc = "  \"properties\": {"]
#[doc = "    \"default\": {"]
#[doc = "      \"description\": \"Default metric value\""]
#[doc = "    },"]
#[doc = "    \"description\": {"]
#[doc = "      \"description\": \"Metric purpose shown in UI\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Metric key used by openrisk.metrics.set/get/inc\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"optional\": {"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"required\": {"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"title\": {"]
#[doc = "      \"description\": \"Human-readable metric name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"type\": {"]
#[doc = "      \"$ref\": \"#/definitions/FieldType\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct MetricDefinition {
    #[doc = "Default metric value"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub default: ::std::option::Option<::serde_json::Value>,
    #[doc = "Metric purpose shown in UI"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub description: ::std::option::Option<::std::string::String>,
    #[doc = "Metric key used by openrisk.metrics.set/get/inc"]
    pub name: ::std::string::String,
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub optional: ::std::option::Option<bool>,
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub required: ::std::option::Option<bool>,
    #[doc = "Human-readable metric name"]
    pub title: ::std::string::String,
    #[serde(rename = "type")]
    pub type_: FieldType,
}
impl ::std::convert::From<&MetricDefinition> for MetricDefinition {
    fn from(value: &MetricDefinition) -> Self {
        value.clone()
    }
}
#[doc = "OpenRisk plugin SDK manifest contract with backwards-compatible application extensions."]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"$id\": \"https://openriskplatform.github.io/plugin-sdk/schemas/plugin-manifest-v0.0.2.schema.json\","]
#[doc = "  \"title\": \"OpenRisk Plugin Manifest 0.0.2\","]
#[doc = "  \"description\": \"OpenRisk plugin SDK manifest contract with backwards-compatible application extensions.\","]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"authors\","]
#[doc = "    \"description\","]
#[doc = "    \"entrypoints\","]
#[doc = "    \"id\","]
#[doc = "    \"license\","]
#[doc = "    \"main\","]
#[doc = "    \"name\","]
#[doc = "    \"version\""]
#[doc = "  ],"]
#[doc = "  \"properties\": {"]
#[doc = "    \"$schema\": {"]
#[doc = "      \"description\": \"JSON Schema reference for IDE support\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"authors\": {"]
#[doc = "      \"description\": \"List of plugin authors\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"type\": \"object\","]
#[doc = "        \"required\": ["]
#[doc = "          \"name\""]
#[doc = "        ],"]
#[doc = "        \"properties\": {"]
#[doc = "          \"email\": {"]
#[doc = "            \"description\": \"Author email address\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"name\": {"]
#[doc = "            \"description\": \"Author name\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"url\": {"]
#[doc = "            \"description\": \"Author website\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          }"]
#[doc = "        },"]
#[doc = "        \"additionalProperties\": false"]
#[doc = "      },"]
#[doc = "      \"minItems\": 1"]
#[doc = "    },"]
#[doc = "    \"description\": {"]
#[doc = "      \"description\": \"Brief description of plugin functionality\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"minLength\": 1"]
#[doc = "    },"]
#[doc = "    \"entrypoints\": {"]
#[doc = "      \"description\": \"Named entrypoints exposed by the plugin. At least one named entrypoint is required.\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"$ref\": \"#/definitions/PluginEntrypointDefinition\""]
#[doc = "      },"]
#[doc = "      \"minItems\": 1"]
#[doc = "    },"]
#[doc = "    \"homepage\": {"]
#[doc = "      \"description\": \"Plugin homepage URL\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"icon\": {"]
#[doc = "      \"description\": \"Plugin icon\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"id\": {"]
#[doc = "      \"description\": \"Stable plugin identifier used in project database\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^[a-z][a-z0-9_-]{0,63}$\""]
#[doc = "    },"]
#[doc = "    \"keywords\": {"]
#[doc = "      \"description\": \"Plugin keywords for searchability\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"type\": \"string\""]
#[doc = "      }"]
#[doc = "    },"]
#[doc = "    \"license\": {"]
#[doc = "      \"description\": \"SPDX license identifier (e.g., MIT, Apache-2.0, GPL-3.0)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"minLength\": 1"]
#[doc = "    },"]
#[doc = "    \"main\": {"]
#[doc = "      \"description\": \"Main TypeScript/JavaScript file (relative to plugin directory)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^[^/].*\\\\.(ts|js)$\""]
#[doc = "    },"]
#[doc = "    \"metrics\": {"]
#[doc = "      \"description\": \"Runtime metrics emitted by plugin code through openrisk.metrics.* receiver.\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"$ref\": \"#/definitions/MetricDefinition\""]
#[doc = "      }"]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Human-readable plugin name\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"minLength\": 1"]
#[doc = "    },"]
#[doc = "    \"repository\": {"]
#[doc = "      \"description\": \"Plugin source code repository URL\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"settings\": {"]
#[doc = "      \"description\": \"Plugin configuration settings\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"$ref\": \"#/definitions/SettingDefinition\""]
#[doc = "      }"]
#[doc = "    },"]
#[doc = "    \"update_metrics_fn\": {"]
#[doc = "      \"description\": \"Optional function name to call for refreshing declared metrics in settings.\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"version\": {"]
#[doc = "      \"description\": \"Plugin version\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifest002 {
    #[doc = "List of plugin authors"]
    pub authors: ::std::vec::Vec<OpenRiskPluginManifest002AuthorsItem>,
    #[doc = "Brief description of plugin functionality"]
    pub description: OpenRiskPluginManifest002Description,
    #[doc = "Named entrypoints exposed by the plugin. At least one named entrypoint is required."]
    pub entrypoints: ::std::vec::Vec<PluginEntrypointDefinition>,
    #[doc = "Plugin homepage URL"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub homepage: ::std::option::Option<::std::string::String>,
    #[doc = "Plugin icon"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub icon: ::std::option::Option<::std::string::String>,
    #[doc = "Stable plugin identifier used in project database"]
    pub id: OpenRiskPluginManifest002Id,
    #[doc = "Plugin keywords for searchability"]
    #[serde(default, skip_serializing_if = "::std::vec::Vec::is_empty")]
    pub keywords: ::std::vec::Vec<::std::string::String>,
    #[doc = "SPDX license identifier (e.g., MIT, Apache-2.0, GPL-3.0)"]
    pub license: OpenRiskPluginManifest002License,
    #[doc = "Main TypeScript/JavaScript file (relative to plugin directory)"]
    pub main: OpenRiskPluginManifest002Main,
    #[doc = "Runtime metrics emitted by plugin code through openrisk.metrics.* receiver."]
    #[serde(default, skip_serializing_if = "::std::vec::Vec::is_empty")]
    pub metrics: ::std::vec::Vec<MetricDefinition>,
    #[doc = "Human-readable plugin name"]
    pub name: OpenRiskPluginManifest002Name,
    #[doc = "Plugin source code repository URL"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub repository: ::std::option::Option<::std::string::String>,
    #[doc = "JSON Schema reference for IDE support"]
    #[serde(
        rename = "$schema",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub schema: ::std::option::Option<::std::string::String>,
    #[doc = "Plugin configuration settings"]
    #[serde(default, skip_serializing_if = "::std::vec::Vec::is_empty")]
    pub settings: ::std::vec::Vec<SettingDefinition>,
    #[doc = "Optional function name to call for refreshing declared metrics in settings."]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub update_metrics_fn: ::std::option::Option<::std::string::String>,
    #[doc = "Plugin version"]
    pub version: ::std::string::String,
}
impl ::std::convert::From<&OpenRiskPluginManifest002> for OpenRiskPluginManifest002 {
    fn from(value: &OpenRiskPluginManifest002) -> Self {
        value.clone()
    }
}
#[doc = "`OpenRiskPluginManifest002AuthorsItem`"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"name\""]
#[doc = "  ],"]
#[doc = "  \"properties\": {"]
#[doc = "    \"email\": {"]
#[doc = "      \"description\": \"Author email address\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Author name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"url\": {"]
#[doc = "      \"description\": \"Author website\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifest002AuthorsItem {
    #[doc = "Author email address"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub email: ::std::option::Option<::std::string::String>,
    #[doc = "Author name"]
    pub name: ::std::string::String,
    #[doc = "Author website"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub url: ::std::option::Option<::std::string::String>,
}
impl ::std::convert::From<&OpenRiskPluginManifest002AuthorsItem>
    for OpenRiskPluginManifest002AuthorsItem
{
    fn from(value: &OpenRiskPluginManifest002AuthorsItem) -> Self {
        value.clone()
    }
}
#[doc = "Brief description of plugin functionality"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Brief description of plugin functionality\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"minLength\": 1"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct OpenRiskPluginManifest002Description(::std::string::String);
impl ::std::ops::Deref for OpenRiskPluginManifest002Description {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<OpenRiskPluginManifest002Description> for ::std::string::String {
    fn from(value: OpenRiskPluginManifest002Description) -> Self {
        value.0
    }
}
impl ::std::convert::From<&OpenRiskPluginManifest002Description>
    for OpenRiskPluginManifest002Description
{
    fn from(value: &OpenRiskPluginManifest002Description) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for OpenRiskPluginManifest002Description {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for OpenRiskPluginManifest002Description {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OpenRiskPluginManifest002Description {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OpenRiskPluginManifest002Description {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for OpenRiskPluginManifest002Description {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Stable plugin identifier used in project database"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Stable plugin identifier used in project database\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^[a-z][a-z0-9_-]{0,63}$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct OpenRiskPluginManifest002Id(::std::string::String);
impl ::std::ops::Deref for OpenRiskPluginManifest002Id {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<OpenRiskPluginManifest002Id> for ::std::string::String {
    fn from(value: OpenRiskPluginManifest002Id) -> Self {
        value.0
    }
}
impl ::std::convert::From<&OpenRiskPluginManifest002Id> for OpenRiskPluginManifest002Id {
    fn from(value: &OpenRiskPluginManifest002Id) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for OpenRiskPluginManifest002Id {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        static PATTERN: ::std::sync::LazyLock<::regress::Regex> =
            ::std::sync::LazyLock::new(|| {
                ::regress::Regex::new("^[a-z][a-z0-9_-]{0,63}$").unwrap()
            });
        if PATTERN.find(value).is_none() {
            return Err("doesn't match pattern \"^[a-z][a-z0-9_-]{0,63}$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for OpenRiskPluginManifest002Id {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OpenRiskPluginManifest002Id {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OpenRiskPluginManifest002Id {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for OpenRiskPluginManifest002Id {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "SPDX license identifier (e.g., MIT, Apache-2.0, GPL-3.0)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"SPDX license identifier (e.g., MIT, Apache-2.0, GPL-3.0)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"minLength\": 1"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct OpenRiskPluginManifest002License(::std::string::String);
impl ::std::ops::Deref for OpenRiskPluginManifest002License {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<OpenRiskPluginManifest002License> for ::std::string::String {
    fn from(value: OpenRiskPluginManifest002License) -> Self {
        value.0
    }
}
impl ::std::convert::From<&OpenRiskPluginManifest002License> for OpenRiskPluginManifest002License {
    fn from(value: &OpenRiskPluginManifest002License) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for OpenRiskPluginManifest002License {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for OpenRiskPluginManifest002License {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OpenRiskPluginManifest002License {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OpenRiskPluginManifest002License {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for OpenRiskPluginManifest002License {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Main TypeScript/JavaScript file (relative to plugin directory)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Main TypeScript/JavaScript file (relative to plugin directory)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^[^/].*\\\\.(ts|js)$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct OpenRiskPluginManifest002Main(::std::string::String);
impl ::std::ops::Deref for OpenRiskPluginManifest002Main {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<OpenRiskPluginManifest002Main> for ::std::string::String {
    fn from(value: OpenRiskPluginManifest002Main) -> Self {
        value.0
    }
}
impl ::std::convert::From<&OpenRiskPluginManifest002Main> for OpenRiskPluginManifest002Main {
    fn from(value: &OpenRiskPluginManifest002Main) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for OpenRiskPluginManifest002Main {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        static PATTERN: ::std::sync::LazyLock<::regress::Regex> =
            ::std::sync::LazyLock::new(|| ::regress::Regex::new("^[^/].*\\.(ts|js)$").unwrap());
        if PATTERN.find(value).is_none() {
            return Err("doesn't match pattern \"^[^/].*\\.(ts|js)$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for OpenRiskPluginManifest002Main {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OpenRiskPluginManifest002Main {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OpenRiskPluginManifest002Main {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for OpenRiskPluginManifest002Main {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Human-readable plugin name"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Human-readable plugin name\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"minLength\": 1"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct OpenRiskPluginManifest002Name(::std::string::String);
impl ::std::ops::Deref for OpenRiskPluginManifest002Name {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<OpenRiskPluginManifest002Name> for ::std::string::String {
    fn from(value: OpenRiskPluginManifest002Name) -> Self {
        value.0
    }
}
impl ::std::convert::From<&OpenRiskPluginManifest002Name> for OpenRiskPluginManifest002Name {
    fn from(value: &OpenRiskPluginManifest002Name) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for OpenRiskPluginManifest002Name {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for OpenRiskPluginManifest002Name {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OpenRiskPluginManifest002Name {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OpenRiskPluginManifest002Name {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for OpenRiskPluginManifest002Name {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "A named entrypoint exposed by a plugin."]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"A named entrypoint exposed by a plugin.\","]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"function\","]
#[doc = "    \"id\","]
#[doc = "    \"inputs\","]
#[doc = "    \"name\""]
#[doc = "  ],"]
#[doc = "  \"properties\": {"]
#[doc = "    \"description\": {"]
#[doc = "      \"description\": \"Entrypoint description\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"function\": {"]
#[doc = "      \"description\": \"Named export function in the entrypoint file\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^[a-zA-Z_$][a-zA-Z0-9_$]*$\""]
#[doc = "    },"]
#[doc = "    \"id\": {"]
#[doc = "      \"description\": \"Stable entrypoint identifier (kebab-case)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^[a-z][a-z0-9_-]*$\""]
#[doc = "    },"]
#[doc = "    \"inputs\": {"]
#[doc = "      \"description\": \"Entrypoint-specific input parameters.\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"$ref\": \"#/definitions/InputDefinition\""]
#[doc = "      }"]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Human-readable entrypoint name\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"minLength\": 1"]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PluginEntrypointDefinition {
    #[doc = "Entrypoint description"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub description: ::std::option::Option<::std::string::String>,
    #[doc = "Named export function in the entrypoint file"]
    pub function: PluginEntrypointDefinitionFunction,
    #[doc = "Stable entrypoint identifier (kebab-case)"]
    pub id: PluginEntrypointDefinitionId,
    #[doc = "Entrypoint-specific input parameters."]
    pub inputs: ::std::vec::Vec<InputDefinition>,
    #[doc = "Human-readable entrypoint name"]
    pub name: PluginEntrypointDefinitionName,
}
impl ::std::convert::From<&PluginEntrypointDefinition> for PluginEntrypointDefinition {
    fn from(value: &PluginEntrypointDefinition) -> Self {
        value.clone()
    }
}
#[doc = "Named export function in the entrypoint file"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Named export function in the entrypoint file\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^[a-zA-Z_$][a-zA-Z0-9_$]*$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct PluginEntrypointDefinitionFunction(::std::string::String);
impl ::std::ops::Deref for PluginEntrypointDefinitionFunction {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<PluginEntrypointDefinitionFunction> for ::std::string::String {
    fn from(value: PluginEntrypointDefinitionFunction) -> Self {
        value.0
    }
}
impl ::std::convert::From<&PluginEntrypointDefinitionFunction>
    for PluginEntrypointDefinitionFunction
{
    fn from(value: &PluginEntrypointDefinitionFunction) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for PluginEntrypointDefinitionFunction {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        static PATTERN: ::std::sync::LazyLock<::regress::Regex> =
            ::std::sync::LazyLock::new(|| {
                ::regress::Regex::new("^[a-zA-Z_$][a-zA-Z0-9_$]*$").unwrap()
            });
        if PATTERN.find(value).is_none() {
            return Err("doesn't match pattern \"^[a-zA-Z_$][a-zA-Z0-9_$]*$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for PluginEntrypointDefinitionFunction {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for PluginEntrypointDefinitionFunction {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for PluginEntrypointDefinitionFunction {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for PluginEntrypointDefinitionFunction {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Stable entrypoint identifier (kebab-case)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Stable entrypoint identifier (kebab-case)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^[a-z][a-z0-9_-]*$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct PluginEntrypointDefinitionId(::std::string::String);
impl ::std::ops::Deref for PluginEntrypointDefinitionId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<PluginEntrypointDefinitionId> for ::std::string::String {
    fn from(value: PluginEntrypointDefinitionId) -> Self {
        value.0
    }
}
impl ::std::convert::From<&PluginEntrypointDefinitionId> for PluginEntrypointDefinitionId {
    fn from(value: &PluginEntrypointDefinitionId) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for PluginEntrypointDefinitionId {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        static PATTERN: ::std::sync::LazyLock<::regress::Regex> =
            ::std::sync::LazyLock::new(|| ::regress::Regex::new("^[a-z][a-z0-9_-]*$").unwrap());
        if PATTERN.find(value).is_none() {
            return Err("doesn't match pattern \"^[a-z][a-z0-9_-]*$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for PluginEntrypointDefinitionId {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for PluginEntrypointDefinitionId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for PluginEntrypointDefinitionId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for PluginEntrypointDefinitionId {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Human-readable entrypoint name"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Human-readable entrypoint name\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"minLength\": 1"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct PluginEntrypointDefinitionName(::std::string::String);
impl ::std::ops::Deref for PluginEntrypointDefinitionName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<PluginEntrypointDefinitionName> for ::std::string::String {
    fn from(value: PluginEntrypointDefinitionName) -> Self {
        value.0
    }
}
impl ::std::convert::From<&PluginEntrypointDefinitionName> for PluginEntrypointDefinitionName {
    fn from(value: &PluginEntrypointDefinitionName) -> Self {
        value.clone()
    }
}
impl ::std::str::FromStr for PluginEntrypointDefinitionName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for PluginEntrypointDefinitionName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for PluginEntrypointDefinitionName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for PluginEntrypointDefinitionName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for PluginEntrypointDefinitionName {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "`SettingDefinition`"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"name\","]
#[doc = "    \"title\","]
#[doc = "    \"type\""]
#[doc = "  ],"]
#[doc = "  \"properties\": {"]
#[doc = "    \"default\": {"]
#[doc = "      \"description\": \"Default value for the setting (null allowed)\""]
#[doc = "    },"]
#[doc = "    \"description\": {"]
#[doc = "      \"description\": \"Detailed setting description\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Setting identifier\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"optional\": {"]
#[doc = "      \"description\": \"Whether this setting is optional\","]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"required\": {"]
#[doc = "      \"description\": \"Whether this setting is required\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"secret\": {"]
#[doc = "      \"description\": \"Frontend hint that this setting contains sensitive data and should use a secret input control\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"title\": {"]
#[doc = "      \"description\": \"Human-readable setting name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"type\": {"]
#[doc = "      \"$ref\": \"#/definitions/FieldType\""]
#[doc = "    },"]
#[doc = "    \"validation\": {"]
#[doc = "      \"$ref\": \"#/definitions/ValidationRules\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SettingDefinition {
    #[doc = "Default value for the setting (null allowed)"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub default: ::std::option::Option<::serde_json::Value>,
    #[doc = "Detailed setting description"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub description: ::std::option::Option<::std::string::String>,
    #[doc = "Setting identifier"]
    pub name: ::std::string::String,
    #[doc = "Whether this setting is optional"]
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub optional: ::std::option::Option<bool>,
    #[doc = "Whether this setting is required"]
    #[serde(default)]
    pub required: bool,
    #[doc = "Frontend hint that this setting contains sensitive data and should use a secret input control"]
    #[serde(default)]
    pub secret: bool,
    #[doc = "Human-readable setting name"]
    pub title: ::std::string::String,
    #[serde(rename = "type")]
    pub type_: FieldType,
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub validation: ::std::option::Option<ValidationRules>,
}
impl ::std::convert::From<&SettingDefinition> for SettingDefinition {
    fn from(value: &SettingDefinition) -> Self {
        value.clone()
    }
}
#[doc = "Additional validation rules (legacy fallback for enum)."]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Additional validation rules (legacy fallback for enum).\","]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"properties\": {"]
#[doc = "    \"enum\": {"]
#[doc = "      \"description\": \"Allowed values for enum-like fields.\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"type\": \"string\""]
#[doc = "      }"]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ValidationRules {
    #[doc = "Allowed values for enum-like fields."]
    #[serde(
        rename = "enum",
        default,
        skip_serializing_if = "::std::vec::Vec::is_empty"
    )]
    pub enum_: ::std::vec::Vec<::std::string::String>,
}
impl ::std::convert::From<&ValidationRules> for ValidationRules {
    fn from(value: &ValidationRules) -> Self {
        value.clone()
    }
}
impl ::std::default::Default for ValidationRules {
    fn default() -> Self {
        Self {
            enum_: Default::default(),
        }
    }
}
