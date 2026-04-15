//! Project encryption helpers: in-process key cache and input validation.
//!
//! Passwords are never stored on disk; they live only in the per-process `PROJECT_KEYS` map
//! keyed by the canonical absolute path of the database file.

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

use super::types::PersistenceError;

pub const LOCKED_PROJECT_ERROR_PREFIX: &str = "PROJECT_LOCKED:";
const MIN_PASSWORD_LEN: usize = 8;

/// In-process cache: canonical DB path → current unlock password.
static PROJECT_KEYS: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn canonical_key_path(path: &Path) -> String {
    fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
}

/// Retrieve the cached decryption key for `path`, if one was stored this session.
pub fn get_cached_key(path: &Path) -> Option<String> {
    let key = canonical_key_path(path);
    PROJECT_KEYS
        .lock()
        .ok()
        .and_then(|guard| guard.get(&key).cloned())
}

/// Store a decryption key in the in-process cache.
pub fn cache_key(path: &Path, password: String) {
    let key = canonical_key_path(path);
    if let Ok(mut guard) = PROJECT_KEYS.lock() {
        guard.insert(key, password);
    }
}

/// Remove the cached decryption key for `path`.
pub fn clear_cached_key(path: &Path) {
    let key = canonical_key_path(path);
    if let Ok(mut guard) = PROJECT_KEYS.lock() {
        guard.remove(&key);
    }
}

/// Build the standardised "project is locked" error string sent to the frontend.
pub fn lock_error() -> String {
    format!(
        "{}Project file is encrypted. Unlock it first.",
        LOCKED_PROJECT_ERROR_PREFIX
    )
}

/// Safely escape a string for use as a SQLite string literal (single-quote doubling).
pub fn escape_sql_literal(value: &str) -> String {
    value.replace('\'', "''")
}

/// Validate that a new password meets the minimum length requirement.
pub fn validate_password(value: &str) -> Result<(), PersistenceError> {
    if value.len() < MIN_PASSWORD_LEN {
        return Err(PersistenceError::Validation(format!(
            "Password must be at least {} characters",
            MIN_PASSWORD_LEN
        )));
    }
    Ok(())
}

/// Validate that a password field is not blank (used for current-password checks).
pub fn validate_non_empty_password(value: &str, field: &str) -> Result<(), PersistenceError> {
    if value.trim().is_empty() {
        return Err(PersistenceError::Validation(format!(
            "{} must not be empty",
            field
        )));
    }
    Ok(())
}
