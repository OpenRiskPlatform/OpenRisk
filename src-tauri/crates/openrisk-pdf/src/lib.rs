//! Deterministic, adapter-independent PDF rendering for OpenRisk reports.

use openrisk_core::project::{ReportProfile, ScanReportSnapshot};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::Path;
use thiserror::Error;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use typst::foundations::Datetime;
use typst::layout::PagedDocument;
use typst_as_lib::TypstEngine;
use typst_pdf::{PdfOptions, PdfStandard, PdfStandards, Timestamp};

const TEMPLATE: &str = include_str!("../templates/investigation.typ");
const NOTO_SANS: &[u8] = include_bytes!("../assets/fonts/NotoSans.ttf");

#[derive(Debug, Error)]
pub enum PdfRenderError {
    #[error("could not serialize report data: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("could not compile report template: {0}")]
    Compile(String),
    #[error("could not export PDF: {0}")]
    Export(String),
    #[error("could not write PDF: {0}")]
    Io(#[from] std::io::Error),
}

/// Complete rendered PDF together with integrity metadata.
pub struct RenderedPdf {
    pub bytes: Vec<u8>,
    pub sha256: String,
    pub snapshot_sha256: String,
    pub page_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RenderPayload<'a> {
    report: &'a ScanReportSnapshot,
    profile: &'static str,
    generated_at: String,
    snapshot_sha256: &'a str,
}

fn digest(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

/// Render one immutable investigation snapshot with the bundled official template.
pub fn render_scan_report(
    snapshot: &ScanReportSnapshot,
    profile: ReportProfile,
) -> Result<RenderedPdf, PdfRenderError> {
    let canonical_snapshot = serde_json::to_vec(snapshot)?;
    let snapshot_sha256 = digest(&canonical_snapshot);
    let generated_instant = OffsetDateTime::now_utc();
    let generated_at = generated_instant
        .format(&Rfc3339)
        .map_err(|error| PdfRenderError::Compile(error.to_string()))?;
    let payload = serde_json::to_vec(&RenderPayload {
        report: snapshot,
        profile: match profile {
            ReportProfile::Standard => "standard",
            ReportProfile::Advanced => "advanced",
        },
        generated_at,
        snapshot_sha256: &snapshot_sha256,
    })?;

    let engine = TypstEngine::builder()
        .main_file(TEMPLATE)
        .fonts([NOTO_SANS])
        .with_static_file_resolver([("report.json", payload.as_slice())])
        .build();

    let compiled = engine.compile::<PagedDocument>();
    let document = compiled
        .output
        .map_err(|error| PdfRenderError::Compile(format!("{error:?}")))?;
    let page_count = document.pages.len() as u32;
    // PDF/A-2a gives exported reports an archival profile with Unicode text,
    // structure tags, embedded fonts, and reliable long-term reproduction.
    let standards = PdfStandards::new(&[PdfStandard::A_2a])
        .map_err(|error| PdfRenderError::Export(error.to_string()))?;
    let document_datetime = Datetime::from_ymd_hms(
        generated_instant.year(),
        generated_instant.month() as u8,
        generated_instant.day(),
        generated_instant.hour(),
        generated_instant.minute(),
        generated_instant.second(),
    )
    .ok_or_else(|| PdfRenderError::Export("invalid PDF creation timestamp".into()))?;
    let options = PdfOptions {
        timestamp: Some(Timestamp::new_utc(document_datetime)),
        standards,
        tagged: true,
        ..Default::default()
    };
    let bytes = typst_pdf::pdf(&document, &options)
        .map_err(|error| PdfRenderError::Export(format!("{error:?}")))?;
    let sha256 = digest(&bytes);

    Ok(RenderedPdf {
        bytes,
        sha256,
        snapshot_sha256,
        page_count,
    })
}

/// Persist a rendered PDF through a temporary file in the destination directory.
pub fn write_pdf_atomically(destination: &Path, bytes: &[u8]) -> Result<(), PdfRenderError> {
    let parent = destination.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;

    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    temporary.write_all(bytes)?;
    temporary.flush()?;
    temporary.as_file().sync_all()?;
    temporary
        .persist(destination)
        .map_err(|error| PdfRenderError::Io(error.error))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Fixture {
        report: ScanReportSnapshot,
        profile: ReportProfile,
    }

    #[test]
    fn renders_pdf_a_report_and_writes_it_atomically() {
        let fixture: Fixture =
            serde_json::from_slice(include_bytes!("../tests/fixtures/report.json")).unwrap();
        let rendered = render_scan_report(&fixture.report, fixture.profile).unwrap();

        assert!(rendered.bytes.starts_with(b"%PDF-"));
        assert!(rendered.bytes.ends_with(b"%%EOF"));
        assert!(rendered.bytes.len() > 10_000);
        assert!(rendered.page_count >= 1);
        assert_eq!(rendered.sha256.len(), 64);
        assert_eq!(rendered.snapshot_sha256.len(), 64);

        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("investigation.pdf");
        write_pdf_atomically(&destination, &rendered.bytes).unwrap();
        assert_eq!(fs::read(destination).unwrap(), rendered.bytes);
    }
}
