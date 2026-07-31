#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum NativeOpenRiskError {
    #[error("{message}")]
    OperationFailed { message: String },
}

impl NativeOpenRiskError {
    pub(crate) fn operation(error: impl std::fmt::Display) -> Self {
        Self::OperationFailed {
            message: error.to_string(),
        }
    }
}
