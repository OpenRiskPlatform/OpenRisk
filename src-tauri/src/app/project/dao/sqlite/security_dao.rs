//! DAO functions for project password management.

use crate::app::project::security::{
    cache_key, clear_cached_key, validate_non_empty_password, validate_password,
};
use crate::app::project::session::SqliteProjectPersistence;
use crate::app::project::types::*;

pub(super) async fn set_project_password(
    this: &SqliteProjectPersistence,
    new_password: String,
) -> Result<ProjectLockStatus, PersistenceError> {
    validate_password(&new_password)?;
    let status = SqliteProjectPersistence::read_lock_status(&this.db_path).await?;
    if status.locked {
        return Err(PersistenceError::Validation(
            "Project already has a password. Use change_project_password instead.".into(),
        ));
    }
    this.rewrite_and_reconnect(None, Some(new_password.clone()))
        .await?;
    cache_key(&this.db_path, new_password);
    Ok(ProjectLockStatus {
        locked: true,
        unlocked: true,
    })
}

pub(super) async fn change_project_password(
    this: &SqliteProjectPersistence,
    current_password: String,
    new_password: String,
) -> Result<ProjectLockStatus, PersistenceError> {
    validate_password(&new_password)?;
    validate_non_empty_password(&current_password, "Current password")?;
    this.rewrite_and_reconnect(Some(current_password), Some(new_password.clone()))
        .await?;
    cache_key(&this.db_path, new_password);
    Ok(ProjectLockStatus {
        locked: true,
        unlocked: true,
    })
}

pub(super) async fn remove_project_password(
    this: &SqliteProjectPersistence,
    current_password: String,
) -> Result<ProjectLockStatus, PersistenceError> {
    validate_non_empty_password(&current_password, "Current password")?;
    this.rewrite_and_reconnect(Some(current_password), None)
        .await?;
    clear_cached_key(&this.db_path);
    Ok(ProjectLockStatus {
        locked: false,
        unlocked: true,
    })
}
