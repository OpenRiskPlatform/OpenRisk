use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub enum Error {
    Internal(String),
    External(String),
}

impl Error {
    pub(crate) fn internal(error: impl Into<String>) -> Self {
        let error = error.into();

        tracing::error!("Internal error: {}", error);
        Self::Internal(error)
    }

    pub(crate) fn external(error: impl Into<String>) -> Self {
        let error = error.into();

        tracing::error!("External error: {}", error);
        Self::External(error)
    }
}

#[derive(Serialize, Deserialize)]
pub struct ScreeningRPO {
    positions: Vec<String>,
    given_name: String,
    // Some fields could be null, however, the API docs does not tell which
    family_name: Option<String>,
    entry_types: Vec<String>,
    ico: String,
    prev_org_names: Vec<String>,
    source_register: Option<String>,
    latest_org_name: Option<String>,
    effective_to: Option<String>,
    courts_links: Vec<String>,
    involved_persons: Vec<String>
}

#[derive(Default, Serialize, Deserialize)]
pub struct MediaScan {
    user_id: String,
    profile_url: String,
    title: String,
    social_media_platform: String,
}
