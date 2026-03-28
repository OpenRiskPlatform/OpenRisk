//! Public API for the project subsystem.
//!
//! Re-exports the [`ProjectPersistence`] trait, the [`SqliteProjectPersistence`] production
//! implementation, and all domain types. Command handlers obtain a project instance from Tauri
//! managed state rather than calling thin wrapper functions.
//!
//! Business logic that goes beyond raw DB access (plugin execution, disk I/O, settings merging)
//! lives in the [`service`] module.

mod db;
mod plugins;
mod security;
pub mod service;
mod types;

pub use db::{ProjectPersistence, SqliteProjectPersistence};
pub use types::*;
