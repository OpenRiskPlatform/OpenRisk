use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(TS, Serialize, Deserialize)]
#[ts(export)]
struct Name {
    first: String,
    middle: String,
    last: String,
}

#[derive(TS)]
struct Person {
    name: Name,
    date_of_birth: String,
}

#[derive(TS, Serialize, Deserialize)]
struct Address {
    country: String,
    city: String,
}

#[derive(TS, Serialize, Deserialize)]
#[ts(export)]
pub enum BackendError {
    Message(&'static str),
    ProjectNotFound,
    PluginExecution,
}

#[derive(TS, Serialize, Deserialize)]
#[ts(export)]
pub enum BackendResult<O, E> {
    Ok(O),
    Err(E),
}
