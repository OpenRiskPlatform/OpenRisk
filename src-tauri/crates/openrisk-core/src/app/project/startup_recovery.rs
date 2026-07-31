//! Startup reconciliation for scans left `Running` after an unclean app shutdown.
//!
//! Plugin execution is process-local and has no durable checkpoint. Re-running it automatically
//! could repeat paid or externally visible operations, so the default policy marks interrupted
//! scans as failed. The policy is deliberately isolated here so app shells do not implement
//! different recovery behavior.

use super::types::PersistenceError;
use sqlx::SqliteConnection;

/// What to do with persisted `Running` scans when a project is opened.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub enum InterruptedScanPolicy {
    /// Leave interrupted scans untouched. Useful when recovery is managed externally.
    Off,
    /// Mark interrupted scans as failed. This is the safe default.
    #[default]
    Fail,
    /// Restore interrupted scans as drafts so the user can explicitly run them again.
    RestoreDraft,
}

impl InterruptedScanPolicy {
    /// Parse a persisted configuration value. Unknown values use the safe default.
    pub fn from_config_value(value: &str) -> Self {
        Self::try_from_config_value(value).unwrap_or_default()
    }

    /// Parse a user-provided value without silently accepting a typo.
    pub fn try_from_config_value(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "off" | "disabled" | "ignore" => Some(Self::Off),
            "draft" | "restore-draft" | "resume" => Some(Self::RestoreDraft),
            "fail" | "failed" | "invalidate" => Some(Self::Fail),
            _ => None,
        }
    }

    /// Stable value stored in project settings.
    pub fn as_config_value(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::Fail => "fail",
            Self::RestoreDraft => "draft",
        }
    }
}

pub(super) async fn reconcile_interrupted_scans(
    conn: &mut SqliteConnection,
    policy: InterruptedScanPolicy,
) -> Result<u64, PersistenceError> {
    let next_status = match policy {
        InterruptedScanPolicy::Off => return Ok(0),
        InterruptedScanPolicy::Fail => "Failed",
        InterruptedScanPolicy::RestoreDraft => "Draft",
    };

    let result = sqlx::query("UPDATE Scan SET status = ?1 WHERE status = 'Running'")
        .bind(next_status)
        .execute(conn)
        .await?;

    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Connection;

    async fn scan_connection() -> SqliteConnection {
        let mut conn = SqliteConnection::connect("sqlite::memory:")
            .await
            .expect("open in-memory database");
        sqlx::query("CREATE TABLE Scan (id TEXT PRIMARY KEY, status TEXT NOT NULL)")
            .execute(&mut conn)
            .await
            .expect("create scan table");
        for (id, status) in [
            ("running", "Running"),
            ("completed", "Completed"),
            ("draft", "Draft"),
        ] {
            sqlx::query("INSERT INTO Scan (id, status) VALUES (?1, ?2)")
                .bind(id)
                .bind(status)
                .execute(&mut conn)
                .await
                .expect("insert scan");
        }
        conn
    }

    async fn status(conn: &mut SqliteConnection, id: &str) -> String {
        sqlx::query_scalar("SELECT status FROM Scan WHERE id = ?1")
            .bind(id)
            .fetch_one(conn)
            .await
            .expect("load status")
    }

    #[test]
    fn parses_configured_policies_with_safe_fallback() {
        assert_eq!(
            InterruptedScanPolicy::from_config_value("off"),
            InterruptedScanPolicy::Off
        );
        assert_eq!(
            InterruptedScanPolicy::from_config_value("resume"),
            InterruptedScanPolicy::RestoreDraft
        );
        assert_eq!(
            InterruptedScanPolicy::from_config_value("unexpected"),
            InterruptedScanPolicy::Fail
        );
        assert_eq!(
            InterruptedScanPolicy::try_from_config_value("unexpected"),
            None
        );
    }

    #[tokio::test]
    async fn fail_policy_only_invalidates_running_scans() {
        let mut conn = scan_connection().await;

        let recovered = reconcile_interrupted_scans(&mut conn, InterruptedScanPolicy::Fail)
            .await
            .expect("reconcile scans");

        assert_eq!(recovered, 1);
        assert_eq!(status(&mut conn, "running").await, "Failed");
        assert_eq!(status(&mut conn, "completed").await, "Completed");
        assert_eq!(status(&mut conn, "draft").await, "Draft");
    }

    #[tokio::test]
    async fn draft_policy_makes_an_interrupted_scan_runnable_again() {
        let mut conn = scan_connection().await;

        reconcile_interrupted_scans(&mut conn, InterruptedScanPolicy::RestoreDraft)
            .await
            .expect("reconcile scans");

        assert_eq!(status(&mut conn, "running").await, "Draft");
    }

    #[tokio::test]
    async fn off_policy_preserves_running_scans() {
        let mut conn = scan_connection().await;

        let recovered = reconcile_interrupted_scans(&mut conn, InterruptedScanPolicy::Off)
            .await
            .expect("reconcile scans");

        assert_eq!(recovered, 0);
        assert_eq!(status(&mut conn, "running").await, "Running");
    }
}
