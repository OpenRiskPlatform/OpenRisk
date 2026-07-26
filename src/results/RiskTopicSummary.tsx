import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  firstPropertyValue,
  isRecord,
  pluginSources,
  propertyValues,
  type PluginEntity,
} from "./resultSchema";
import { EntityCard, extraRows } from "./EntityCard";
import { propertyMetadata } from "./dataModel";
import { ValueView } from "./ValueView";

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

export function RiskTopicSummary({
  topics,
  advancedMode,
}: {
  topics: PluginEntity[];
  advancedMode: boolean;
}) {
  if (advancedMode) {
    return (
      <div className="space-y-4">
        {topics.map((topic, index) => (
          <EntityCard
            key={`${topic.$entity}:${topic.$id}:${index}`}
            entity={topic}
            advancedMode
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {topics.map((topic, index) => {
        const topicId = firstPropertyValue(topic, "topicId");
        const activity = firstPropertyValue(
          topic,
          "adverseActivityDetected",
        );
        const summary = firstPropertyValue(topic, "summary");
        const adverse = activity === true;
        const evaluated = typeof activity === "boolean";
        const sources = pluginSources(topic);
        const props = isRecord(topic.$props) ? topic.$props : {};
        const detailRows: Array<[string, unknown]> = Object.keys(props)
          .filter(
            (key) =>
              ![
                "name",
                "topicId",
                "summary",
                "adverseActivityDetected",
              ].includes(key),
          )
          .map((key) => [
            propertyMetadata(topic.$entity, key)?.label ?? key,
            propertyValues(topic, key),
          ]);
        detailRows.push(...extraRows(topic.$extra));

        return (
          <article
            key={`${topic.$id}:${index}`}
            className="border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0"
          >
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {topicId === undefined ? "Risk topic" : String(topicId)}
                </p>
                {evaluated ? (
                  <p
                    className={
                      adverse
                        ? "mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300"
                        : "mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"
                    }
                  >
                    {adverse ? (
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    )}
                    {adverse
                      ? "Potential adverse activity found"
                      : "No adverse activity found"}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Not evaluated
                  </p>
                )}
              </div>
            </header>

            {summary !== undefined && String(summary).trim() ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed">
                {String(summary)}
              </p>
            ) : null}

            {detailRows.length > 0 ? (
              <dl className="mt-2">
                {detailRows.map(([label, value], detailIndex) => (
                  <div
                    key={`${label}:${detailIndex}`}
                    className="grid gap-1 border-b border-border/70 py-2 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
                  >
                    <dt className="break-words text-xs text-muted-foreground">
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
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {sources.map((source, sourceIndex) => {
                  const href = safeWebUrl(source.source);
                  return href ? (
                    <a
                      key={`${source.source}:${sourceIndex}`}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-full break-all text-xs text-primary underline decoration-border underline-offset-4 hover:decoration-current"
                    >
                      {source.name}
                    </a>
                  ) : (
                    <span
                      key={`${source.source}:${sourceIndex}`}
                      className="break-all text-xs text-muted-foreground"
                    >
                      {source.name}: {source.source}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
