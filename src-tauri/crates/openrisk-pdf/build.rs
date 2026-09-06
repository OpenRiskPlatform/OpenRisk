use std::env;
use std::fs;
use std::path::PathBuf;

fn required_environment_value(name: &str) -> String {
    env::var(name).unwrap_or_else(|_| panic!("{name} is required when custom branding is enabled"))
}

fn main() {
    println!("cargo:rerun-if-env-changed=OPENRISK_BRAND_LOGO");
    println!("cargo:rerun-if-env-changed=OPENRISK_BRAND_NAME");

    if env::var_os("CARGO_FEATURE_CUSTOM_BRANDING").is_none() {
        return;
    }

    let configured_logo = PathBuf::from(required_environment_value("OPENRISK_BRAND_LOGO"));
    let source_logo = configured_logo.canonicalize().unwrap_or_else(|error| {
        panic!(
            "could not resolve custom brand logo {}: {error}",
            configured_logo.display()
        )
    });
    let extension = source_logo
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    assert!(
        matches!(extension.as_str(), "png" | "svg"),
        "custom brand logo must be a PNG or SVG file"
    );

    let brand_name = required_environment_value("OPENRISK_BRAND_NAME");
    assert!(
        !brand_name.trim().is_empty(),
        "custom brand name cannot be empty"
    );
    assert!(
        !brand_name.contains(['\r', '\n']),
        "custom brand name cannot contain line breaks"
    );

    let filename = format!("brand-logo.{extension}");
    let embedded_logo =
        PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is set")).join(&filename);
    fs::copy(&source_logo, &embedded_logo).unwrap_or_else(|error| {
        panic!(
            "could not copy custom brand logo {}: {error}",
            source_logo.display()
        )
    });

    println!("cargo:rerun-if-changed={}", source_logo.display());
    println!(
        "cargo:rustc-env=OPENRISK_BRAND_LOGO_EMBED_PATH={}",
        embedded_logo.display()
    );
    println!("cargo:rustc-env=OPENRISK_BRAND_LOGO_FILENAME={filename}");
    println!("cargo:rustc-env=OPENRISK_BRAND_NAME={brand_name}");
}
