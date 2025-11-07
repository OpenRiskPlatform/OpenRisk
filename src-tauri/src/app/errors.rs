use serde::Serialize;
use serde_json::Value;
use std::fmt;

pub type AppResult<T> = Result<T, AppError>;
pub type PersistenceResult<T> = Result<T, PersistenceError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AppErrorKind {
    Validation,
    NotFound,
    Conflict,
    Persistence,
    Io,
    Database,
    Execution,
    Serialization,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PersistenceErrorKind {
    Validation,
    Io,
    Database,
    NotFound,
    Serialization,
    Conflict,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub kind: AppErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

impl AppError {
    pub fn new(kind: AppErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            metadata: None,
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(AppErrorKind::Validation, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(AppErrorKind::NotFound, message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(AppErrorKind::Conflict, message)
    }

    pub fn with_metadata(kind: AppErrorKind, message: impl Into<String>, metadata: Value) -> Self {
        Self {
            kind,
            message: message.into(),
            metadata: Some(metadata),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

#[derive(Debug, Clone)]
pub struct PersistenceError {
    pub kind: PersistenceErrorKind,
    pub message: String,
    pub metadata: Option<Value>,
}

impl PersistenceError {
    pub fn new(kind: PersistenceErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            metadata: None,
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(PersistenceErrorKind::Validation, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(PersistenceErrorKind::NotFound, message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(PersistenceErrorKind::Conflict, message)
    }

    pub fn with_metadata(
        kind: PersistenceErrorKind,
        message: impl Into<String>,
        metadata: Value,
    ) -> Self {
        Self {
            kind,
            message: message.into(),
            metadata: Some(metadata),
        }
    }
}

impl fmt::Display for PersistenceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for PersistenceError {}

impl From<PersistenceError> for AppError {
    fn from(value: PersistenceError) -> Self {
        let kind = match value.kind {
            PersistenceErrorKind::Validation => AppErrorKind::Validation,
            PersistenceErrorKind::NotFound => AppErrorKind::NotFound,
            PersistenceErrorKind::Conflict => AppErrorKind::Conflict,
            PersistenceErrorKind::Io => AppErrorKind::Io,
            PersistenceErrorKind::Database => AppErrorKind::Database,
            PersistenceErrorKind::Serialization => AppErrorKind::Serialization,
            PersistenceErrorKind::Unknown => AppErrorKind::Unknown,
        };

        AppError {
            kind,
            message: value.message,
            metadata: value.metadata,
        }
    }
}

impl From<std::io::Error> for PersistenceError {
    fn from(value: std::io::Error) -> Self {
        PersistenceError::new(PersistenceErrorKind::Io, format!("I/O error: {}", value))
    }
}

impl From<serde_json::Error> for PersistenceError {
    fn from(value: serde_json::Error) -> Self {
        PersistenceError::new(
            PersistenceErrorKind::Serialization,
            format!("Serialization error: {}", value),
        )
    }
}
