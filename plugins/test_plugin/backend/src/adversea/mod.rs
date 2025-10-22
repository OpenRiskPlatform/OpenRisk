use std::sync::LazyLock;

mod utils;

pub mod models;
pub mod endpoints;
pub use endpoints::*;

const URL: &'static str = "https://adversea.com/api/gateway-service"; 

static ADVERSEA_TOKEN: LazyLock<String> = LazyLock::new(||
    std::env::var("ADVERSEA_TOKEN").expect("ADVERSEA_TOKEN not found")
);

