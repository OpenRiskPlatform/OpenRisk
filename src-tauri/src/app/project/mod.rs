//! Public API for the project subsystem.
//!
//! Re-exports the [`ProjectPersistence`] trait, the [`SqliteProjectPersistence`] production
//! implementation, and all domain types. Command handlers obtain a project instance from Tauri
//! managed state rather than calling thin wrapper functions.

mod db;
mod plugins;
mod security;
mod types;

pub use db::{ProjectPersistence, SqliteProjectPersistence};
pub use types::*;
