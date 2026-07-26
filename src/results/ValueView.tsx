import type { ReactNode } from "react";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function typedValue(value: unknown): unknown {
  if (isRecord(value) && "$type" in value && "value" in value) {
    return value.value;
  }
  return value;
}

function isScalar(value: unknown): boolean {
  const normalized = typedValue(value);
  return (
    normalized === null ||
    normalized === undefined ||
    typeof normalized === "boolean" ||
    typeof normalized === "string" ||
    typeof normalized === "number"
  );
}

function primitive(value: unknown): ReactNode {
  if (value === null) {
    return <span className="text-muted-foreground">null</span>;
  }
  if (value === undefined) {
    return <span className="text-muted-foreground">undefined</span>;
  }
  if (
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }
  return null;
}

function isKeyValueList(
  value: unknown[],
): value is Array<Record<"key" | "value", unknown>> {
  return (
    value.length > 0 &&
    value.every(
      (item) =>
        isRecord(item) &&
        "key" in item &&
        "value" in item &&
        ["string", "number"].includes(typeof typedValue(item.key)),
    )
  );
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
  if (!advancedMode) {
    value = typedValue(value);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return <span className="break-words">{primitive(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }

    const items = advancedMode ? value : value.map(typedValue);

    if (!advancedMode && isKeyValueList(items)) {
      return (
        <DataRows
          entries={items.map((item) => [
            String(typedValue(item.key)),
            item.value,
          ])}
          advancedMode={false}
        />
      );
    }

    if (!advancedMode) {
      const table = tableShape(items);
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
    }

    if (items.every(isScalar)) {
      return (
        <span className="break-words">
          {items.map((item) => String(typedValue(item))).join(", ")}
        </span>
      );
    }

    return (
      <div>
        {items.map((item, index) => (
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
