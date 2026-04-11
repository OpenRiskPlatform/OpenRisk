import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.text("OpenRisk", 40, 38);

  doc.setFont("helvetica", "normal");
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
  const rows: string[][] = [
    ["$entity", entity.$entity],
    ["$id", entity.$id],
  ];

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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text(`${index}. ${entityDisplayName(entity)}`, 40, startY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(entity.$entity, 40, startY + 12);

  autoTable(doc, {
    startY: startY + 18,
    head: [["Property", "Value"]],
    body: entityRows(entity),
    headStyles: {
      fillColor: CARD_HEAD,
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, valign: "top" },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 130, fontStyle: "bold" },
      1: { cellWidth: "auto" },
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

export async function exportScanPdf({
  scanTitle,
  performedAt,
  detail,
  pluginNameById,
}: ExportScanPdfOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const resultCount = detail.results.length;

  addHeader(
    doc,
    scanTitle,
    `${performedAt} · ${detail.status} · ${resultCount} plugin result${resultCount === 1 ? "" : "s"}`,
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
    headStyles: {
      fillColor: CARD_HEAD,
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 140, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
    margin: { left: 40, right: 40 },
  });

  let y = (doc as unknown as LastTable).lastAutoTable.finalY + 22;

  for (const result of detail.results) {
    if (y > doc.internal.pageSize.height - 100) {
      doc.addPage();
      y = 40;
    }

    const revisionSuffix = result.pluginRevisionId
      ? ` [${result.pluginRevisionId.slice(0, 8)}]`
      : "";
    const pluginName = pluginNameById[result.pluginId] ?? result.pluginId;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(pluginName, 40, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `${result.pluginId} / ${result.entrypointId}${revisionSuffix}`,
      40,
      y + 12,
    );
    y += 24;

    if (!result.output.ok) {
      autoTable(doc, {
        startY: y,
        head: [["Error", "Details"]],
        body: [[result.output.error ?? "Unknown error", (result.output.logs ?? []).map((entry) => `${entry.level}: ${entry.message}`).join("\n") || "No logs"]],
        headStyles: {
          fillColor: CARD_HEAD,
          textColor: [30, 30, 30],
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8 },
        margin: { left: 40, right: 40 },
      });
      y = (doc as unknown as LastTable).lastAutoTable.finalY + 18;
      continue;
    }

    const parsedData = parseResultData(result);
    if (Array.isArray(parsedData)) {
      if (!parsedData.length) {
        doc.setFont("helvetica", "normal");
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
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      y = renderRawJsonBlock(doc, parsedData, y);
    }

    if (result.output.logs?.length) {
      autoTable(doc, {
        startY: y,
        head: [["Logs"]],
        body: result.output.logs.map((entry) => [`${entry.level}: ${entry.message}`]),
        headStyles: {
          fillColor: CARD_HEAD,
          textColor: [30, 30, 30],
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: ALT_ROW },
        margin: { left: 40, right: 40 },
      });
      y = (doc as unknown as LastTable).lastAutoTable.finalY + 18;
    } else {
      y += 8;
    }
  }

  addFooter(doc);

  return savePdf(
    doc,
    `openrisk-${sanitizeFilenamePart(scanTitle)}.pdf`,
  );
}
