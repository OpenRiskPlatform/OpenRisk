#![allow(clippy::redundant_closure_call)]
#![allow(clippy::needless_lifetimes)]
#![allow(clippy::match_single_binding)]
#![allow(clippy::clone_on_copy)]

use serde::{Deserialize, Serialize};

#[doc = r" Error types."]
pub mod error {
    #[doc = r" Error from a TryFrom or FromStr implementation."]
    pub struct ConversionError(std::borrow::Cow<'static, str>);
    impl std::error::Error for ConversionError {}
    impl std::fmt::Display for ConversionError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
            std::fmt::Display::fmt(&self.0, f)
        }
    }
    impl std::fmt::Debug for ConversionError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
            std::fmt::Debug::fmt(&self.0, f)
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
#[doc = "Schema for OpenRisk plugin manifest (plugin.json)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"$id\": \"https://openrisk.platform/schemas/plugin-manifest/0.0.1.json\","]
#[doc = "  \"title\": \"OpenRisk Plugin Manifest\","]
#[doc = "  \"description\": \"Schema for OpenRisk plugin manifest (plugin.json)\","]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"authors\","]
#[doc = "    \"description\","]
#[doc = "    \"entrypoint\","]
#[doc = "    \"license\","]
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
#[doc = "            \"type\": \"string\","]
#[doc = "            \"format\": \"email\""]
#[doc = "          },"]
#[doc = "          \"name\": {"]
#[doc = "            \"description\": \"Author name\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"url\": {"]
#[doc = "            \"description\": \"Author website\","]
#[doc = "            \"type\": \"string\","]
#[doc = "            \"format\": \"uri\""]
#[doc = "          }"]
#[doc = "        },"]
#[doc = "        \"additionalProperties\": false"]
#[doc = "      },"]
#[doc = "      \"minItems\": 1"]
#[doc = "    },"]
#[doc = "    \"description\": {"]
#[doc = "      \"description\": \"Brief description of plugin functionality\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"maxLength\": 1000,"]
#[doc = "      \"minLength\": 1"]
#[doc = "    },"]
#[doc = "    \"entrypoint\": {"]
#[doc = "      \"description\": \"Main TypeScript/JavaScript file (relative to plugin directory)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^[^/].*\\\\.(ts|js)$\""]
#[doc = "    },"]
#[doc = "    \"homepage\": {"]
#[doc = "      \"description\": \"Plugin homepage URL\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"format\": \"uri\""]
#[doc = "    },"]
#[doc = "    \"icon\": {"]
#[doc = "      \"description\": \"Path to plugin icon (relative to plugin directory)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^[^/].*\\\\.(png|svg|jpg|jpeg)$\""]
#[doc = "    },"]
#[doc = "    \"inputs\": {"]
#[doc = "      \"description\": \"Plugin input parameters\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"type\": \"object\","]
#[doc = "        \"required\": ["]
#[doc = "          \"name\","]
#[doc = "          \"title\","]
#[doc = "          \"type\""]
#[doc = "        ],"]
#[doc = "        \"properties\": {"]
#[doc = "          \"default\": {"]
#[doc = "            \"description\": \"Default value for optional inputs\""]
#[doc = "          },"]
#[doc = "          \"description\": {"]
#[doc = "            \"description\": \"Detailed input description\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"name\": {"]
#[doc = "            \"description\": \"Input parameter name (can use *args or **kwargs syntax)\","]
#[doc = "            \"type\": \"string\","]
#[doc = "            \"pattern\": \"^(\\\\*{0,2}[a-z][a-z0-9_]*)$\""]
#[doc = "          },"]
#[doc = "          \"optional\": {"]
#[doc = "            \"description\": \"Whether this input is optional\","]
#[doc = "            \"default\": false,"]
#[doc = "            \"type\": \"boolean\""]
#[doc = "          },"]
#[doc = "          \"title\": {"]
#[doc = "            \"description\": \"Human-readable input name\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"type\": {"]
#[doc = "            \"description\": \"Input data type (supports list[T] and map[K,V] syntax)\","]
#[doc = "            \"type\": \"string\","]
#[doc = "            \"pattern\": \"^(string|number|boolean|list\\\\[\\\\w+\\\\]|map\\\\[\\\\w+,\\\\s*\\\\w+\\\\])$\""]
#[doc = "          }"]
#[doc = "        },"]
#[doc = "        \"additionalProperties\": false"]
#[doc = "      }"]
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
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Human-readable plugin name\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"maxLength\": 255,"]
#[doc = "      \"minLength\": 1"]
#[doc = "    },"]
#[doc = "    \"outputs\": {"]
#[doc = "      \"description\": \"Plugin output schema\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"type\": \"object\","]
#[doc = "        \"required\": ["]
#[doc = "          \"name\","]
#[doc = "          \"type\""]
#[doc = "        ],"]
#[doc = "        \"properties\": {"]
#[doc = "          \"description\": {"]
#[doc = "            \"description\": \"Output field description\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"name\": {"]
#[doc = "            \"description\": \"Output field name\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"type\": {"]
#[doc = "            \"description\": \"Output data type\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          }"]
#[doc = "        },"]
#[doc = "        \"additionalProperties\": false"]
#[doc = "      }"]
#[doc = "    },"]
#[doc = "    \"permissions\": {"]
#[doc = "      \"description\": \"Plugin permission requirements\","]
#[doc = "      \"type\": \"object\","]
#[doc = "      \"properties\": {"]
#[doc = "        \"env\": {"]
#[doc = "          \"description\": \"Requires environment variable access\","]
#[doc = "          \"default\": false,"]
#[doc = "          \"type\": \"boolean\""]
#[doc = "        },"]
#[doc = "        \"filesystem\": {"]
#[doc = "          \"description\": \"Requires filesystem access\","]
#[doc = "          \"default\": false,"]
#[doc = "          \"type\": \"boolean\""]
#[doc = "        },"]
#[doc = "        \"network\": {"]
#[doc = "          \"description\": \"Requires network access\","]
#[doc = "          \"default\": false,"]
#[doc = "          \"type\": \"boolean\""]
#[doc = "        }"]
#[doc = "      },"]
#[doc = "      \"additionalProperties\": false"]
#[doc = "    },"]
#[doc = "    \"repository\": {"]
#[doc = "      \"description\": \"Plugin source code repository URL\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"format\": \"uri\""]
#[doc = "    },"]
#[doc = "    \"settings\": {"]
#[doc = "      \"description\": \"Plugin configuration settings\","]
#[doc = "      \"type\": \"array\","]
#[doc = "      \"items\": {"]
#[doc = "        \"type\": \"object\","]
#[doc = "        \"required\": ["]
#[doc = "          \"name\","]
#[doc = "          \"title\","]
#[doc = "          \"type\""]
#[doc = "        ],"]
#[doc = "        \"properties\": {"]
#[doc = "          \"default\": {"]
#[doc = "            \"description\": \"Default value for the setting (null allowed)\""]
#[doc = "          },"]
#[doc = "          \"description\": {"]
#[doc = "            \"description\": \"Detailed setting description\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"name\": {"]
#[doc = "            \"description\": \"Setting identifier (snake_case)\","]
#[doc = "            \"type\": \"string\","]
#[doc = "            \"pattern\": \"^[a-z][a-z0-9_]*$\""]
#[doc = "          },"]
#[doc = "          \"required\": {"]
#[doc = "            \"description\": \"Whether this setting is required\","]
#[doc = "            \"default\": false,"]
#[doc = "            \"type\": \"boolean\""]
#[doc = "          },"]
#[doc = "          \"title\": {"]
#[doc = "            \"description\": \"Human-readable setting name\","]
#[doc = "            \"type\": \"string\""]
#[doc = "          },"]
#[doc = "          \"type\": {"]
#[doc = "            \"description\": \"Setting data type\","]
#[doc = "            \"type\": \"string\","]
#[doc = "            \"enum\": ["]
#[doc = "              \"string\","]
#[doc = "              \"number\","]
#[doc = "              \"boolean\","]
#[doc = "              \"array\","]
#[doc = "              \"object\""]
#[doc = "            ]"]
#[doc = "          },"]
#[doc = "          \"validation\": {"]
#[doc = "            \"description\": \"Additional validation rules\","]
#[doc = "            \"type\": \"object\","]
#[doc = "            \"properties\": {"]
#[doc = "              \"enum\": {"]
#[doc = "                \"description\": \"Allowed values\","]
#[doc = "                \"type\": \"array\""]
#[doc = "              },"]
#[doc = "              \"max\": {"]
#[doc = "                \"description\": \"Maximum value (for numbers)\","]
#[doc = "                \"type\": \"number\""]
#[doc = "              },"]
#[doc = "              \"maxLength\": {"]
#[doc = "                \"description\": \"Maximum length (for strings)\","]
#[doc = "                \"type\": \"integer\""]
#[doc = "              },"]
#[doc = "              \"min\": {"]
#[doc = "                \"description\": \"Minimum value (for numbers)\","]
#[doc = "                \"type\": \"number\""]
#[doc = "              },"]
#[doc = "              \"minLength\": {"]
#[doc = "                \"description\": \"Minimum length (for strings)\","]
#[doc = "                \"type\": \"integer\""]
#[doc = "              },"]
#[doc = "              \"pattern\": {"]
#[doc = "                \"description\": \"Regex pattern (for strings)\","]
#[doc = "                \"type\": \"string\""]
#[doc = "              }"]
#[doc = "            },"]
#[doc = "            \"additionalProperties\": false"]
#[doc = "          }"]
#[doc = "        },"]
#[doc = "        \"additionalProperties\": false"]
#[doc = "      }"]
#[doc = "    },"]
#[doc = "    \"version\": {"]
#[doc = "      \"description\": \"Plugin version in semver format (e.g., 0.1.0)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)(?:-((?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\\\.(?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\\\+([0-9a-zA-Z-]+(?:\\\\.[0-9a-zA-Z-]+)*))?$\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifest {
    #[doc = "List of plugin authors"]
    pub authors: Vec<OpenRiskPluginManifestAuthorsItem>,
    #[doc = "Brief description of plugin functionality"]
    pub description: OpenRiskPluginManifestDescription,
    #[doc = "Main TypeScript/JavaScript file (relative to plugin directory)"]
    pub entrypoint: OpenRiskPluginManifestEntrypoint,
    #[doc = "Plugin homepage URL"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[doc = "Path to plugin icon (relative to plugin directory)"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<OpenRiskPluginManifestIcon>,
    #[doc = "Plugin input parameters"]
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub inputs: Vec<OpenRiskPluginManifestInputsItem>,
    #[doc = "Plugin keywords for searchability"]
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub keywords: Vec<String>,
    #[doc = "SPDX license identifier (e.g., MIT, Apache-2.0, GPL-3.0)"]
    pub license: OpenRiskPluginManifestLicense,
    #[doc = "Human-readable plugin name"]
    pub name: OpenRiskPluginManifestName,
    #[doc = "Plugin output schema"]
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub outputs: Vec<OpenRiskPluginManifestOutputsItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permissions: Option<OpenRiskPluginManifestPermissions>,
    #[doc = "Plugin source code repository URL"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    #[doc = "JSON Schema reference for IDE support"]
    #[serde(rename = "$schema", default, skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    #[doc = "Plugin configuration settings"]
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub settings: Vec<OpenRiskPluginManifestSettingsItem>,
    #[doc = "Plugin version in semver format (e.g., 0.1.0)"]
    pub version: OpenRiskPluginManifestVersion,
}
impl From<&OpenRiskPluginManifest> for OpenRiskPluginManifest {
    fn from(value: &OpenRiskPluginManifest) -> Self {
        value.clone()
    }
}
impl OpenRiskPluginManifest {
    pub fn builder() -> builder::OpenRiskPluginManifest {
        Default::default()
    }
}
#[doc = "OpenRiskPluginManifestAuthorsItem"]
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
#[doc = "      \"type\": \"string\","]
#[doc = "      \"format\": \"email\""]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Author name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"url\": {"]
#[doc = "      \"description\": \"Author website\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"format\": \"uri\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifestAuthorsItem {
    #[doc = "Author email address"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[doc = "Author name"]
    pub name: String,
    #[doc = "Author website"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}
impl From<&OpenRiskPluginManifestAuthorsItem> for OpenRiskPluginManifestAuthorsItem {
    fn from(value: &OpenRiskPluginManifestAuthorsItem) -> Self {
        value.clone()
    }
}
impl OpenRiskPluginManifestAuthorsItem {
    pub fn builder() -> builder::OpenRiskPluginManifestAuthorsItem {
        Default::default()
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
#[doc = "  \"maxLength\": 1000,"]
#[doc = "  \"minLength\": 1"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestDescription(String);
impl std::ops::Deref for OpenRiskPluginManifestDescription {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestDescription> for String {
    fn from(value: OpenRiskPluginManifestDescription) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestDescription> for OpenRiskPluginManifestDescription {
    fn from(value: &OpenRiskPluginManifestDescription) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestDescription {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if value.len() > 1000usize {
            return Err("longer than 1000 characters".into());
        }
        if value.len() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestDescription {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestDescription {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestDescription {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestDescription {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
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
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestEntrypoint(String);
impl std::ops::Deref for OpenRiskPluginManifestEntrypoint {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestEntrypoint> for String {
    fn from(value: OpenRiskPluginManifestEntrypoint) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestEntrypoint> for OpenRiskPluginManifestEntrypoint {
    fn from(value: &OpenRiskPluginManifestEntrypoint) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestEntrypoint {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if regress::Regex::new("^[^/].*\\.(ts|js)$")
            .unwrap()
            .find(value)
            .is_none()
        {
            return Err("doesn't match pattern \"^[^/].*\\.(ts|js)$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestEntrypoint {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestEntrypoint {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestEntrypoint {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestEntrypoint {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Path to plugin icon (relative to plugin directory)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Path to plugin icon (relative to plugin directory)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^[^/].*\\\\.(png|svg|jpg|jpeg)$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestIcon(String);
impl std::ops::Deref for OpenRiskPluginManifestIcon {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestIcon> for String {
    fn from(value: OpenRiskPluginManifestIcon) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestIcon> for OpenRiskPluginManifestIcon {
    fn from(value: &OpenRiskPluginManifestIcon) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestIcon {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if regress::Regex::new("^[^/].*\\.(png|svg|jpg|jpeg)$")
            .unwrap()
            .find(value)
            .is_none()
        {
            return Err("doesn't match pattern \"^[^/].*\\.(png|svg|jpg|jpeg)$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestIcon {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestIcon {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestIcon {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestIcon {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "OpenRiskPluginManifestInputsItem"]
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
#[doc = "      \"description\": \"Input parameter name (can use *args or **kwargs syntax)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^(\\\\*{0,2}[a-z][a-z0-9_]*)$\""]
#[doc = "    },"]
#[doc = "    \"optional\": {"]
#[doc = "      \"description\": \"Whether this input is optional\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"title\": {"]
#[doc = "      \"description\": \"Human-readable input name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"type\": {"]
#[doc = "      \"description\": \"Input data type (supports list[T] and map[K,V] syntax)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^(string|number|boolean|list\\\\[\\\\w+\\\\]|map\\\\[\\\\w+,\\\\s*\\\\w+\\\\])$\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifestInputsItem {
    #[doc = "Default value for optional inputs"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[doc = "Detailed input description"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[doc = "Input parameter name (can use *args or **kwargs syntax)"]
    pub name: OpenRiskPluginManifestInputsItemName,
    #[doc = "Whether this input is optional"]
    #[serde(default)]
    pub optional: bool,
    #[doc = "Human-readable input name"]
    pub title: String,
    #[doc = "Input data type (supports list[T] and map[K,V] syntax)"]
    #[serde(rename = "type")]
    pub type_: OpenRiskPluginManifestInputsItemType,
}
impl From<&OpenRiskPluginManifestInputsItem> for OpenRiskPluginManifestInputsItem {
    fn from(value: &OpenRiskPluginManifestInputsItem) -> Self {
        value.clone()
    }
}
impl OpenRiskPluginManifestInputsItem {
    pub fn builder() -> builder::OpenRiskPluginManifestInputsItem {
        Default::default()
    }
}
#[doc = "Input parameter name (can use *args or **kwargs syntax)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Input parameter name (can use *args or **kwargs syntax)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^(\\\\*{0,2}[a-z][a-z0-9_]*)$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestInputsItemName(String);
impl std::ops::Deref for OpenRiskPluginManifestInputsItemName {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestInputsItemName> for String {
    fn from(value: OpenRiskPluginManifestInputsItemName) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestInputsItemName> for OpenRiskPluginManifestInputsItemName {
    fn from(value: &OpenRiskPluginManifestInputsItemName) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestInputsItemName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if regress::Regex::new("^(\\*{0,2}[a-z][a-z0-9_]*)$")
            .unwrap()
            .find(value)
            .is_none()
        {
            return Err("doesn't match pattern \"^(\\*{0,2}[a-z][a-z0-9_]*)$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestInputsItemName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestInputsItemName {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestInputsItemName {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestInputsItemName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Input data type (supports list[T] and map[K,V] syntax)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Input data type (supports list[T] and map[K,V] syntax)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^(string|number|boolean|list\\\\[\\\\w+\\\\]|map\\\\[\\\\w+,\\\\s*\\\\w+\\\\])$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestInputsItemType(String);
impl std::ops::Deref for OpenRiskPluginManifestInputsItemType {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestInputsItemType> for String {
    fn from(value: OpenRiskPluginManifestInputsItemType) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestInputsItemType> for OpenRiskPluginManifestInputsItemType {
    fn from(value: &OpenRiskPluginManifestInputsItemType) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestInputsItemType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if regress::Regex::new("^(string|number|boolean|list\\[\\w+\\]|map\\[\\w+,\\s*\\w+\\])$")
            .unwrap()
            .find(value)
            .is_none()
        {
            return Err ("doesn't match pattern \"^(string|number|boolean|list\\[\\w+\\]|map\\[\\w+,\\s*\\w+\\])$\"" . into ()) ;
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestInputsItemType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestInputsItemType {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestInputsItemType {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestInputsItemType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
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
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestLicense(String);
impl std::ops::Deref for OpenRiskPluginManifestLicense {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestLicense> for String {
    fn from(value: OpenRiskPluginManifestLicense) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestLicense> for OpenRiskPluginManifestLicense {
    fn from(value: &OpenRiskPluginManifestLicense) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestLicense {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if value.len() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestLicense {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestLicense {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestLicense {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestLicense {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
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
#[doc = "  \"maxLength\": 255,"]
#[doc = "  \"minLength\": 1"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestName(String);
impl std::ops::Deref for OpenRiskPluginManifestName {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestName> for String {
    fn from(value: OpenRiskPluginManifestName) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestName> for OpenRiskPluginManifestName {
    fn from(value: &OpenRiskPluginManifestName) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if value.len() > 255usize {
            return Err("longer than 255 characters".into());
        }
        if value.len() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestName {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestName {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "OpenRiskPluginManifestOutputsItem"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"required\": ["]
#[doc = "    \"name\","]
#[doc = "    \"type\""]
#[doc = "  ],"]
#[doc = "  \"properties\": {"]
#[doc = "    \"description\": {"]
#[doc = "      \"description\": \"Output field description\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"name\": {"]
#[doc = "      \"description\": \"Output field name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"type\": {"]
#[doc = "      \"description\": \"Output data type\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifestOutputsItem {
    #[doc = "Output field description"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[doc = "Output field name"]
    pub name: String,
    #[doc = "Output data type"]
    #[serde(rename = "type")]
    pub type_: String,
}
impl From<&OpenRiskPluginManifestOutputsItem> for OpenRiskPluginManifestOutputsItem {
    fn from(value: &OpenRiskPluginManifestOutputsItem) -> Self {
        value.clone()
    }
}
impl OpenRiskPluginManifestOutputsItem {
    pub fn builder() -> builder::OpenRiskPluginManifestOutputsItem {
        Default::default()
    }
}
#[doc = "Plugin permission requirements"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Plugin permission requirements\","]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"properties\": {"]
#[doc = "    \"env\": {"]
#[doc = "      \"description\": \"Requires environment variable access\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"filesystem\": {"]
#[doc = "      \"description\": \"Requires filesystem access\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"network\": {"]
#[doc = "      \"description\": \"Requires network access\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifestPermissions {
    #[doc = "Requires environment variable access"]
    #[serde(default)]
    pub env: bool,
    #[doc = "Requires filesystem access"]
    #[serde(default)]
    pub filesystem: bool,
    #[doc = "Requires network access"]
    #[serde(default)]
    pub network: bool,
}
impl From<&OpenRiskPluginManifestPermissions> for OpenRiskPluginManifestPermissions {
    fn from(value: &OpenRiskPluginManifestPermissions) -> Self {
        value.clone()
    }
}
impl OpenRiskPluginManifestPermissions {
    pub fn builder() -> builder::OpenRiskPluginManifestPermissions {
        Default::default()
    }
}
#[doc = "OpenRiskPluginManifestSettingsItem"]
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
#[doc = "      \"description\": \"Setting identifier (snake_case)\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"pattern\": \"^[a-z][a-z0-9_]*$\""]
#[doc = "    },"]
#[doc = "    \"required\": {"]
#[doc = "      \"description\": \"Whether this setting is required\","]
#[doc = "      \"default\": false,"]
#[doc = "      \"type\": \"boolean\""]
#[doc = "    },"]
#[doc = "    \"title\": {"]
#[doc = "      \"description\": \"Human-readable setting name\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    },"]
#[doc = "    \"type\": {"]
#[doc = "      \"description\": \"Setting data type\","]
#[doc = "      \"type\": \"string\","]
#[doc = "      \"enum\": ["]
#[doc = "        \"string\","]
#[doc = "        \"number\","]
#[doc = "        \"boolean\","]
#[doc = "        \"array\","]
#[doc = "        \"object\""]
#[doc = "      ]"]
#[doc = "    },"]
#[doc = "    \"validation\": {"]
#[doc = "      \"description\": \"Additional validation rules\","]
#[doc = "      \"type\": \"object\","]
#[doc = "      \"properties\": {"]
#[doc = "        \"enum\": {"]
#[doc = "          \"description\": \"Allowed values\","]
#[doc = "          \"type\": \"array\""]
#[doc = "        },"]
#[doc = "        \"max\": {"]
#[doc = "          \"description\": \"Maximum value (for numbers)\","]
#[doc = "          \"type\": \"number\""]
#[doc = "        },"]
#[doc = "        \"maxLength\": {"]
#[doc = "          \"description\": \"Maximum length (for strings)\","]
#[doc = "          \"type\": \"integer\""]
#[doc = "        },"]
#[doc = "        \"min\": {"]
#[doc = "          \"description\": \"Minimum value (for numbers)\","]
#[doc = "          \"type\": \"number\""]
#[doc = "        },"]
#[doc = "        \"minLength\": {"]
#[doc = "          \"description\": \"Minimum length (for strings)\","]
#[doc = "          \"type\": \"integer\""]
#[doc = "        },"]
#[doc = "        \"pattern\": {"]
#[doc = "          \"description\": \"Regex pattern (for strings)\","]
#[doc = "          \"type\": \"string\""]
#[doc = "        }"]
#[doc = "      },"]
#[doc = "      \"additionalProperties\": false"]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifestSettingsItem {
    #[doc = "Default value for the setting (null allowed)"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[doc = "Detailed setting description"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[doc = "Setting identifier (snake_case)"]
    pub name: OpenRiskPluginManifestSettingsItemName,
    #[doc = "Whether this setting is required"]
    #[serde(default)]
    pub required: bool,
    #[doc = "Human-readable setting name"]
    pub title: String,
    #[doc = "Setting data type"]
    #[serde(rename = "type")]
    pub type_: OpenRiskPluginManifestSettingsItemType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validation: Option<OpenRiskPluginManifestSettingsItemValidation>,
}
impl From<&OpenRiskPluginManifestSettingsItem> for OpenRiskPluginManifestSettingsItem {
    fn from(value: &OpenRiskPluginManifestSettingsItem) -> Self {
        value.clone()
    }
}
impl OpenRiskPluginManifestSettingsItem {
    pub fn builder() -> builder::OpenRiskPluginManifestSettingsItem {
        Default::default()
    }
}
#[doc = "Setting identifier (snake_case)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Setting identifier (snake_case)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^[a-z][a-z0-9_]*$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestSettingsItemName(String);
impl std::ops::Deref for OpenRiskPluginManifestSettingsItemName {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestSettingsItemName> for String {
    fn from(value: OpenRiskPluginManifestSettingsItemName) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestSettingsItemName> for OpenRiskPluginManifestSettingsItemName {
    fn from(value: &OpenRiskPluginManifestSettingsItemName) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestSettingsItemName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if regress::Regex::new("^[a-z][a-z0-9_]*$")
            .unwrap()
            .find(value)
            .is_none()
        {
            return Err("doesn't match pattern \"^[a-z][a-z0-9_]*$\"".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestSettingsItemName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestSettingsItemName {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestSettingsItemName {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestSettingsItemName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = "Setting data type"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Setting data type\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"enum\": ["]
#[doc = "    \"string\","]
#[doc = "    \"number\","]
#[doc = "    \"boolean\","]
#[doc = "    \"array\","]
#[doc = "    \"object\""]
#[doc = "  ]"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub enum OpenRiskPluginManifestSettingsItemType {
    #[serde(rename = "string")]
    String,
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "boolean")]
    Boolean,
    #[serde(rename = "array")]
    Array,
    #[serde(rename = "object")]
    Object,
}
impl From<&OpenRiskPluginManifestSettingsItemType> for OpenRiskPluginManifestSettingsItemType {
    fn from(value: &OpenRiskPluginManifestSettingsItemType) -> Self {
        value.clone()
    }
}
impl ToString for OpenRiskPluginManifestSettingsItemType {
    fn to_string(&self) -> String {
        match *self {
            Self::String => "string".to_string(),
            Self::Number => "number".to_string(),
            Self::Boolean => "boolean".to_string(),
            Self::Array => "array".to_string(),
            Self::Object => "object".to_string(),
        }
    }
}
impl std::str::FromStr for OpenRiskPluginManifestSettingsItemType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        match value {
            "string" => Ok(Self::String),
            "number" => Ok(Self::Number),
            "boolean" => Ok(Self::Boolean),
            "array" => Ok(Self::Array),
            "object" => Ok(Self::Object),
            _ => Err("invalid value".into()),
        }
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestSettingsItemType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestSettingsItemType {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestSettingsItemType {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
#[doc = "Additional validation rules"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Additional validation rules\","]
#[doc = "  \"type\": \"object\","]
#[doc = "  \"properties\": {"]
#[doc = "    \"enum\": {"]
#[doc = "      \"description\": \"Allowed values\","]
#[doc = "      \"type\": \"array\""]
#[doc = "    },"]
#[doc = "    \"max\": {"]
#[doc = "      \"description\": \"Maximum value (for numbers)\","]
#[doc = "      \"type\": \"number\""]
#[doc = "    },"]
#[doc = "    \"maxLength\": {"]
#[doc = "      \"description\": \"Maximum length (for strings)\","]
#[doc = "      \"type\": \"integer\""]
#[doc = "    },"]
#[doc = "    \"min\": {"]
#[doc = "      \"description\": \"Minimum value (for numbers)\","]
#[doc = "      \"type\": \"number\""]
#[doc = "    },"]
#[doc = "    \"minLength\": {"]
#[doc = "      \"description\": \"Minimum length (for strings)\","]
#[doc = "      \"type\": \"integer\""]
#[doc = "    },"]
#[doc = "    \"pattern\": {"]
#[doc = "      \"description\": \"Regex pattern (for strings)\","]
#[doc = "      \"type\": \"string\""]
#[doc = "    }"]
#[doc = "  },"]
#[doc = "  \"additionalProperties\": false"]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenRiskPluginManifestSettingsItemValidation {
    #[doc = "Allowed values"]
    #[serde(rename = "enum", default, skip_serializing_if = "Vec::is_empty")]
    pub enum_: Vec<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[doc = "Maximum length (for strings)"]
    #[serde(rename = "maxLength", default, skip_serializing_if = "Option::is_none")]
    pub max_length: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[doc = "Minimum length (for strings)"]
    #[serde(rename = "minLength", default, skip_serializing_if = "Option::is_none")]
    pub min_length: Option<i64>,
    #[doc = "Regex pattern (for strings)"]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
}
impl From<&OpenRiskPluginManifestSettingsItemValidation>
    for OpenRiskPluginManifestSettingsItemValidation
{
    fn from(value: &OpenRiskPluginManifestSettingsItemValidation) -> Self {
        value.clone()
    }
}
impl OpenRiskPluginManifestSettingsItemValidation {
    pub fn builder() -> builder::OpenRiskPluginManifestSettingsItemValidation {
        Default::default()
    }
}
#[doc = "Plugin version in semver format (e.g., 0.1.0)"]
#[doc = r""]
#[doc = r" <details><summary>JSON schema</summary>"]
#[doc = r""]
#[doc = r" ```json"]
#[doc = "{"]
#[doc = "  \"description\": \"Plugin version in semver format (e.g., 0.1.0)\","]
#[doc = "  \"type\": \"string\","]
#[doc = "  \"pattern\": \"^(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)(?:-((?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\\\.(?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\\\+([0-9a-zA-Z-]+(?:\\\\.[0-9a-zA-Z-]+)*))?$\""]
#[doc = "}"]
#[doc = r" ```"]
#[doc = r" </details>"]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub struct OpenRiskPluginManifestVersion(String);
impl std::ops::Deref for OpenRiskPluginManifestVersion {
    type Target = String;
    fn deref(&self) -> &String {
        &self.0
    }
}
impl From<OpenRiskPluginManifestVersion> for String {
    fn from(value: OpenRiskPluginManifestVersion) -> Self {
        value.0
    }
}
impl From<&OpenRiskPluginManifestVersion> for OpenRiskPluginManifestVersion {
    fn from(value: &OpenRiskPluginManifestVersion) -> Self {
        value.clone()
    }
}
impl std::str::FromStr for OpenRiskPluginManifestVersion {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> Result<Self, self::error::ConversionError> {
        if regress :: Regex :: new ("^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$") . unwrap () . find (value) . is_none () { return Err ("doesn't match pattern \"^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$\"" . into ()) ; }
        Ok(Self(value.to_string()))
    }
}
impl std::convert::TryFrom<&str> for OpenRiskPluginManifestVersion {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<&String> for OpenRiskPluginManifestVersion {
    type Error = self::error::ConversionError;
    fn try_from(value: &String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl std::convert::TryFrom<String> for OpenRiskPluginManifestVersion {
    type Error = self::error::ConversionError;
    fn try_from(value: String) -> Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> serde::Deserialize<'de> for OpenRiskPluginManifestVersion {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as serde::de::Error>::custom(e.to_string())
            })
    }
}
#[doc = r" Types for composing complex structures."]
pub mod builder {
    #[derive(Clone, Debug)]
    pub struct OpenRiskPluginManifest {
        authors: Result<Vec<super::OpenRiskPluginManifestAuthorsItem>, String>,
        description: Result<super::OpenRiskPluginManifestDescription, String>,
        entrypoint: Result<super::OpenRiskPluginManifestEntrypoint, String>,
        homepage: Result<Option<String>, String>,
        icon: Result<Option<super::OpenRiskPluginManifestIcon>, String>,
        inputs: Result<Vec<super::OpenRiskPluginManifestInputsItem>, String>,
        keywords: Result<Vec<String>, String>,
        license: Result<super::OpenRiskPluginManifestLicense, String>,
        name: Result<super::OpenRiskPluginManifestName, String>,
        outputs: Result<Vec<super::OpenRiskPluginManifestOutputsItem>, String>,
        permissions: Result<Option<super::OpenRiskPluginManifestPermissions>, String>,
        repository: Result<Option<String>, String>,
        schema: Result<Option<String>, String>,
        settings: Result<Vec<super::OpenRiskPluginManifestSettingsItem>, String>,
        version: Result<super::OpenRiskPluginManifestVersion, String>,
    }
    impl Default for OpenRiskPluginManifest {
        fn default() -> Self {
            Self {
                authors: Err("no value supplied for authors".to_string()),
                description: Err("no value supplied for description".to_string()),
                entrypoint: Err("no value supplied for entrypoint".to_string()),
                homepage: Ok(Default::default()),
                icon: Ok(Default::default()),
                inputs: Ok(Default::default()),
                keywords: Ok(Default::default()),
                license: Err("no value supplied for license".to_string()),
                name: Err("no value supplied for name".to_string()),
                outputs: Ok(Default::default()),
                permissions: Ok(Default::default()),
                repository: Ok(Default::default()),
                schema: Ok(Default::default()),
                settings: Ok(Default::default()),
                version: Err("no value supplied for version".to_string()),
            }
        }
    }
    impl OpenRiskPluginManifest {
        pub fn authors<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Vec<super::OpenRiskPluginManifestAuthorsItem>>,
            T::Error: std::fmt::Display,
        {
            self.authors = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for authors: {}", e));
            self
        }
        pub fn description<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestDescription>,
            T::Error: std::fmt::Display,
        {
            self.description = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for description: {}", e));
            self
        }
        pub fn entrypoint<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestEntrypoint>,
            T::Error: std::fmt::Display,
        {
            self.entrypoint = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for entrypoint: {}", e));
            self
        }
        pub fn homepage<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.homepage = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for homepage: {}", e));
            self
        }
        pub fn icon<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<super::OpenRiskPluginManifestIcon>>,
            T::Error: std::fmt::Display,
        {
            self.icon = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for icon: {}", e));
            self
        }
        pub fn inputs<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Vec<super::OpenRiskPluginManifestInputsItem>>,
            T::Error: std::fmt::Display,
        {
            self.inputs = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for inputs: {}", e));
            self
        }
        pub fn keywords<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Vec<String>>,
            T::Error: std::fmt::Display,
        {
            self.keywords = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for keywords: {}", e));
            self
        }
        pub fn license<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestLicense>,
            T::Error: std::fmt::Display,
        {
            self.license = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for license: {}", e));
            self
        }
        pub fn name<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestName>,
            T::Error: std::fmt::Display,
        {
            self.name = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for name: {}", e));
            self
        }
        pub fn outputs<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Vec<super::OpenRiskPluginManifestOutputsItem>>,
            T::Error: std::fmt::Display,
        {
            self.outputs = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for outputs: {}", e));
            self
        }
        pub fn permissions<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<super::OpenRiskPluginManifestPermissions>>,
            T::Error: std::fmt::Display,
        {
            self.permissions = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for permissions: {}", e));
            self
        }
        pub fn repository<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.repository = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for repository: {}", e));
            self
        }
        pub fn schema<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.schema = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for schema: {}", e));
            self
        }
        pub fn settings<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Vec<super::OpenRiskPluginManifestSettingsItem>>,
            T::Error: std::fmt::Display,
        {
            self.settings = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for settings: {}", e));
            self
        }
        pub fn version<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestVersion>,
            T::Error: std::fmt::Display,
        {
            self.version = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for version: {}", e));
            self
        }
    }
    impl std::convert::TryFrom<OpenRiskPluginManifest> for super::OpenRiskPluginManifest {
        type Error = super::error::ConversionError;
        fn try_from(value: OpenRiskPluginManifest) -> Result<Self, super::error::ConversionError> {
            Ok(Self {
                authors: value.authors?,
                description: value.description?,
                entrypoint: value.entrypoint?,
                homepage: value.homepage?,
                icon: value.icon?,
                inputs: value.inputs?,
                keywords: value.keywords?,
                license: value.license?,
                name: value.name?,
                outputs: value.outputs?,
                permissions: value.permissions?,
                repository: value.repository?,
                schema: value.schema?,
                settings: value.settings?,
                version: value.version?,
            })
        }
    }
    impl From<super::OpenRiskPluginManifest> for OpenRiskPluginManifest {
        fn from(value: super::OpenRiskPluginManifest) -> Self {
            Self {
                authors: Ok(value.authors),
                description: Ok(value.description),
                entrypoint: Ok(value.entrypoint),
                homepage: Ok(value.homepage),
                icon: Ok(value.icon),
                inputs: Ok(value.inputs),
                keywords: Ok(value.keywords),
                license: Ok(value.license),
                name: Ok(value.name),
                outputs: Ok(value.outputs),
                permissions: Ok(value.permissions),
                repository: Ok(value.repository),
                schema: Ok(value.schema),
                settings: Ok(value.settings),
                version: Ok(value.version),
            }
        }
    }
    #[derive(Clone, Debug)]
    pub struct OpenRiskPluginManifestAuthorsItem {
        email: Result<Option<String>, String>,
        name: Result<String, String>,
        url: Result<Option<String>, String>,
    }
    impl Default for OpenRiskPluginManifestAuthorsItem {
        fn default() -> Self {
            Self {
                email: Ok(Default::default()),
                name: Err("no value supplied for name".to_string()),
                url: Ok(Default::default()),
            }
        }
    }
    impl OpenRiskPluginManifestAuthorsItem {
        pub fn email<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.email = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for email: {}", e));
            self
        }
        pub fn name<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<String>,
            T::Error: std::fmt::Display,
        {
            self.name = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for name: {}", e));
            self
        }
        pub fn url<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.url = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for url: {}", e));
            self
        }
    }
    impl std::convert::TryFrom<OpenRiskPluginManifestAuthorsItem>
        for super::OpenRiskPluginManifestAuthorsItem
    {
        type Error = super::error::ConversionError;
        fn try_from(
            value: OpenRiskPluginManifestAuthorsItem,
        ) -> Result<Self, super::error::ConversionError> {
            Ok(Self {
                email: value.email?,
                name: value.name?,
                url: value.url?,
            })
        }
    }
    impl From<super::OpenRiskPluginManifestAuthorsItem> for OpenRiskPluginManifestAuthorsItem {
        fn from(value: super::OpenRiskPluginManifestAuthorsItem) -> Self {
            Self {
                email: Ok(value.email),
                name: Ok(value.name),
                url: Ok(value.url),
            }
        }
    }
    #[derive(Clone, Debug)]
    pub struct OpenRiskPluginManifestInputsItem {
        default: Result<Option<serde_json::Value>, String>,
        description: Result<Option<String>, String>,
        name: Result<super::OpenRiskPluginManifestInputsItemName, String>,
        optional: Result<bool, String>,
        title: Result<String, String>,
        type_: Result<super::OpenRiskPluginManifestInputsItemType, String>,
    }
    impl Default for OpenRiskPluginManifestInputsItem {
        fn default() -> Self {
            Self {
                default: Ok(Default::default()),
                description: Ok(Default::default()),
                name: Err("no value supplied for name".to_string()),
                optional: Ok(Default::default()),
                title: Err("no value supplied for title".to_string()),
                type_: Err("no value supplied for type_".to_string()),
            }
        }
    }
    impl OpenRiskPluginManifestInputsItem {
        pub fn default<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<serde_json::Value>>,
            T::Error: std::fmt::Display,
        {
            self.default = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for default: {}", e));
            self
        }
        pub fn description<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.description = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for description: {}", e));
            self
        }
        pub fn name<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestInputsItemName>,
            T::Error: std::fmt::Display,
        {
            self.name = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for name: {}", e));
            self
        }
        pub fn optional<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<bool>,
            T::Error: std::fmt::Display,
        {
            self.optional = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for optional: {}", e));
            self
        }
        pub fn title<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<String>,
            T::Error: std::fmt::Display,
        {
            self.title = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for title: {}", e));
            self
        }
        pub fn type_<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestInputsItemType>,
            T::Error: std::fmt::Display,
        {
            self.type_ = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for type_: {}", e));
            self
        }
    }
    impl std::convert::TryFrom<OpenRiskPluginManifestInputsItem>
        for super::OpenRiskPluginManifestInputsItem
    {
        type Error = super::error::ConversionError;
        fn try_from(
            value: OpenRiskPluginManifestInputsItem,
        ) -> Result<Self, super::error::ConversionError> {
            Ok(Self {
                default: value.default?,
                description: value.description?,
                name: value.name?,
                optional: value.optional?,
                title: value.title?,
                type_: value.type_?,
            })
        }
    }
    impl From<super::OpenRiskPluginManifestInputsItem> for OpenRiskPluginManifestInputsItem {
        fn from(value: super::OpenRiskPluginManifestInputsItem) -> Self {
            Self {
                default: Ok(value.default),
                description: Ok(value.description),
                name: Ok(value.name),
                optional: Ok(value.optional),
                title: Ok(value.title),
                type_: Ok(value.type_),
            }
        }
    }
    #[derive(Clone, Debug)]
    pub struct OpenRiskPluginManifestOutputsItem {
        description: Result<Option<String>, String>,
        name: Result<String, String>,
        type_: Result<String, String>,
    }
    impl Default for OpenRiskPluginManifestOutputsItem {
        fn default() -> Self {
            Self {
                description: Ok(Default::default()),
                name: Err("no value supplied for name".to_string()),
                type_: Err("no value supplied for type_".to_string()),
            }
        }
    }
    impl OpenRiskPluginManifestOutputsItem {
        pub fn description<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.description = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for description: {}", e));
            self
        }
        pub fn name<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<String>,
            T::Error: std::fmt::Display,
        {
            self.name = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for name: {}", e));
            self
        }
        pub fn type_<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<String>,
            T::Error: std::fmt::Display,
        {
            self.type_ = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for type_: {}", e));
            self
        }
    }
    impl std::convert::TryFrom<OpenRiskPluginManifestOutputsItem>
        for super::OpenRiskPluginManifestOutputsItem
    {
        type Error = super::error::ConversionError;
        fn try_from(
            value: OpenRiskPluginManifestOutputsItem,
        ) -> Result<Self, super::error::ConversionError> {
            Ok(Self {
                description: value.description?,
                name: value.name?,
                type_: value.type_?,
            })
        }
    }
    impl From<super::OpenRiskPluginManifestOutputsItem> for OpenRiskPluginManifestOutputsItem {
        fn from(value: super::OpenRiskPluginManifestOutputsItem) -> Self {
            Self {
                description: Ok(value.description),
                name: Ok(value.name),
                type_: Ok(value.type_),
            }
        }
    }
    #[derive(Clone, Debug)]
    pub struct OpenRiskPluginManifestPermissions {
        env: Result<bool, String>,
        filesystem: Result<bool, String>,
        network: Result<bool, String>,
    }
    impl Default for OpenRiskPluginManifestPermissions {
        fn default() -> Self {
            Self {
                env: Ok(Default::default()),
                filesystem: Ok(Default::default()),
                network: Ok(Default::default()),
            }
        }
    }
    impl OpenRiskPluginManifestPermissions {
        pub fn env<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<bool>,
            T::Error: std::fmt::Display,
        {
            self.env = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for env: {}", e));
            self
        }
        pub fn filesystem<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<bool>,
            T::Error: std::fmt::Display,
        {
            self.filesystem = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for filesystem: {}", e));
            self
        }
        pub fn network<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<bool>,
            T::Error: std::fmt::Display,
        {
            self.network = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for network: {}", e));
            self
        }
    }
    impl std::convert::TryFrom<OpenRiskPluginManifestPermissions>
        for super::OpenRiskPluginManifestPermissions
    {
        type Error = super::error::ConversionError;
        fn try_from(
            value: OpenRiskPluginManifestPermissions,
        ) -> Result<Self, super::error::ConversionError> {
            Ok(Self {
                env: value.env?,
                filesystem: value.filesystem?,
                network: value.network?,
            })
        }
    }
    impl From<super::OpenRiskPluginManifestPermissions> for OpenRiskPluginManifestPermissions {
        fn from(value: super::OpenRiskPluginManifestPermissions) -> Self {
            Self {
                env: Ok(value.env),
                filesystem: Ok(value.filesystem),
                network: Ok(value.network),
            }
        }
    }
    #[derive(Clone, Debug)]
    pub struct OpenRiskPluginManifestSettingsItem {
        default: Result<Option<serde_json::Value>, String>,
        description: Result<Option<String>, String>,
        name: Result<super::OpenRiskPluginManifestSettingsItemName, String>,
        required: Result<bool, String>,
        title: Result<String, String>,
        type_: Result<super::OpenRiskPluginManifestSettingsItemType, String>,
        validation: Result<Option<super::OpenRiskPluginManifestSettingsItemValidation>, String>,
    }
    impl Default for OpenRiskPluginManifestSettingsItem {
        fn default() -> Self {
            Self {
                default: Ok(Default::default()),
                description: Ok(Default::default()),
                name: Err("no value supplied for name".to_string()),
                required: Ok(Default::default()),
                title: Err("no value supplied for title".to_string()),
                type_: Err("no value supplied for type_".to_string()),
                validation: Ok(Default::default()),
            }
        }
    }
    impl OpenRiskPluginManifestSettingsItem {
        pub fn default<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<serde_json::Value>>,
            T::Error: std::fmt::Display,
        {
            self.default = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for default: {}", e));
            self
        }
        pub fn description<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.description = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for description: {}", e));
            self
        }
        pub fn name<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestSettingsItemName>,
            T::Error: std::fmt::Display,
        {
            self.name = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for name: {}", e));
            self
        }
        pub fn required<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<bool>,
            T::Error: std::fmt::Display,
        {
            self.required = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for required: {}", e));
            self
        }
        pub fn title<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<String>,
            T::Error: std::fmt::Display,
        {
            self.title = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for title: {}", e));
            self
        }
        pub fn type_<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<super::OpenRiskPluginManifestSettingsItemType>,
            T::Error: std::fmt::Display,
        {
            self.type_ = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for type_: {}", e));
            self
        }
        pub fn validation<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<super::OpenRiskPluginManifestSettingsItemValidation>>,
            T::Error: std::fmt::Display,
        {
            self.validation = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for validation: {}", e));
            self
        }
    }
    impl std::convert::TryFrom<OpenRiskPluginManifestSettingsItem>
        for super::OpenRiskPluginManifestSettingsItem
    {
        type Error = super::error::ConversionError;
        fn try_from(
            value: OpenRiskPluginManifestSettingsItem,
        ) -> Result<Self, super::error::ConversionError> {
            Ok(Self {
                default: value.default?,
                description: value.description?,
                name: value.name?,
                required: value.required?,
                title: value.title?,
                type_: value.type_?,
                validation: value.validation?,
            })
        }
    }
    impl From<super::OpenRiskPluginManifestSettingsItem> for OpenRiskPluginManifestSettingsItem {
        fn from(value: super::OpenRiskPluginManifestSettingsItem) -> Self {
            Self {
                default: Ok(value.default),
                description: Ok(value.description),
                name: Ok(value.name),
                required: Ok(value.required),
                title: Ok(value.title),
                type_: Ok(value.type_),
                validation: Ok(value.validation),
            }
        }
    }
    #[derive(Clone, Debug)]
    pub struct OpenRiskPluginManifestSettingsItemValidation {
        enum_: Result<Vec<serde_json::Value>, String>,
        max: Result<Option<f64>, String>,
        max_length: Result<Option<i64>, String>,
        min: Result<Option<f64>, String>,
        min_length: Result<Option<i64>, String>,
        pattern: Result<Option<String>, String>,
    }
    impl Default for OpenRiskPluginManifestSettingsItemValidation {
        fn default() -> Self {
            Self {
                enum_: Ok(Default::default()),
                max: Ok(Default::default()),
                max_length: Ok(Default::default()),
                min: Ok(Default::default()),
                min_length: Ok(Default::default()),
                pattern: Ok(Default::default()),
            }
        }
    }
    impl OpenRiskPluginManifestSettingsItemValidation {
        pub fn enum_<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Vec<serde_json::Value>>,
            T::Error: std::fmt::Display,
        {
            self.enum_ = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for enum_: {}", e));
            self
        }
        pub fn max<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<f64>>,
            T::Error: std::fmt::Display,
        {
            self.max = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for max: {}", e));
            self
        }
        pub fn max_length<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<i64>>,
            T::Error: std::fmt::Display,
        {
            self.max_length = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for max_length: {}", e));
            self
        }
        pub fn min<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<f64>>,
            T::Error: std::fmt::Display,
        {
            self.min = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for min: {}", e));
            self
        }
        pub fn min_length<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<i64>>,
            T::Error: std::fmt::Display,
        {
            self.min_length = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for min_length: {}", e));
            self
        }
        pub fn pattern<T>(mut self, value: T) -> Self
        where
            T: std::convert::TryInto<Option<String>>,
            T::Error: std::fmt::Display,
        {
            self.pattern = value
                .try_into()
                .map_err(|e| format!("error converting supplied value for pattern: {}", e));
            self
        }
    }
    impl std::convert::TryFrom<OpenRiskPluginManifestSettingsItemValidation>
        for super::OpenRiskPluginManifestSettingsItemValidation
    {
        type Error = super::error::ConversionError;
        fn try_from(
            value: OpenRiskPluginManifestSettingsItemValidation,
        ) -> Result<Self, super::error::ConversionError> {
            Ok(Self {
                enum_: value.enum_?,
                max: value.max?,
                max_length: value.max_length?,
                min: value.min?,
                min_length: value.min_length?,
                pattern: value.pattern?,
            })
        }
    }
    impl From<super::OpenRiskPluginManifestSettingsItemValidation>
        for OpenRiskPluginManifestSettingsItemValidation
    {
        fn from(value: super::OpenRiskPluginManifestSettingsItemValidation) -> Self {
            Self {
                enum_: Ok(value.enum_),
                max: Ok(value.max),
                max_length: Ok(value.max_length),
                min: Ok(value.min),
                min_length: Ok(value.min_length),
                pattern: Ok(value.pattern),
            }
        }
    }
}
