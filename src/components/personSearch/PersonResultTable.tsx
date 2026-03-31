/**
 * PersonResultTable – sortable result table with expandable rows and pagination.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  UserSearch,
  Star,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SearchResultEntity, PAGE_SIZE } from "@/types/personSearch";
import {
  getEntityRowData,
  renderValue,
  resolveCountryName,
  PROP_LABELS,
} from "@/utils/personSearchUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonResultTableProps {
  entities: SearchResultEntity[];
  page: number;
  totalResults: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  favoriteEntityIds?: Set<string>;
  onToggleFavorite?: (entity: SearchResultEntity) => void;
  onReorder?: (ordered: SearchResultEntity[]) => void;
}

interface SortableRowProps {
  entity: SearchResultEntity;
  isExpanded: boolean;
  isDragging: boolean;
  toggleRow: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (entity: SearchResultEntity) => void;
}

// ---------------------------------------------------------------------------
// Row cell contents (shared between real rows and drag overlay)
// ---------------------------------------------------------------------------

function RowCellContents({
  entity,
  hasMore,
  isExpanded,
  displayName,
  aliases,
  birthDate,
  countries,
  topics,
  isFavorite,
  onToggleFavorite,
  onChevronClick,
  gripProps,
}: {
  entity: SearchResultEntity;
  hasMore: boolean;
  isExpanded: boolean;
  displayName: string;
  aliases: string[];
  birthDate: string;
  countries: string[];
  topics: string[];
  isFavorite?: boolean;
  onToggleFavorite?: (entity: SearchResultEntity) => void;
  onChevronClick?: () => void;
  gripProps?: React.HTMLAttributes<HTMLTableCellElement>;
}) {
  const stickyCell = isExpanded ? "sticky top-[48px] z-[5] bg-muted" : "";

  return (
    <>
      <TableCell className={`w-6 pr-0 pl-2 ${stickyCell}`} {...gripProps}>
        <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
      </TableCell>
      <TableCell
        className={`w-8 pr-0 ${onChevronClick ? "cursor-pointer" : ""} ${stickyCell}`}
        onClick={
          onChevronClick
            ? (e) => {
                e.stopPropagation();
                onChevronClick();
              }
            : undefined
        }
      >
        {hasMore ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : null}
      </TableCell>
      <TableCell className={`font-medium ${stickyCell}`}>
        <div>{displayName}</div>
        {aliases.length > 0 && (
          <div className="text-xs text-muted-foreground">
            aliases: {aliases.slice(0, 2).join(", ")}
            {aliases.length > 2 && (
              <span className="ml-1 text-primary">
                +{aliases.length - 2} more
              </span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className={stickyCell}>
        <Badge variant="outline">{entity.schema ?? "Unknown"}</Badge>
      </TableCell>
      <TableCell className={`text-sm ${stickyCell}`}>{birthDate}</TableCell>
      <TableCell className={stickyCell}>
        <div className="flex flex-wrap gap-1 items-center">
          {countries.slice(0, 3).map((c: string) => (
            <Badge key={c} variant="outline" className="text-xs">
              {c}
            </Badge>
          ))}
          {countries.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{countries.length - 3}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={stickyCell}>
        <div className="flex flex-wrap gap-1 items-center">
          {topics.slice(0, 3).map((t: string) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t.replace("role.", "").replace("sanction", "sanctioned")}
            </Badge>
          ))}
          {topics.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{topics.length - 3}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={`w-8 ${stickyCell}`}>
        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${isFavorite ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
            title={isFavorite ? "Remove from favourites" : "Save to favourites"}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(entity); }}
          >
            <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-yellow-400" : ""}`} />
          </Button>
        )}
      </TableCell>
    </>
  );
}

// ---------------------------------------------------------------------------
// Expanded detail row
// ---------------------------------------------------------------------------

function ExpandedDetailRow({ entity }: { entity: SearchResultEntity }) {
  const { allDetailProps } = getEntityRowData(entity);

  return (
    <TableRow
      key={`${entity.id}-expanded`}
      className="hover:!bg-muted"
      style={{ background: "hsl(var(--muted))" }}
    >
      <TableCell />
      <TableCell />
      <TableCell colSpan={6} className="py-4 px-6">
        <div className="text-sm">
          {allDetailProps.map(([key, values], sectionIdx) => {
            const isCountryLike = [
              "country",
              "nationality",
              "birthCountry",
              "citizenship",
            ].includes(key);
            const resolvedValues = isCountryLike
              ? [...new Set((values as string[]).map(resolveCountryName))]
              : (values as string[]);
            const label = PROP_LABELS[key] ?? key;

            return (
              <div key={key} className="mb-4">
                <p className="text-center font-semibold text-foreground mb-2 capitalize">
                  {label}
                </p>

                {key === "gender" ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {resolvedValues.map((g: string) => {
                      const val = g.toLowerCase();
                      const isMale = val === "male";
                      return (
                        <Badge
                          key={g}
                          variant="outline"
                          className={`text-xs ${
                            isMale
                              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                          }`}
                        >
                          {g}
                        </Badge>
                      );
                    })}
                  </div>
                ) : resolvedValues.length === 1 &&
                  !isCountryLike &&
                  key !== "topics" ? (
                  <p className="text-center text-muted-foreground">
                    {renderValue(resolvedValues[0])}
                  </p>
                ) : key === "topics" ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {resolvedValues.map((t: string) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-xs border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      >
                        {t.replace("role.", "").replace("sanction", "sanctioned")}
                      </Badge>
                    ))}
                  </div>
                ) : isCountryLike ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {resolvedValues.map((c: string, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <ul className="list-disc ml-6 space-y-1">
                    {resolvedValues.map((v, i) => (
                      <li key={i} className="text-muted-foreground">
                        {renderValue(v)}
                      </li>
                    ))}
                  </ul>
                )}

                {sectionIdx < allDetailProps.length - 1 && (
                  <hr className="border-border mt-4" />
                )}
              </div>
            );
          })}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Sortable row
// ---------------------------------------------------------------------------

function SortableRow({
  entity,
  isExpanded,
  isDragging,
  toggleRow,
  isFavorite,
  onToggleFavorite,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isSorting } =
    useSortable({ id: entity.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translateY(${Math.round(transform.y)}px)`
      : undefined,
    transition,
    ...(isDragging ? { visibility: "hidden" as const } : {}),
  };

  const { displayName, aliases, birthDate, countries, topics, hasMore } =
    getEntityRowData(entity);

  return (
    <>
      <TableRow
        ref={setNodeRef}
        style={{
          ...style,
          ...(isExpanded
            ? {
                background: "hsl(var(--muted))",
                boxShadow: "inset 0 -1px 0 hsl(var(--border))",
              }
            : {}),
        }}
        className={`transition-colors ${
          hasMore && !isExpanded ? "cursor-pointer" : ""
        } ${
          isExpanded
            ? "bg-muted !border-b-0 hover:!bg-muted"
            : "hover:bg-muted/50"
        }`}
        onClick={() => {
          if (isSorting || isExpanded) return;
          if (hasMore) toggleRow(entity.id);
        }}
      >
        <RowCellContents
          entity={entity}
          hasMore={hasMore}
          isExpanded={isExpanded}
          displayName={displayName}
          aliases={aliases}
          birthDate={birthDate}
          countries={countries}
          topics={topics}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          onChevronClick={isExpanded ? () => toggleRow(entity.id) : undefined}
          gripProps={{
            onClick: (e) => e.stopPropagation(),
            ...attributes,
            ...listeners,
          }}
        />
      </TableRow>

      {isExpanded && hasMore && <ExpandedDetailRow entity={entity} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Drag overlay row
// ---------------------------------------------------------------------------

function DragOverlayRowContent({ entity }: { entity: SearchResultEntity }) {
  const { displayName, aliases, birthDate, countries, topics, hasMore } =
    getEntityRowData(entity);

  return (
    <tr className="border-b">
      <RowCellContents
        entity={entity}
        hasMore={hasMore}
        isExpanded={false}
        displayName={displayName}
        aliases={aliases}
        birthDate={birthDate}
        countries={countries}
        topics={topics}
      />
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function PersonResultTable({
  entities,
  page,
  totalResults,
  onPageChange,
  loading,
  favoriteEntityIds,
  onToggleFavorite,
  onReorder,
}: PersonResultTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [orderedEntities, setOrderedEntities] =
    useState<SearchResultEntity[]>(entities);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollRef.current = containerRef.current?.closest("main") ?? null;
  }, []);

  useEffect(() => {
    setOrderedEntities(entities);
    setExpandedRows(new Set());
  }, [entities]);

  const totalPages = Math.ceil(totalResults / PAGE_SIZE);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      if (prev.has(id)) return new Set();
      return new Set([id]);
    });
  };

  const entityIds = orderedEntities.map((e) => e.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (tableRef.current) {
      const firstRow = tableRef.current.querySelector("tbody tr");
      if (firstRow) {
        const cells = firstRow.querySelectorAll("td");
        setColumnWidths(
          Array.from(cells).map((td) => td.getBoundingClientRect().width)
        );
      }
    }
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      setOrderedEntities((prev) => {
        const oldIndex = prev.findIndex((e) => e.id === active.id);
        const newIndex = prev.findIndex((e) => e.id === over.id);
        const next = arrayMove(prev, oldIndex, newIndex);
        onReorder?.(next);
        return next;
      });
    }
  };

  const handleDragCancel = () => setActiveId(null);

  const lockXAxis: Modifier = useCallback(
    ({ transform, draggingNodeRect }) => {
      if (!containerRef.current || !draggingNodeRect)
        return { ...transform, x: 0 };
      const containerRect = containerRef.current.getBoundingClientRect();
      const overlayTop = draggingNodeRect.top + transform.y;
      const overlayBottom = overlayTop + draggingNodeRect.height;
      let clampedY = transform.y;
      if (overlayTop < containerRect.top)
        clampedY = transform.y + (containerRect.top - overlayTop);
      if (overlayBottom > containerRect.bottom)
        clampedY = transform.y - (overlayBottom - containerRect.bottom);
      return { ...transform, x: 0, y: clampedY };
    },
    []
  );

  const handleDragMove = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (el.scrollTop >= maxScroll) {
      el.scrollTop = maxScroll;
    }
  }, []);

  const activeEntity = activeId
    ? orderedEntities.find((e) => e.id === activeId)
    : null;

  if (entities.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <UserSearch className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p>No results found for the given criteria.</p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[lockXAxis]}
        autoScroll={{ threshold: { x: 0, y: 0.1 }, acceleration: 0.05 }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="border-t" ref={containerRef}>
          <Table
            ref={tableRef}
            wrapperClassName="relative w-full"
            className="border-separate border-spacing-0"
          >
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className="!border-b-0 hover:!bg-transparent">
                {(
                  [
                    { label: "", className: "w-6" },
                    { label: "", className: "w-8" },
                    { label: "Name" },
                    { label: "Type" },
                    { label: "Birth Date" },
                    { label: "Nationality" },
                    { label: "Topics / Sanctions" },
                    { label: "", className: "w-8" },
                  ] as { label: string; className?: string }[]
                ).map(({ label, className }, i) => (
                  <TableHead
                    key={i}
                    className={`sticky top-0 z-10 bg-card ${className ?? ""}`}
                    style={{
                      boxShadow: "inset 0 -1px 0 hsl(var(--border))",
                    }}
                  >
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={entityIds}
                strategy={verticalListSortingStrategy}
              >
                {orderedEntities.map((entity) => (
                  <SortableRow
                    key={entity.id}
                    entity={entity}
                    isExpanded={expandedRows.has(entity.id)}
                    isDragging={activeId === entity.id}
                    toggleRow={toggleRow}
                    isFavorite={favoriteEntityIds?.has(entity.id) ?? false}
                    onToggleFavorite={onToggleFavorite ?? (() => {})}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </div>

        <DragOverlay adjustScale={false} dropAnimation={null}>
          {activeEntity ? (
            <table
              className="text-sm rounded-lg shadow-xl ring-2 ring-green-500/50 bg-background border-collapse"
              style={{
                width:
                  columnWidths.length > 0
                    ? columnWidths.reduce((a, b) => a + b, 0)
                    : undefined,
                tableLayout: "fixed",
                backgroundImage:
                  "linear-gradient(rgba(34,197,94,0.18), rgba(34,197,94,0.18))",
              }}
            >
              {columnWidths.length > 0 && (
                <colgroup>
                  {columnWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
              )}
              <tbody>
                <DragOverlayRowContent entity={activeEntity} />
              </tbody>
            </table>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Pagination */}
      {totalPages > 1 && totalResults > 5 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-6 py-4 border-t">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, totalResults)} of {totalResults}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={page === 1 || loading}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || loading}
            >
              ‹
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - page) <= 1
              )
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                  acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-2">
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={page === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(p as number)}
                    disabled={loading}
                    className="min-w-[32px]"
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages || loading}
            >
              ›
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages || loading}
            >
              »
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
