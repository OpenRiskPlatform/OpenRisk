import {
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PluginEntity } from "./resultSchema";
import { ValueView } from "./ValueView";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function typedPrimitive(value: unknown): unknown {
  if (isRecord(value) && "$type" in value && "value" in value) {
    return value.value;
  }
  return value;
}

function firstProp(entity: PluginEntity, key: string): unknown {
  if (!isRecord(entity.$props)) {
    return undefined;
  }
  const value = entity.$props[key];
  return Array.isArray(value) ? typedPrimitive(value[0]) : typedPrimitive(value);
}

function isProminent(value: unknown): boolean {
  const primitive = typedPrimitive(value);
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
  const name = firstProp(entity, "name");
  const pepStatus = firstProp(entity, "pepStatus");
  const sanctioned = firstProp(entity, "sanctioned");
  const standardKeys = new Set([
    "$entity",
    "$id",
    "$modelVersion",
    "$sources",
    "$props",
    "$extra",
  ]);
  const unknownTopLevel = Object.entries(entity).filter(
    ([key]) => !standardKeys.has(key),
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
        {isRecord(entity.$props) ? (
          <section>
            <h4 className="mb-2 font-mono text-xs text-muted-foreground">
              $props
            </h4>
            <ValueView value={entity.$props} advancedMode />
          </section>
        ) : entity.$props !== undefined ? (
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

function FriendlyEntityCard({ entity }: { entity: PluginEntity }) {
  const name = firstProp(entity, "name");
  const pepStatus = firstProp(entity, "pepStatus");
  const sanctioned = firstProp(entity, "sanctioned");
  const props = isRecord(entity.$props) ? entity.$props : {};
  const visibleProps = Object.fromEntries(
    Object.entries(props).filter(
      ([key]) => !["name", "pepStatus", "sanctioned"].includes(key),
    ),
  );
  const standardKeys = new Set([
    "$entity",
    "$id",
    "$modelVersion",
    "$sources",
    "$props",
    "$extra",
  ]);
  const extraData = Object.fromEntries(
    Object.entries(entity).filter(([key]) => !standardKeys.has(key)),
  );
  const hasExtra = hasContent(entity.$extra);
  const hasSources = hasContent(entity.$sources);

  return (
    <article className="border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0">
      <header>
        <p className="break-words text-base font-semibold">
          {name === undefined ? "Result" : String(name)}
        </p>
        {pepStatus !== undefined || sanctioned !== undefined ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1">
            {pepStatus !== undefined ? (
              <StatusLine name="pepStatus" value={pepStatus} />
            ) : null}
            {sanctioned !== undefined ? (
              <StatusLine name="sanctioned" value={sanctioned} />
            ) : null}
          </div>
        ) : null}
      </header>

      {Object.keys(visibleProps).length > 0 ? (
        <div className="mt-3">
          <ValueView value={visibleProps} />
        </div>
      ) : null}

      {hasExtra ? (
        <div className="mt-2">
          <ValueView value={entity.$extra} />
        </div>
      ) : null}

      {Object.keys(extraData).length > 0 ? (
        <div className="mt-2">
          <ValueView value={extraData} />
        </div>
      ) : null}

      {hasSources ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Sources
          </summary>
          <div className="mt-2 pl-4">
            <ValueView value={entity.$sources} />
          </div>
        </details>
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
