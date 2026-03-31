/**
 * exportPdf – PDF generation helpers using jsPDF + jspdf-autotable.
 * Portrait layout. Each entity is rendered as a vertical label/value card
 * with all properties fully expanded.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import {
  SearchResultEntity,
  SearchResult,
  ScanHistoryEntry,
  FavoriteEntity,
} from "@/types/personSearch";
import { getEntityRowData, PROP_LABELS, resolveCountryName } from "@/utils/personSearchUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY   = [30, 64, 175]   as [number, number, number];
const MUTED     = [100, 116, 139] as [number, number, number];
const CARD_HEAD = [241, 245, 249] as [number, number, number];
const ALT_ROW   = [248, 250, 252] as [number, number, number];

type LastTable = { lastAutoTable: { finalY: number } };

/** Opens a native save dialog and writes the PDF. Returns the chosen path or null if cancelled. */
async function savePdf(doc: jsPDF, defaultFilename: string): Promise<string | null> {
  const path = await save({
    defaultPath: defaultFilename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return null;
  const bytes = doc.output("arraybuffer");
  await writeFile(path, new Uint8Array(bytes));
  return path;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.text("OpenRisk", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 14, 24);

  if (subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 14, 30);
  }

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.line(14, subtitle ? 33 : 27, doc.internal.pageSize.width - 14, subtitle ? 33 : 27);
}

function addFooter(doc: jsPDF) {
  const pageCount = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
  const w = doc.internal.pageSize.width;
  const h = doc.internal.pageSize.height;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${new Date().toLocaleString()} · OpenRisk`, 14, h - 6);
    doc.text(`${i} / ${pageCount}`, w - 14, h - 6, { align: "right" });
  }
}

/** Build a [label, value] row list for every property of an entity. */
function entityDetailRows(entity: SearchResultEntity): string[][] {
  const { displayName, aliases, birthDate, countries, topics, allDetailProps } = getEntityRowData(entity);
  const rows: string[][] = [];

  const props = entity.properties ?? {};
  const firstName = props.firstName?.[0] ?? props.first_name?.[0] ?? "";
  const lastName  = props.lastName?.[0]  ?? props.last_name?.[0]  ?? "";

  if (firstName || lastName) {
    if (firstName) rows.push(["First Name", firstName]);
    if (lastName)  rows.push(["Last Name",  lastName]);
  } else {
    rows.push(["Name", displayName]);
  }
  if (aliases.length) rows.push(["Aliases", aliases.join(", ")]);
  rows.push(["Type", entity.schema ?? "—"]);
  if (birthDate && birthDate !== "-") rows.push(["Birth Date", birthDate]);
  if (countries.length) rows.push(["Nationality", countries.join(", ")]);
  if (topics.length)
    rows.push(["Topics / Sanctions",
      topics.map((t) => t.replace("role.", "").replace("sanction", "sanctioned")).join(", ")
    ]);

  // All remaining expanded properties
  const shown = new Set(["name", "alias", "birthDate", "country", "nationality", "topics"]);
  for (const [key, values] of allDetailProps) {
    if (shown.has(key)) continue;
    const label = PROP_LABELS[key] ?? key;
    const isCountryLike = ["birthCountry", "citizenship", "residency"].includes(key);
    const resolved = isCountryLike
      ? [...new Set((values as string[]).map(resolveCountryName))]
      : (values as string[]);
    rows.push([label, resolved.join(", ")]);
  }

  return rows;
}

/** Render a single entity as a vertical label/value card, returns new Y. */
function renderEntityCard(
  doc: jsPDF,
  entity: SearchResultEntity,
  startY: number,
  index: number
): number {
  const { displayName } = getEntityRowData(entity);
  const pageH = doc.internal.pageSize.height;

  // Page break if needed (leave room for at least the heading + a few rows)
  if (startY > pageH - 40) {
    doc.addPage();
    startY = 20;
  }

  // Card heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY);
  doc.text(`${index}. ${displayName}`, 14, startY);
  startY += 2;

  autoTable(doc, {
    startY,
    head: [["Property", "Value"]],
    body: entityDetailRows(entity),
    headStyles: { fillColor: CARD_HEAD, textColor: [30, 30, 30], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 0: { cellWidth: 38, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    margin: { left: 14, right: 14 },
  });

  return (doc as unknown as LastTable).lastAutoTable.finalY + 8;
}

// ---------------------------------------------------------------------------
// 1. Export search results
// ---------------------------------------------------------------------------

export async function exportResultsPdf(result: SearchResult, searchFields: Record<string, string>): Promise<string | null> {
  const doc = new jsPDF({ orientation: "portrait" });

  const query = result.query || Object.values(searchFields).filter(Boolean).join(", ") || "—";
  addHeader(doc, "Search Results", `${new Date().toLocaleDateString()}`);

  const usedTerms = Object.entries(searchFields).filter(([, v]) => v.trim());
  let y = 38;
  if (usedTerms.length) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Search terms used:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    usedTerms.forEach(([k, v]) => {
      y += 5;
      doc.text(`${k}: ${v}`, 18, y);
    });
    y += 8;
  }

  (result.results ?? []).forEach((entity, i) => {
    y = renderEntityCard(doc, entity, y, i + 1);
  });

  addFooter(doc);
  const defaultName = `openrisk-results-${query.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  return savePdf(doc, defaultName);
}

// ---------------------------------------------------------------------------
// 2. Export saved persons
// ---------------------------------------------------------------------------

export async function exportFavoritesPdf(favorites: FavoriteEntity[]): Promise<string | null> {
  const doc = new jsPDF({ orientation: "portrait" });
  addHeader(doc, "Saved Persons",
    `Exported ${new Date().toLocaleDateString()} · ${favorites.length} person${favorites.length !== 1 ? "s" : ""}`
  );

  let y = 36;
  favorites.forEach((fav, i) => {
    y = renderEntityCard(doc, fav.entity, y, i + 1);
  });

  addFooter(doc);
  return savePdf(doc, `openrisk-saved-persons.pdf`);
}

// ---------------------------------------------------------------------------
// 3. Export scan history
// ---------------------------------------------------------------------------

export async function exportHistoryPdf(entries: ScanHistoryEntry[]): Promise<string | null> {
  const doc = new jsPDF({ orientation: "portrait" });
  addHeader(doc, "Scan History",
    `Exported ${new Date().toLocaleDateString()} · ${entries.length} scan${entries.length !== 1 ? "s" : ""}`
  );

  let y = 36;

  entries.forEach((entry, idx) => {
    const count = entry.result.results?.length ?? 0;
    const pageH = doc.internal.pageSize.height;
    if (y > pageH - 40) { doc.addPage(); y = 20; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PRIMARY);
    doc.text(`Scan ${idx + 1}: "${entry.query || "(no name)"}"`, 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `${entry.timestamp.toLocaleString()}  ·  Plugin: ${entry.pluginId ?? "—"}  ·  ${count} result${count !== 1 ? "s" : ""}`,
      14, y
    );
    y += 6;

    (entry.result.results ?? []).forEach((entity, i) => {
      y = renderEntityCard(doc, entity, y, i + 1);
    });

    if (idx < entries.length - 1) {
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(0.2);
      doc.line(14, y, doc.internal.pageSize.width - 14, y);
      y += 6;
    }
  });

  addFooter(doc);
  return savePdf(doc, `openrisk-scan-history.pdf`);
}
