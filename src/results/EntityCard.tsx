import {
  AlertTriangle,
  AtSign,
  Building2,
  CheckCircle2,
  Newspaper,
  Radar,
  ReceiptText,
  ScanSearch,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  entityMetadata,
  orderedPropertyNames,
  propertyMetadata,
} from "./dataModel";
import {
  firstPropertyValue,
  isRecord,
  pluginSources,
  propertyValues,
  typedValuePayload,
  type PluginEntity,
} from "./resultSchema";
import { ValueView } from "./ValueView";

const STANDARD_KEYS = new Set([
  "$entity",
  "$id",
  "$modelVersion",
  "$sources",
  "$props",
  "$extra",
]);

const SCREENING_STATUS_KEYS = ["pepStatus", "isPepRca", "sanctioned"] as const;

const ICONS: Record<string, LucideIcon> = {
  user: User,
  building: Building2,
  newspaper: Newspaper,
  radar: Radar,
  "at-sign": AtSign,
  receipt: ReceiptText,
  spark: Sparkles,
};

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some(hasContent);
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function isProminent(value: unknown): boolean {
  const primitive = typedValuePayload(value);
  if (Array.isArray(primitive)) {
    return primitive.some(isProminent);
  }
  if (typeof primitive === "boolean") {
    return primitive;
  }
  if (typeof primitive === "number") {
    return primitive !== 0;
  }
  if (typeof primitive === "string") {
    return primitive.trim() !== "" && primitive.toLowerCase() !== "false";
  }
  return false;
}

function StatusLine({
  name,
  value,
}: {
  name: string;
  value: unknown;
}) {
  const active = isProminent(value);
  const Icon = active ? AlertTriangle : CheckCircle2;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        active
          ? "font-medium text-red-700 dark:text-red-300"
          : "text-emerald-700 dark:text-emerald-300",
      )}
    >
      <Icon className="h-4 w-4" />
      {name}: {String(value)}
    </span>
  );
}

function TechnicalEntityCard({ entity }: { entity: PluginEntity }) {
  const name = firstPropertyValue(entity, "name");
  const pepStatus = firstPropertyValue(entity, "pepStatus");
  const pepRca = firstPropertyValue(entity, "isPepRca");
  const sanctioned = firstPropertyValue(entity, "sanctioned");
  const unknownTopLevel = Object.entries(entity).filter(
    ([key]) => !STANDARD_KEYS.has(key),
  );

  return (
    <article className="rounded-xl border bg-background p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-medium">
            {name === undefined ? entity.$id : String(name)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-xs text-muted-foreground">
              {entity.$entity}
            </span>
            {pepStatus !== undefined ? (
              <StatusLine name="pepStatus" value={pepStatus} />
            ) : null}
            {pepRca !== undefined ? (
              <StatusLine name="isPepRca" value={pepRca} />
            ) : null}
            {sanctioned !== undefined ? (
              <StatusLine name="sanctioned" value={sanctioned} />
            ) : null}
          </div>
        </div>
        <code className="max-w-full break-all text-xs text-muted-foreground">
          {entity.$id}
        </code>
      </header>

      <div className="mt-4 space-y-4">
        {entity.$props !== undefined ? (
          <section>
            <h4 className="mb-2 font-mono text-xs text-muted-foreground">
              $props
            </h4>
            <ValueView value={entity.$props} advancedMode />
          </section>
        ) : null}

        {entity.$extra !== undefined ? (
          <section>
            <h4 className="mb-2 font-mono text-xs text-muted-foreground">
              $extra
            </h4>
            <ValueView value={entity.$extra} advancedMode />
          </section>
        ) : null}

        {entity.$sources !== undefined ? (
          <section>
            <h4 className="mb-2 font-mono text-xs text-muted-foreground">
              $sources
            </h4>
            <ValueView value={entity.$sources} advancedMode />
          </section>
        ) : null}

        {unknownTopLevel.length > 0 ? (
          <section>
            <h4 className="mb-2 text-xs text-muted-foreground">
              Additional top-level data
            </h4>
            <ValueView value={Object.fromEntries(unknownTopLevel)} advancedMode />
          </section>
        ) : null}
      </div>
    </article>
  );
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

function entityTitle(entity: PluginEntity): {
  title: string;
  titleProperty?: string;
} {
  const preferredProperty =
    entity.$entity === "entity.mediaMention"
      ? "title"
      : entity.$entity === "entity.socialProfile"
        ? "profileTitle"
        : "name";
  const preferred = firstPropertyValue(entity, preferredProperty);
  if (typeof preferred === "string" && preferred.trim()) {
    return { title: preferred, titleProperty: preferredProperty };
  }

  const name = firstPropertyValue(entity, "name");
  if (typeof name === "string" && name.trim()) {
    return { title: name, titleProperty: "name" };
  }

  return {
    title: entityMetadata(entity.$entity)?.label ?? "Result",
  };
}

function FriendlyScreeningStatus({ entity }: { entity: PluginEntity }) {
  const evaluated = SCREENING_STATUS_KEYS.flatMap((key) => {
    const value = firstPropertyValue(entity, key);
    return typeof value === "boolean" ? [{ key, value }] : [];
  });
  const positives = evaluated.filter(({ value }) => value);

  if (positives.length === 0 && evaluated.length === 0) {
    return null;
  }

  if (positives.length === 0) {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        No risk flags in completed checks
      </p>
    );
  }

  const labels: Record<(typeof SCREENING_STATUS_KEYS)[number], string> = {
    pepStatus: "PEP match",
    isPepRca: "PEP associate",
    sanctioned: "Sanctions match",
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {positives.map(({ key }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {labels[key]}
        </span>
      ))}
    </div>
  );
}

function FriendlyAdverseStatus({ entity }: { entity: PluginEntity }) {
  if (
    entity.$entity !== "entity.mediaMention" &&
    entity.$entity !== "entity.riskTopic"
  ) {
    return null;
  }
  const value = firstPropertyValue(entity, "adverseActivityDetected");
  if (typeof value !== "boolean") {
    return null;
  }
  return value ? (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300">
      <AlertTriangle className="h-4 w-4" aria-hidden />
      Potential adverse activity found
    </p>
  ) : (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="h-4 w-4" aria-hidden />
      No adverse activity found
    </p>
  );
}

export function extraRows(extra: unknown): Array<[string, unknown]> {
  if (!Array.isArray(extra)) {
    return hasContent(extra) ? [["Additional information", extra]] : [];
  }

  const grouped = new Map<string, { label: string; values: unknown[] }>();
  const ungrouped: unknown[] = [];

  for (const item of extra) {
    const payload = typedValuePayload(item);
    if (
      isRecord(payload) &&
      Object.prototype.hasOwnProperty.call(payload, "key") &&
      Object.prototype.hasOwnProperty.call(payload, "value")
    ) {
      const key = typedValuePayload(payload.key);
      if (typeof key === "string" || typeof key === "number") {
        const label = String(key);
        const normalized = label.toLowerCase();
        const group = grouped.get(normalized);
        if (group) {
          group.values.push(payload.value);
        } else {
          grouped.set(normalized, { label, values: [payload.value] });
        }
        continue;
      }
    }
    ungrouped.push(item);
  }

  const rows = Array.from(grouped.values()).map(
    ({ label, values }): [string, unknown] => [
      label,
      values.length === 1 ? values[0] : values,
    ],
  );
  if (ungrouped.length > 0) {
    rows.push(["Additional information", ungrouped]);
  }
  return rows;
}

function FriendlyEntityCard({ entity }: { entity: PluginEntity }) {
  const metadata = entityMetadata(entity.$entity);
  const Icon = metadata ? ICONS[metadata.icon] : ScanSearch;
  const { title, titleProperty } = entityTitle(entity);
  const props = isRecord(entity.$props) ? entity.$props : {};
  const recognizedStatusKeys = SCREENING_STATUS_KEYS.filter(
    (key) => typeof firstPropertyValue(entity, key) === "boolean",
  );
  const hasRecognizedAdverseStatus =
    typeof firstPropertyValue(entity, "adverseActivityDetected") ===
    "boolean";
  const excluded = new Set<string>([
    ...(titleProperty ? [titleProperty] : []),
    ...recognizedStatusKeys,
    ...(hasRecognizedAdverseStatus ? ["adverseActivityDetected"] : []),
  ]);
  const propertyNames = orderedPropertyNames(
    entity.$entity,
    Object.keys(props).filter(
      (key) => !excluded.has(key) && hasContent(props[key]),
    ),
  );
  const rows: Array<[string, unknown]> = propertyNames.map((key) => [
    propertyMetadata(entity.$entity, key)?.label ?? key,
    propertyValues(entity, key),
  ]);
  rows.push(...extraRows(entity.$extra));

  const unknownTopLevel = Object.entries(entity).filter(
    ([key, value]) => !STANDARD_KEYS.has(key) && hasContent(value),
  );
  rows.push(...unknownTopLevel);

  const sources = pluginSources(entity);

  return (
    <article className="border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0">
      <header>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden />
          {metadata?.label ?? entity.$entity}
        </div>
        <h3 className="mt-1 break-words text-base font-semibold">{title}</h3>
        <FriendlyScreeningStatus entity={entity} />
        <FriendlyAdverseStatus entity={entity} />
      </header>

      {rows.length > 0 ? (
        <dl className="mt-3">
          {rows.map(([label, value], index) => (
            <div
              key={`${label}:${index}`}
              className="grid gap-1 border-b border-border/70 py-2.5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
            >
              <dt className="break-words text-sm text-muted-foreground">
                {label}
              </dt>
              <dd className="min-w-0 text-sm">
                <ValueView value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {sources.length > 0 ? (
        <section className="mt-3 border-t border-border/70 pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">Sources</h4>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {sources.map((source, index) => {
              const href = safeWebUrl(source.source);
              return href ? (
                <a
                  key={`${source.source}:${index}`}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-full break-all text-sm text-primary underline decoration-border underline-offset-4 hover:decoration-current"
                >
                  {source.name}
                </a>
              ) : (
                <span
                  key={`${source.source}:${index}`}
                  className="break-all text-sm"
                >
                  {source.name}: {source.source}
                </span>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}

export function EntityCard({
  entity,
  advancedMode = false,
}: {
  entity: PluginEntity;
  advancedMode?: boolean;
}) {
  return advancedMode ? (
    <TechnicalEntityCard entity={entity} />
  ) : (
    <FriendlyEntityCard entity={entity} />
  );
}
