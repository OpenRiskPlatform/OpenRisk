//! Native application API used by the macOS SwiftUI client.
//!
//! The adapter exposes application records rather than UI-runtime types so
//! SwiftUI and Tauri both execute the same shared OpenRisk core use cases.

mod client;
mod error;
mod records;

pub use client::NativeOpenRiskClient;
pub use error::NativeOpenRiskError;
pub use records::*;

uniffi::setup_scaffolding!();
