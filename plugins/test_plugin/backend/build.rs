use std::process::Command;
use std::path::Path;

fn main() {
    // println!("cargo:rerun-if-changed=src/");

    let frontend_dir = Path::new("../frontend");
    let pkg_dir = Path::new("./pkg");

    println!("🦀 Building Rust backend for WASM...");

    let status = Command::new("wasm-pack")
        .args(["build", "--target", "bundler", "--out-dir", pkg_dir.to_str().unwrap()])
        .status()
        .expect("failed to run wasm-pack");
    if !status.success() {
        panic!("wasm-pack failed");
    }

    println!("📦 Building frontend with Vite...");

    let status = Command::new("npx")
        .args(["vite", "build"])
        .current_dir(&frontend_dir)
        .status()
        .expect("failed to run vite build");
    if !status.success() {
        panic!("vite build failed");
    }

    println!("✅ Plugin build complete!");
}
