import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, BaseDirectory, mkdir } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import type {
  ScanDetailRecord,
  ScanPluginResultRecord,
} from "@/core/backend/bindings";
import type {
  DataModelEntity,
  DataModelResult,
  TypedValue,
} from "@/core/data-model/types";
import { isDataModelResult } from "@/core/data-model/types";
import { typedValueToCompactText } from "@/components/data-model/entityProps";
import { toast } from "sonner";
import notoSansRegularUrl from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoSansBoldUrl from "@/assets/fonts/NotoSans-Bold.ttf?url";

// ---------------------------------------------------------------------------
// Unicode font support
// jsPDF's built-in "helvetica" is Latin-1 only. We embed Noto Sans Regular
// and Bold (proper static TTFs) so text in any script — Latin, Cyrillic,
// Greek, etc. — renders correctly and crisply in exported PDFs.
// ---------------------------------------------------------------------------

const FONT_NAME = "NotoSans";
let fontCacheRegular: string | null = null;
let fontCacheBold: string | null = null;

async function fetchBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function registerFont(doc: jsPDF): Promise<void> {
  if (!fontCacheRegular) fontCacheRegular = await fetchBase64(notoSansRegularUrl);
  if (!fontCacheBold) fontCacheBold = await fetchBase64(notoSansBoldUrl);

  doc.addFileToVFS("NotoSans-Regular.ttf", fontCacheRegular);
  doc.addFont("NotoSans-Regular.ttf", FONT_NAME, "normal");

  doc.addFileToVFS("NotoSans-Bold.ttf", fontCacheBold);
  doc.addFont("NotoSans-Bold.ttf", FONT_NAME, "bold");
}

const PRIMARY = [30, 64, 175] as [number, number, number];
const MUTED = [100, 116, 139] as [number, number, number];
const CARD_HEAD = [241, 245, 249] as [number, number, number];
const ALT_ROW = [248, 250, 252] as [number, number, number];

type LastTable = { lastAutoTable: { finalY: number } };

interface ExportScanPdfOptions {
  scanTitle: string;
  performedAt: string;
  detail: ScanDetailRecord;
  pluginNameById: Record<string, string>;
}

function sanitizeFilenamePart(value: string): string {
  const next = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next || "scan";
}

async function savePdf(doc: jsPDF, defaultFilename: string) {
  const path = await save({
    defaultPath: defaultFilename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!path) {
    return null;
  }

  const bytes = doc.output("arraybuffer");
  await writeFile(path, new Uint8Array(bytes));
  return path;
}

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.text("OpenRisk", 40, 38);

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 40, 55);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 40, 68);
  }

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.4);
  doc.line(40, subtitle ? 76 : 63, doc.internal.pageSize.width - 40, subtitle ? 76 : 63);
}

function addFooter(doc: jsPDF) {
  const pageCount = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
  const width = doc.internal.pageSize.width;
  const height = doc.internal.pageSize.height;
  const generatedAt = new Date().toLocaleString();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${generatedAt} · OpenRisk`, 40, height - 22);
    doc.text(`${i} / ${pageCount}`, width - 40, height - 22, { align: "right" });
  }
}

function hasDisplayValue(value: TypedValue | undefined): boolean {
  if (!value) {
    return false;
  }

  if (value.value === null || value.value === undefined) {
    return false;
  }

  if (typeof value.value === "string" && value.value.trim() === "") {
    return false;
  }

  return true;
}

function typedValueToPdfText(value: TypedValue | undefined): string {
  if (!value || !hasDisplayValue(value)) {
    return "";
  }

  if (value.$type === "image-url" && typeof value.value === "string") {
    return value.value;
  }

  return typedValueToCompactText(value);
}

function isKeyValue(item: TypedValue): item is {
  $type: "key-value";
  value: { key: TypedValue<string>; value: TypedValue };
} {
  if (item.$type !== "key-value") return false;
  if (!item.value || typeof item.value !== "object") return false;
  const candidate = item.value as { key?: TypedValue<string>; value?: TypedValue };
  return Boolean(candidate.key && candidate.value);
}

function groupExtraValues(items: TypedValue[]) {
  const groups = new Map<string, { label: string; values: TypedValue[] }>();

  for (const item of items) {
    if (isKeyValue(item)) {
      const label = String(item.value.key.value);
      const key = label.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.values.push(item.value.value);
      } else {
        groups.set(key, { label, values: [item.value.value] });
      }
      continue;
    }

    const existing = groups.get("$extra");
    if (existing) {
      existing.values.push(item);
    } else {
      groups.set("$extra", { label: "$extra", values: [item] });
    }
  }

  return Array.from(groups.values());
}

function entityDisplayName(entity: DataModelEntity) {
  const name = entity.$props?.name?.find(hasDisplayValue);
  if (name) {
    return typedValueToPdfText(name);
  }

  return entity.$id;
}

function entityRows(entity: DataModelEntity): string[][] {
  const rows: string[][] = [];

  for (const [key, values] of Object.entries(entity.$props ?? {})) {
    const display = (values as TypedValue[])
      .filter(hasDisplayValue)
      .map((value) => typedValueToPdfText(value))
      .filter((value) => value.length > 0);

    if (!display.length) {
      continue;
    }

    rows.push([key, display.join("\n")]);
  }

  for (const group of groupExtraValues(entity.$extra ?? [])) {
    const display = group.values
      .filter(hasDisplayValue)
      .map((value) => typedValueToPdfText(value))
      .filter((value) => value.length > 0);

    if (!display.length) {
      continue;
    }

    rows.push([group.label, display.join("\n")]);
  }

  if (entity.$sources?.length) {
    rows.push([
      "sources",
      entity.$sources.map((source) => `${source.name}: ${source.source}`).join("\n"),
    ]);
  }

  return rows;
}

function renderEntityCard(
  doc: jsPDF,
  entity: DataModelEntity,
  startY: number,
  index: number,
) {
  const pageHeight = doc.internal.pageSize.height;

  if (startY > pageHeight - 90) {
    doc.addPage();
    startY = 40;
  }

  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text(`${index}. ${entityDisplayName(entity)}`, 40, startY);

  autoTable(doc, {
    startY: startY + 16,
    head: [["Property", "Value"]],
    body: entityRows(entity),
    headStyles: {
      fillColor: CARD_HEAD,
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 8,
      font: FONT_NAME,
    },
    bodyStyles: { fontSize: 8, valign: "top", font: FONT_NAME },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 130, fontStyle: "bold", font: FONT_NAME },
      1: { cellWidth: "auto", font: FONT_NAME },
    },
    margin: { left: 40, right: 40 },
  });

  return (doc as unknown as LastTable).lastAutoTable.finalY + 18;
}

function renderRawJsonBlock(doc: jsPDF, rawJson: string, startY: number) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const maxWidth = pageWidth - 80;

  const lines = doc.splitTextToSize(rawJson, maxWidth);
  let y = startY;

  for (const line of lines) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 40;
    }
    doc.text(line, 40, y);
    y += 10;
  }

  return y + 10;
}

function parseResultData(result: ScanPluginResultRecord): DataModelResult | string | null {
  if (!result.output.ok || !result.output.dataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.output.dataJson);
    return isDataModelResult(parsed) ? parsed : result.output.dataJson;
  } catch {
    return result.output.dataJson;
  }
}

function orderedResults(detail: ScanDetailRecord): ScanPluginResultRecord[] {
  const order = new Map<string, number>();
  detail.selectedPlugins.forEach((selection, index) => {
    order.set(`${selection.pluginId}::${selection.entrypointId}`, index);
  });

  return [...detail.results].sort((left, right) => {
    const leftIndex = order.get(`${left.pluginId}::${left.entrypointId}`);
    const rightIndex = order.get(`${right.pluginId}::${right.entrypointId}`);
    if (leftIndex === undefined && rightIndex === undefined) return 0;
    if (leftIndex === undefined) return 1;
    if (rightIndex === undefined) return -1;
    return leftIndex - rightIndex;
  });
}

export async function buildScanPdfDoc({
  scanTitle,
  performedAt,
  detail,
  pluginNameById,
}: ExportScanPdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  await registerFont(doc);
  _appendScanToDoc(doc, { scanTitle, performedAt, detail, pluginNameById }, true);
  addFooter(doc);
  return doc;
}

interface AllScansPdfEntry {
  scanTitle: string;
  performedAt: string;
  detail: ScanDetailRecord;
  pluginNameById: Record<string, string>;
}

export async function buildAllScansPdfDoc(scans: AllScansPdfEntry[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  await registerFont(doc);

  // Cover page
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PRIMARY);
  doc.text("OpenRisk", 40, 80);

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("All Scans Report", 40, 110);

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${new Date().toLocaleString()} · ${scans.length} scan${scans.length === 1 ? "" : "s"}`, 40, 130);

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.4);
  doc.line(40, 142, doc.internal.pageSize.width - 40, 142);

  // TOC
  let tocY = 165;
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text("Contents", 40, tocY);
  tocY += 16;

  scans.forEach((scan, i) => {
    if (tocY > doc.internal.pageSize.height - 60) {
      doc.addPage();
      tocY = 40;
    }
    const pluginNames = Array.from(
      new Set(
        scan.detail.selectedPlugins.map(
          (sp) => scan.pluginNameById[sp.pluginId] ?? sp.pluginId,
        ),
      ),
    ).join(", ");
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`${i + 1}. ${scan.scanTitle}`, 50, tocY);
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    const metaLine = [scan.performedAt, scan.detail.status, pluginNames]
      .filter(Boolean)
      .join(" · ");
    doc.text(metaLine, 50, tocY + 11);
    tocY += 26;
  });

  // Each scan on its own page
  for (const scan of scans) {
    doc.addPage();
    _appendScanToDoc(doc, scan, false);
  }

  addFooter(doc);
  return doc;
}

/** Shared internal renderer — appends a single scan's content to an existing doc. */
function _appendScanToDoc(
  doc: jsPDF,
  { scanTitle, performedAt, detail, pluginNameById }: ExportScanPdfOptions,
  _isFirstPage: boolean,
) {
  const results = orderedResults(detail);
  const entityCount = results.reduce((sum, r) => {
    if (!r.output.ok || !r.output.dataJson) return sum;
    try {
      const parsed = JSON.parse(r.output.dataJson);
      return sum + (Array.isArray(parsed) ? parsed.length : 1);
    } catch {
      return sum + 1;
    }
  }, 0);

  addHeader(
    doc,
    scanTitle,
    `${performedAt} · ${detail.status} · ${entityCount} result${entityCount === 1 ? "" : "s"} across ${results.length} endpoint${results.length === 1 ? "" : "s"}`,
  );

  autoTable(doc, {
    startY: 94,
    head: [["Scan", "Value"]],
    body: [
      ["Title", scanTitle],
      ["Status", detail.status],
      ["Performed at", performedAt],
      ["Selected entrypoints", String(detail.selectedPlugins.length)],
    ],
    headStyles: { fillColor: CARD_HEAD, textColor: [30, 30, 30], fontStyle: "bold", fontSize: 8, font: FONT_NAME },
    bodyStyles: { fontSize: 8, font: FONT_NAME },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    margin: { left: 40, right: 40 },
  });

  let y = (doc as unknown as LastTable).lastAutoTable.finalY + 22;

  for (const result of results) {
    if (y > doc.internal.pageSize.height - 100) {
      doc.addPage();
      y = 40;
    }

    const pluginName = pluginNameById[result.pluginId] ?? result.pluginId;

    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(pluginName, 40, y);

    y += 16;

    if (!result.output.ok) {
      autoTable(doc, {
        startY: y,
        head: [["Error", "Details"]],
        body: [[result.output.error ?? "Unknown error", (result.output.logs ?? []).map((e) => `${e.level}: ${e.message}`).join("\n") || "No logs"]],
        headStyles: { fillColor: CARD_HEAD, textColor: [30, 30, 30], fontStyle: "bold", fontSize: 8, font: FONT_NAME },
        bodyStyles: { fontSize: 8, font: FONT_NAME },
        margin: { left: 40, right: 40 },
      });
      y = (doc as unknown as LastTable).lastAutoTable.finalY + 18;
      continue;
    }

    const parsedData = parseResultData(result);
    if (Array.isArray(parsedData)) {
      if (!parsedData.length) {
        doc.setFont(FONT_NAME, "normal");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text("No entities in result.", 40, y);
        y += 20;
      } else {
        parsedData.forEach((entity, index) => {
          y = renderEntityCard(doc, entity, y, index + 1);
        });
      }
    } else if (typeof parsedData === "string" && parsedData.trim()) {
      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      y = renderRawJsonBlock(doc, parsedData, y);
    }

    if (result.output.logs?.length) {
      autoTable(doc, {
        startY: y,
        head: [["Logs"]],
        body: result.output.logs.map((e) => [`${e.level}: ${e.message}`]),
        headStyles: { fillColor: CARD_HEAD, textColor: [30, 30, 30], fontStyle: "bold", fontSize: 8, font: FONT_NAME },
        bodyStyles: { fontSize: 8, font: FONT_NAME },
        alternateRowStyles: { fillColor: ALT_ROW },
        margin: { left: 40, right: 40 },
      });
      y = (doc as unknown as LastTable).lastAutoTable.finalY + 18;
    } else {
      y += 8;
    }
  }
}

export async function buildFavoritesPdfDoc(entities: DataModelEntity[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  await registerFont(doc);

  // Cover / header
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PRIMARY);
  doc.text("OpenRisk", 40, 80);

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Favourites Report", 40, 110);

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    `Generated ${new Date().toLocaleString()} · ${entities.length} favourite${entities.length === 1 ? "" : "s"}`,
    40,
    130,
  );

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.4);
  doc.line(40, 142, doc.internal.pageSize.width - 40, 142);

  let y = 165;
  entities.forEach((entity, index) => {
    y = renderEntityCard(doc, entity, y, index + 1);
  });

  addFooter(doc);
  return doc;
}

export async function exportScanPdf(options: ExportScanPdfOptions) {
  const doc = await buildScanPdfDoc(options);
  return savePdf(doc, `openrisk-${sanitizeFilenamePart(options.scanTitle)}.pdf`);
}

export async function exportFavoritesPdf(entities: DataModelEntity[]): Promise<string | null> {
  const doc = await buildFavoritesPdfDoc(entities);
  return savePdf(doc, "openrisk-favourites.pdf");
}

export interface AllScansEntry {
  id: string;
  title: string;
  status: string;
  performedAt: string;
  isArchived: boolean;
}

/**
 * Shared "Save All" flow used by both SearchPage and HistoryPage.
 * Loads full scan details, builds a combined PDF, prompts for save path,
 * writes the file, and shows a success / error toast.
 */
export async function exportAllScansPdf(
  entries: AllScansEntry[],
  getScan: (id: string) => Promise<import("@/core/backend/bindings").ScanDetailRecord>,
  pluginNameById: Record<string, string>,
): Promise<void> {

  const eligible = entries.filter(
    (e) => (e.status === "Completed" || e.status === "Failed") && !e.isArchived,
  );
  if (!eligible.length) return;

  const pdfEntries: AllScansPdfEntry[] = [];
  for (const entry of eligible) {
    try {
      const detail = await getScan(entry.id);
      pdfEntries.push({
        scanTitle: entry.title.trim() || `Scan ${entry.id.slice(0, 8)}`,
        performedAt: entry.performedAt,
        detail,
        pluginNameById,
      });
    } catch {
      // skip unloadable scans
    }
  }
  if (!pdfEntries.length) return;

  const doc = await buildAllScansPdfDoc(pdfEntries);
  const path = await save({
    defaultPath: "openrisk-all-scans.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  await writeFile(path, bytes);
  toast.success("All scans saved to PDF", {
    description: path,
    action: {
      label: "Open file",
      onClick: () => void openPath(path),
    },
  });
}

/**
 * Write the PDF to the app's temp data folder and open it with the system's
 * default PDF viewer. This is the reliable way to "print" from Tauri WebView —
 * the user can then print from the viewer (Preview, Adobe, etc.).
 */
export async function openPdfInViewer(doc: jsPDF, filenameHint: string): Promise<void> {
  const filename = `openrisk-${sanitizeFilenamePart(filenameHint)}-${Date.now()}.pdf`;
  const relativePath = `prints/${filename}`;

  try {
    await mkdir("prints", { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // directory may already exist
  }

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData });

  // Resolve to absolute path and open via shell (uses shell:allow-open permission)
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  const dir = await appDataDir();
  const fullPath = await join(dir, relativePath);
  await openPath(fullPath);
}
