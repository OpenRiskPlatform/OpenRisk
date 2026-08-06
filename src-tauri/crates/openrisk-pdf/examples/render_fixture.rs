//! Render a checked-in report fixture through the same in-process pipeline as Tauri.

use openrisk_core::project::{ReportProfile, ScanReportSnapshot};
use openrisk_pdf::{render_scan_report, write_pdf_atomically};
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    report: ScanReportSnapshot,
    profile: ReportProfile,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = std::env::args_os().skip(1);
    let fixture_path = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("usage: render_fixture <fixture.json> <destination.pdf>")?;
    let destination = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("usage: render_fixture <fixture.json> <destination.pdf>")?;
    if arguments.next().is_some() {
        return Err("usage: render_fixture <fixture.json> <destination.pdf>".into());
    }

    let fixture: Fixture = serde_json::from_slice(&std::fs::read(fixture_path)?)?;
    let rendered = render_scan_report(&fixture.report, fixture.profile)?;
    write_pdf_atomically(&destination, &rendered.bytes)?;

    println!(
        "{} pages, {} bytes, SHA-256 {}",
        rendered.page_count,
        rendered.bytes.len(),
        rendered.sha256
    );
    Ok(())
}
