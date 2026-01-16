use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Plugin {
    name: String,
    version: String,
    description: String,
    authors: Vec<String>,
    license: String,
    entrypoint: String,
}
