//! Canonical SQLx migration runner for project schema lifecycle.

use crate::app::project::types::PersistenceError;
use crate::EMBEDDED_MIGRATOR;
use sqlx::SqliteConnection;

pub(super) async fn apply_schema(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    EMBEDDED_MIGRATOR.run_direct(conn).await.map_err(|e| {
        PersistenceError::Validation(format!("Failed to run SQLx migrations: {}", e))
    })?;

    Ok(())
}
