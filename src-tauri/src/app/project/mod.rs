//! Public API for the project subsystem.
//!
//! Module layout:
//! - [`session`]  — [`SqliteProjectPersistence`] struct, factory methods (create/open),
//!                  connection management, schema migrations, and re-encryption.
//! - [`dao`]      — [`ProjectPersistence`] trait and its `impl` for [`SqliteProjectPersistence`];
//!                  all CRUD operations on an open session.
//! - [`service`]  — Business-logic orchestration: plugin sync, scan execution, settings merge.
//! - [`types`]    — Shared domain DTOs and the [`PersistenceError`] type.
//! - [`plugins`]  — Plugin bundle discovery and loading from disk.
//! - [`security`] — SQLCipher key caching and password validation helpers.

pub(super) mod dao;
mod plugins;
mod security;
pub mod service;
pub(super) mod session;
mod types;

pub use dao::ProjectPersistence;
pub use session::SqliteProjectPersistence;
pub use types::*;
