//! Canonical SQLx migration runner for project schema lifecycle.

use crate::app::project::types::PersistenceError;
use crate::EMBEDDED_MIGRATOR;
use sqlx::SqliteConnection;

async fn mark_scan_created_at_migration_if_already_applied(
    conn: &mut SqliteConnection,
) -> Result<(), PersistenceError> {
    // Keep SQLx bookkeeping table shape in sync with sqlx-sqlite migrator implementation.
    sqlx::query(
        r#"
CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    checksum BLOB NOT NULL,
    execution_time BIGINT NOT NULL
)
        "#,
    )
    .execute(&mut *conn)
    .await?;

    let has_scan_table: Option<i64> = sqlx::query_scalar(
        r#"SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'Scan' LIMIT 1"#,
    )
    .fetch_optional(&mut *conn)
    .await?;
    if has_scan_table.is_none() {
        return Ok(());
    }

    let has_created_at: Option<i64> = sqlx::query_scalar(
        r#"SELECT 1 FROM pragma_table_info('Scan') WHERE name = 'created_at' LIMIT 1"#,
    )
    .fetch_optional(&mut *conn)
    .await?;
    if has_created_at.is_none() {
        return Ok(());
    }

    let Some(migration) = EMBEDDED_MIGRATOR.iter().find(|m| m.version == 2) else {
        return Ok(());
    };

    let already_applied: Option<i64> =
        sqlx::query_scalar(r#"SELECT 1 FROM _sqlx_migrations WHERE version = ?1 LIMIT 1"#)
            .bind(migration.version)
            .fetch_optional(&mut *conn)
            .await?;
    if already_applied.is_some() {
        return Ok(());
    }

    sqlx::query(
        r#"INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time)
           VALUES (?1, ?2, TRUE, ?3, 0)"#,
    )
    .bind(migration.version)
    .bind(migration.description.as_ref())
    .bind(migration.checksum.as_ref())
    .execute(&mut *conn)
    .await?;

    Ok(())
}

pub(super) async fn apply_schema(conn: &mut SqliteConnection) -> Result<(), PersistenceError> {
    mark_scan_created_at_migration_if_already_applied(conn).await?;

    EMBEDDED_MIGRATOR.run_direct(conn).await.map_err(|e| {
        PersistenceError::Validation(format!("Failed to run SQLx migrations: {}", e))
    })?;

    Ok(())
}
