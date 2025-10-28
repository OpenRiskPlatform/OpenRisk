/**
 * Mock Plugin Definitions
 * Sample plugins for development and testing
 */

import type { PluginManifest } from "./types";

export const MOCK_PLUGINS: PluginManifest[] = [
  {
    version: "0.1.0",
    name: "Open Sanctions by OpenRiskPlatform",
    description:
      "Search and analyze entities against OpenSanctions database for compliance and risk assessment.",
    authors: [
      {
        name: "OpenRiskPlatform",
        email: "simemail@gmail.com",
      },
    ],
    icon: "icon.png",
    license: "MIT",
    entrypoint: "index.ts",
    settings: [
      {
        name: "open_sanctions_url",
        type: "string",
        title: "Open Sanctions URL",
        description: "The URL of the Open Sanctions instance to connect to.",
        default: "https://api.opensanctions.org/",
      },
      {
        name: "api_key",
        type: "string",
        title: "API Key",
        description: "The API key for accessing the Open Sanctions instance.",
        default: null,
      },
      {
        name: "dry_run",
        type: "boolean",
        title: "Dry Run",
        description:
          "If enabled, the connector will simulate actions without making actual changes.",
        default: false,
      },
    ],
    inputs: [
      {
        name: "name",
        type: "string",
        optional: false,
        title: "Name",
        description: "The name of the entity to search for.",
      },
      {
        name: "age",
        type: "number",
        optional: true,
        title: "Age",
        description: "The age of the entity to search for.",
      },
      {
        name: "*args",
        type: "list[string]",
        optional: true,
        title: "Additional Arguments",
        description: "Additional arguments for the search.",
      },
      {
        name: "**kwargs",
        type: "map[string, string]",
        optional: true,
        title: "Keyword Arguments",
        description: "Keyword arguments for the search.",
      },
    ],
  },
  {
    version: "1.0.0",
    name: "Credit Check Pro",
    description:
      "Comprehensive credit history and financial risk assessment tool.",
    authors: [
      {
        name: "FinRisk Solutions",
        email: "contact@finrisk.example.com",
      },
    ],
    icon: "credit-icon.png",
    license: "Commercial",
    entrypoint: "main.ts",
    settings: [
      {
        name: "api_endpoint",
        type: "string",
        title: "API Endpoint",
        description: "Credit bureau API endpoint URL.",
        default: "https://api.creditbureau.example.com",
      },
      {
        name: "api_key",
        type: "string",
        title: "API Key",
        description: "Your API key for credit bureau access.",
        default: null,
      },
      {
        name: "include_score",
        type: "boolean",
        title: "Include Credit Score",
        description: "Include detailed credit score breakdown in results.",
        default: true,
      },
      {
        name: "timeout",
        type: "number",
        title: "Request Timeout (seconds)",
        description: "Maximum time to wait for credit check response.",
        default: 30,
      },
    ],
    inputs: [
      {
        name: "first_name",
        type: "string",
        optional: false,
        title: "First Name",
        description: "Individual's first name.",
      },
      {
        name: "last_name",
        type: "string",
        optional: false,
        title: "Last Name",
        description: "Individual's last name.",
      },
      {
        name: "ssn",
        type: "string",
        optional: false,
        title: "Social Security Number",
        description: "SSN for credit check (format: XXX-XX-XXXX).",
      },
      {
        name: "date_of_birth",
        type: "string",
        optional: true,
        title: "Date of Birth",
        description: "Date of birth in YYYY-MM-DD format.",
      },
    ],
  },
  {
    version: "2.1.3",
    name: "Identity Verification Plus",
    description:
      "Multi-source identity verification with document authentication and biometric matching.",
    authors: [
      {
        name: "SecureID Technologies",
        email: "support@secureid.example.com",
      },
    ],
    icon: "identity-icon.png",
    license: "MIT",
    entrypoint: "verify.ts",
    settings: [
      {
        name: "verification_level",
        type: "string",
        title: "Verification Level",
        description:
          "Level of identity verification: basic, standard, or enhanced.",
        default: "standard",
      },
      {
        name: "api_url",
        type: "string",
        title: "API URL",
        description: "Identity verification service API URL.",
        default: "https://api.idverify.example.com/v2",
      },
      {
        name: "enable_biometric",
        type: "boolean",
        title: "Enable Biometric Check",
        description: "Include biometric verification in the process.",
        default: false,
      },
    ],
    inputs: [
      {
        name: "full_name",
        type: "string",
        optional: false,
        title: "Full Name",
        description: "Complete legal name of the individual.",
      },
      {
        name: "document_number",
        type: "string",
        optional: false,
        title: "Document Number",
        description: "ID document number (passport, driver's license, etc.).",
      },
      {
        name: "country",
        type: "string",
        optional: false,
        title: "Country",
        description: "Country of document issuance (ISO code).",
      },
      {
        name: "document_type",
        type: "string",
        optional: true,
        title: "Document Type",
        description: "Type of identification document.",
      },
    ],
  },
  {
    version: "1.5.0",
    name: "Fraud Detection AI",
    description:
      "Machine learning-powered fraud detection and anomaly analysis.",
    authors: [
      {
        name: "DataGuard AI",
        email: "info@dataguard.example.com",
      },
    ],
    icon: "fraud-icon.png",
    license: "Apache-2.0",
    entrypoint: "detect.ts",
    settings: [
      {
        name: "model_version",
        type: "string",
        title: "Model Version",
        description: "AI model version to use for detection.",
        default: "v2.5-production",
      },
      {
        name: "sensitivity",
        type: "number",
        title: "Detection Sensitivity",
        description:
          "Fraud detection sensitivity (0-100, higher = more sensitive).",
        default: 75,
      },
      {
        name: "real_time_mode",
        type: "boolean",
        title: "Real-time Mode",
        description: "Enable real-time fraud monitoring.",
        default: true,
      },
    ],
    inputs: [
      {
        name: "transaction_id",
        type: "string",
        optional: false,
        title: "Transaction ID",
        description: "Unique identifier for the transaction to analyze.",
      },
      {
        name: "user_id",
        type: "string",
        optional: false,
        title: "User ID",
        description: "User account identifier.",
      },
      {
        name: "amount",
        type: "number",
        optional: true,
        title: "Transaction Amount",
        description: "Transaction amount in USD.",
      },
      {
        name: "metadata",
        type: "map[string, string]",
        optional: true,
        title: "Additional Metadata",
        description: "Additional transaction context and metadata.",
      },
    ],
  },
];
