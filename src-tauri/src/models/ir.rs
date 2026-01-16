use std::any::Any;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use persistance::fs_pm::FSPMError;

#[derive(TS, Serialize, Deserialize)]
#[ts(export)]
struct Name {
    first: String,
    middle: String,
    last: String,
}

#[derive(TS)]
#[ts(export)]
struct Table {
    tables: Vec<Table>,
}

struct Label {}

#[derive(TS)]
struct Person {
    name: Name,
    date_of_birth: String,
}

/*
type TableData = {
  type: "std.table";
  value: {
    headers: string[];
    rows: any[][];
  };
  metadata?: { variant?: "default" | "compact" };
};
*/

#[derive(TS, Serialize, Deserialize)]
enum ReactTypeHint {
    Array,
    Property,
    Date,
    Boolean,
}

#[derive(TS, Deserialize, Serialize)]
struct Type {
    _type: ReactTypeHint,
    value: TypeValue,
}

#[derive(TS, Serialize, Deserialize)]
enum TypeValue {
    String(String),
    Number(u64),
    Address(Address),
    TableData((Vec<String>, Vec<Node>)),
}

struct ArrayData {}

#[derive(TS, Serialize, Deserialize)]
struct Address {
    country: String,
    city: String,
}

#[derive(TS, Serialize, Deserialize)]
#[ts(export)]
struct Node {
    _type: Type,
    inner: Vec<Node>,
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

#[derive(TS, Serialize, Deserialize)]
#[ts(export)]
pub enum GlobalErrors {
    FSPMError(FSPMError),
}