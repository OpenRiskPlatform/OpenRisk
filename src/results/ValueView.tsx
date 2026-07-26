import { ExternalLink, ImageIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  isRecord,
  isTypedValue,
  typedValuePayload,
  type TypedValue,
} from "./resultSchema";

function isScalar(value: unknown): boolean {
  const normalized = typedValuePayload(value);
  return (
    normalized === null ||
    normalized === undefined ||
    typeof normalized === "boolean" ||
    typeof normalized === "string" ||
    typeof normalized === "number"
  );
}

function booleanText(value: boolean): string {
  return value ? "Yes" : "No";
}

function primitive(value: unknown, advancedMode: boolean): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">Not provided</span>;
  }
  if (typeof value === "boolean") {
    return advancedMode ? String(value) : booleanText(value);
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return null;
}

function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function RelativeAssociate({ value }: { value: unknown }) {
  if (!isRecord(value) || typeof value.name !== "string") {
    return <span className="break-words">{String(value)}</span>;
  }

  return (
    <span className="break-words">
      {value.name}
      {typeof value.relation === "string" && value.relation.trim() ? (
        <span className="text-muted-foreground"> — {value.relation}</span>
      ) : null}
    </span>
  );
}

function TypedValueView({ item }: { item: TypedValue }) {
  const value = item.value;

  if (item.$type === "boolean" && typeof value === "boolean") {
    return <span>{booleanText(value)}</span>;
  }

  if (item.$type === "url" && typeof value === "string") {
    const href = safeWebUrl(value);
    if (!href) {
      return <span className="break-all">{value}</span>;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-1.5 break-all text-primary underline decoration-border underline-offset-4 hover:decoration-current"
      >
        <span>{value}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </a>
    );
  }

  if (item.$type === "image-url" && typeof value === "string") {
    const src = safeWebUrl(value);
    if (!src) {
      return <span className="break-all">{value}</span>;
    }
    return (
      <a href={src} target="_blank" rel="noreferrer" className="inline-block">
        <img
          src={src}
          alt="Result attachment"
          className="max-h-40 max-w-full rounded-md object-contain"
          loading="lazy"
        />
      </a>
    );
  }

  if (item.$type === "image-base64" && typeof value === "string") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <ImageIcon className="h-4 w-4" aria-hidden />
        Image attachment
      </span>
    );
  }

  if (item.$type === "relative-close-associate") {
    return <RelativeAssociate value={value} />;
  }

  if (item.$type === "key-value" && isRecord(value)) {
    const key = typedValuePayload(value.key);
    const nestedValue = value.value;
    return (
      <DataRows
        entries={[[String(key ?? "Value"), nestedValue]]}
        advancedMode={false}
      />
    );
  }

  return <ValueView value={value} />;
}

function legacyKeyValueEntry(
  value: unknown,
): [string, unknown] | null {
  const payload = typedValuePayload(value);
  if (!isRecord(payload) || !("key" in payload) || !("value" in payload)) {
    return null;
  }
  const key = typedValuePayload(payload.key);
  if (typeof key !== "string" && typeof key !== "number") {
    return null;
  }
  return [String(key), payload.value];
}

function tableShape(
  values: unknown[],
): { rows: Record<string, unknown>[]; columns: string[] } | null {
  if (values.length === 0 || !values.every(isRecord)) {
    return null;
  }

  const rows = values as Record<string, unknown>[];
  const columns = Object.keys(rows[0]);
  if (columns.length === 0 || columns.length > 5) {
    return null;
  }

  const signature = columns.join("\u0000");
  const homogeneous = rows.every(
    (row) =>
      Object.keys(row).join("\u0000") === signature &&
      columns.every((column) => isScalar(row[column])),
  );

  return homogeneous ? { rows, columns } : null;
}

function DataRows({
  entries,
  advancedMode,
}: {
  entries: Array<[string, unknown]>;
  advancedMode: boolean;
}) {
  return (
    <dl>
      {entries.map(([key, nestedValue], index) => (
        <div
          key={`${key}:${index}`}
          className="grid gap-1 border-b border-border/70 py-2.5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
        >
          <dt
            className={
              advancedMode
                ? "break-all font-mono text-xs text-muted-foreground"
                : "break-words text-sm text-muted-foreground"
            }
          >
            {key}
          </dt>
          <dd className="min-w-0 text-sm">
            <ValueView value={nestedValue} advancedMode={advancedMode} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ValueView({
  value,
  advancedMode = false,
}: {
  value: unknown;
  advancedMode?: boolean;
}) {
  if (!advancedMode && isTypedValue(value)) {
    return <TypedValueView item={value} />;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return (
      <span className="break-words">{primitive(value, advancedMode)}</span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">Not provided</span>;
    }

    if (!advancedMode) {
      const keyValueEntries = value
        .map(legacyKeyValueEntry)
        .filter((entry): entry is [string, unknown] => entry !== null);
      if (keyValueEntries.length === value.length) {
        return (
          <DataRows entries={keyValueEntries} advancedMode={false} />
        );
      }

      const typedItems = value.filter(isTypedValue);
      if (typedItems.length === value.length) {
        const requiresDedicatedView = typedItems.some((item) =>
          [
            "url",
            "image-url",
            "image-base64",
            "relative-close-associate",
            "key-value",
          ].includes(item.$type),
        );
        if (!requiresDedicatedView && typedItems.every(isScalar)) {
          return (
            <span className="break-words">
              {typedItems
                .map((item) =>
                  typeof item.value === "boolean"
                    ? booleanText(item.value)
                    : String(item.value),
                )
                .join(", ")}
            </span>
          );
        }
        return (
          <div>
            {typedItems.map((item, index) => (
              <div
                key={index}
                className="border-b border-border/70 py-2 first:pt-0 last:border-b-0 last:pb-0"
              >
                <TypedValueView item={item} />
              </div>
            ))}
          </div>
        );
      }

      const payloads = value.map(typedValuePayload);
      const table = tableShape(payloads);
      if (table) {
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {table.columns.map((column) => (
                    <th key={column} className="pb-2 pr-6 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b last:border-b-0">
                    {table.columns.map((column) => (
                      <td key={column} className="py-2 pr-6 align-top">
                        <ValueView value={row[column]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (value.every(isScalar)) {
        return (
          <span className="break-words">
            {value
              .map((item) => {
                const payload = typedValuePayload(item);
                return typeof payload === "boolean"
                  ? booleanText(payload)
                  : String(payload);
              })
              .join(", ")}
          </span>
        );
      }
    }

    return (
      <div>
        {value.map((item, index) => (
          <div
            key={index}
            className="border-b border-border/70 py-2.5 first:pt-0 last:border-b-0 last:pb-0"
          >
            <ValueView value={item} advancedMode={advancedMode} />
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    return (
      <DataRows
        entries={Object.entries(value)}
        advancedMode={advancedMode}
      />
    );
  }

  return <span>{String(value)}</span>;
}
