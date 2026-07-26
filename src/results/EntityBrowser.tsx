import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EntityCard } from "./EntityCard";
import type { PluginEntity } from "./resultSchema";

const PAGE_SIZE = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function primitive(value: unknown): unknown {
  if (isRecord(value) && "$type" in value && "value" in value) {
    return value.value;
  }
  return value;
}

function entityTitle(entity: PluginEntity) {
  if (isRecord(entity.$props)) {
    const name = entity.$props.name;
    const first = Array.isArray(name) ? primitive(name[0]) : primitive(name);
    if (first !== null && first !== undefined && String(first).trim()) {
      return String(first);
    }
  }
  return entity.$id || "Result";
}

interface IndexedEntity {
  entity: PluginEntity;
  index: number;
}

export function EntityBrowser({
  entities,
  advancedMode,
}: {
  entities: PluginEntity[];
  advancedMode: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entities
      .map((entity, index) => ({ entity, index }))
      .filter(({ entity }) => {
        if (!normalized) {
          return true;
        }
        return [entityTitle(entity), entity.$entity, entity.$id].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      });
  }, [entities, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEntities = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );
  const selected =
    filtered.find((item) => item.index === selectedIndex) ?? pageEntities[0];

  useEffect(() => {
    setQuery("");
    setPage(0);
    setSelectedIndex(0);
  }, [entities]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
    if (selected && selected.index !== selectedIndex) {
      setSelectedIndex(selected.index);
    }
  }, [page, safePage, selected, selectedIndex]);

  if (entities.length === 1) {
    return <EntityCard entity={entities[0]} advancedMode={advancedMode} />;
  }

  const changePage = (nextPage: number) => {
    const bounded = Math.max(0, Math.min(nextPage, pageCount - 1));
    setPage(bounded);
    const first = filtered[bounded * PAGE_SIZE];
    if (first) {
      setSelectedIndex(first.index);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filtered.length === entities.length
            ? `${entities.length} results`
            : `${filtered.length} of ${entities.length} results`}
        </p>
        {entities.length > 8 ? (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder="Filter results"
              className="h-8 pl-8 text-sm"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="border-y py-10 text-center text-sm text-muted-foreground">
          No matching results.
        </p>
      ) : (
        <div className="grid border-y md:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="max-h-[36rem] overflow-y-auto overscroll-contain border-b md:border-b-0 md:border-r">
            {pageEntities.map(({ entity, index }) => (
              <button
                key={`${entity.$entity}:${entity.$id}:${index}`}
                type="button"
                className={cn(
                  "block w-full border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50",
                  selected?.index === index && "bg-muted",
                )}
                onClick={() => setSelectedIndex(index)}
              >
                <span className="block truncate text-sm font-medium">
                  {entityTitle(entity)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {advancedMode ? entity.$id : entity.$entity}
                </span>
              </button>
            ))}
          </div>
          <div className="min-w-0 py-4 md:pl-5">
            {selected ? (
              <EntityCard
                entity={selected.entity}
                advancedMode={advancedMode}
              />
            ) : null}
          </div>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            disabled={safePage === 0}
            onClick={() => changePage(safePage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            disabled={safePage >= pageCount - 1}
            onClick={() => changePage(safePage + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
