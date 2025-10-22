use wasm_bindgen::prelude::*;

pub mod adversea;
pub use adversea::*;

// Expose functions to JS via wasm-bindgen
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello from WASM plugin, {}!", name)
}

#[wasm_bindgen]
pub fn test(name: &str) -> Result<String, JsError> {
    format!("Hello from WASM plugin, {}!", name)
}

