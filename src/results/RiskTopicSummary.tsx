import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PluginEntity } from "./resultSchema";
import { EntityCard } from "./EntityCard";
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

function detected(value: unknown): boolean {
  const primitive = typedPrimitive(value);
  return (
    primitive === true ||
    (typeof primitive === "string" &&
      primitive.trim().toLowerCase() !== "false" &&
      primitive.trim() !== "")
  );
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
      <div>
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-5 font-medium">topicId</th>
            <th className="pb-2 pr-5 font-medium">
              adverseActivityDetected
            </th>
            <th className="pb-2 font-medium">summary</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic, index) => {
            const props = isRecord(topic.$props) ? topic.$props : {};
            const topicId = firstProp(topic, "topicId");
            const activity = firstProp(topic, "adverseActivityDetected");
            const summary = firstProp(topic, "summary");
            const active = detected(activity);
            const Icon = active ? AlertTriangle : CheckCircle2;
            const remaining = Object.fromEntries(
              Object.entries(props).filter(
                ([key]) =>
                  ![
                    "topicId",
                    "name",
                    "adverseActivityDetected",
                    "summary",
                  ].includes(key),
              ),
            );
            const hasDetails =
              Object.keys(remaining).length > 0 ||
              hasContent(topic.$extra) ||
              hasContent(topic.$sources);

            return (
              <tr
                key={`${topic.$id}:${index}`}
                className="border-b align-top last:border-b-0"
              >
                <td className="py-3 pr-5 font-medium">
                  {topicId === undefined ? "—" : String(topicId)}
                </td>
                <td
                  className={cn(
                    "py-3 pr-5",
                    active
                      ? "font-medium text-red-700 dark:text-red-300"
                      : "text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-4 w-4" />
                    {activity === undefined ? "—" : String(activity)}
                  </span>
                </td>
                <td className="py-3">
                  <p className="leading-relaxed">
                    {summary === undefined ? "—" : String(summary)}
                  </p>
                  {hasDetails ? (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Details
                      </summary>
                      <div className="mt-2">
                        {Object.keys(remaining).length > 0 ? (
                          <ValueView value={remaining} />
                        ) : null}
                        {hasContent(topic.$extra) ? (
                          <ValueView value={topic.$extra} />
                        ) : null}
                        {hasContent(topic.$sources) ? (
                          <ValueView value={topic.$sources} />
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
