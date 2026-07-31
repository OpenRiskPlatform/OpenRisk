//! Shared OpenRisk backend used by every UI adapter.
//!
//! This crate owns project persistence, scan orchestration, plugin execution,
//! manifest validation, and the domain records returned by those use cases.
//! It deliberately has no dependency on Tauri or UniFFI.

mod app;
mod plugin_manifest;
mod registry_jurisdiction;

use sqlx::migrate::Migrator;

pub use app::{plugin, project};

pub(crate) static EMBEDDED_MIGRATOR: Migrator = sqlx::migrate!("./migrations");
