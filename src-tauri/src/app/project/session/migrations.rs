//! Canonical SQLx migration runner for project schema lifecycle.

use crate::app::project::types::PersistenceError;
use sqlx::{migrate::Migrator, SqliteConnection};
use std::path::PathBuf;

fn migrations_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations")
}

pub(super) async fn apply_schema(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    let migrator = Migrator::new(migrations_dir()).await.map_err(|e| {
        PersistenceError::Validation(format!("Failed to load SQLx migrations: {}", e))
    })?;

    migrator.run_direct(conn).await.map_err(|e| {
        PersistenceError::Validation(format!("Failed to run SQLx migrations: {}", e))
    })?;

    Ok(())
}

/// Legacy custom version chain was removed.
/// SQLx migrations are now the only migration source of truth.
pub(super) async fn apply_migrations_to_latest(
    _conn: &mut SqliteConnection,
) -> Result<(), PersistenceError> {
    Ok(())
}
