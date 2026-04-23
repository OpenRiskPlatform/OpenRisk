import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { useFavorites } from "@/core/favorites-context";
import { typedValueToCompactText } from "./entityProps";

export interface EntityTableColumnConfig {
    id: string;
    header: string;
    getValues: (entity: DataModelEntity) => TypedValue[];
    variant?: "text" | "badges";
    secondaryText?: (entity: DataModelEntity) => string | null;
    className?: string;
}

interface EntityTableSectionProps {
    entityType: string;
    title: string;
    entities: DataModelEntity[];
    columns: EntityTableColumnConfig[];
    renderExpanded: (entity: DataModelEntity) => ReactNode;
    /** When true, renders without card wrapper (no border/shadow/rounded) to sit flush inside a parent card */
    flat?: boolean;
    /** When true, hides the favourite star button */
    hideFavorite?: boolean;
}

export function EntityTableSection({
    entityType: _entityType,
    title,
    entities: initialEntities,
    columns,
    renderExpanded,
    flat = false,
    hideFavorite = false,
}: EntityTableSectionProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [entities, setEntities] = useState(initialEntities);
    const { isFavorite, toggleFavorite: ctxToggle } = useFavorites();

    // Sync entities when the incoming data changes (e.g. user selects a different scan)
    useEffect(() => {
        setEntities(initialEntities);
        setExpandedId(null);
    }, [initialEntities]);

    if (!entities.length) return null;

    const move = (index: number, delta: -1 | 1) => {
        const next = [...entities];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setEntities(next);
    };


    return (
        <div className={flat ? "overflow-x-auto" : "overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-[0_18px_40px_-28px_rgba(15,23,42,0.14)]"}>
            <div className="overflow-x-auto">
                    <Table className="border-separate border-spacing-0">
                        <TableHeader className="[&_tr]:border-b-0">
                            <TableRow className="!border-b-0 hover:!bg-transparent">
                                {/* expand chevron col */}
                                <TableHead
                                    className="sticky top-0 z-10 w-10 bg-card"
                                    style={{ boxShadow: flat ? "inset 0 1px 0 hsl(var(--border)), inset 0 -1px 0 hsl(var(--border))" : "inset 0 -1px 0 hsl(var(--border))" }}
                                />
                                {columns.map((column) => (
                                    <TableHead
                                        key={column.id}
                                        className={`sticky top-0 z-10 bg-card ${column.className ?? ""}`}
                                        style={{ boxShadow: flat ? "inset 0 1px 0 hsl(var(--border)), inset 0 -1px 0 hsl(var(--border))" : "inset 0 -1px 0 hsl(var(--border))" }}
                                    >
                                        {column.header}
                                    </TableHead>
                                ))}
                                {/* reorder col */}
                                <TableHead
                                    className="sticky top-0 z-10 w-24 bg-card"
                                    style={{ boxShadow: flat ? "inset 0 1px 0 hsl(var(--border)), inset 0 -1px 0 hsl(var(--border))" : "inset 0 -1px 0 hsl(var(--border))" }}
                                />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entities.map((entity, index) => {
                                const isExpanded = expandedId === entity.$id;
                                const bg = isExpanded ? "bg-muted" : "";
                                return (
                                    <Fragment key={`${entity.$entity}-${entity.$id}`}>
                                        <TableRow
                                            className={isExpanded ? "bg-muted hover:bg-muted" : isFavorite(entity.$id) ? "bg-amber-50/60 dark:bg-amber-900/10 cursor-pointer" : "cursor-pointer"}
                                            onClick={() =>
                                                setExpandedId((current) =>
                                                    current === entity.$id ? null : entity.$id,
                                                )
                                            }
                                        >
                                            <TableCell className={`w-10 pr-0 ${bg}`}>
                                                {isExpanded
                                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                            </TableCell>
                                            {columns.map((column) => (
                                                <TableCell key={column.id} className={bg}>
                                                    <CompactEntityCell
                                                        values={column.getValues(entity)}
                                                        variant={column.variant ?? "text"}
                                                        secondaryText={column.secondaryText?.(entity) ?? null}
                                                    />
                                                </TableCell>
                                            ))}
                                            <TableCell
                                                className={`w-24 ${bg}`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex gap-0.5 items-center">
                                                    {!hideFavorite && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`h-6 w-6 ${isFavorite(entity.$id) ? "text-amber-500" : "text-muted-foreground"}`}
                                                            onClick={() => ctxToggle(entity)}
                                                            title={isFavorite(entity.$id) ? "Remove favourite" : "Mark as favourite"}
                                                        >
                                                            <Star className={`h-3.5 w-3.5 ${isFavorite(entity.$id) ? "fill-amber-400" : ""}`} />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground"
                                                        disabled={index === 0}
                                                        onClick={() => move(index, -1)}
                                                        title="Move up"
                                                    >
                                                        <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground"
                                                        disabled={index === entities.length - 1}
                                                        onClick={() => move(index, 1)}
                                                        title="Move down"
                                                    >
                                                        <ArrowDown className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded && (
                                            <TableRow className="bg-muted hover:bg-muted">
                                                <TableCell className="w-10 bg-muted" />
                                                <TableCell colSpan={columns.length} className="bg-muted p-5 lg:p-6">
                                                    {renderExpanded(entity)}
                                                </TableCell>
                                                <TableCell className="w-24 bg-muted" />
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
            </div>
        </div>
    );
}

function CompactEntityCell({
    values,
    variant,
    secondaryText,
}: {
    values: TypedValue[];
    variant: "text" | "badges";
    secondaryText: string | null;
}) {
    const visibleValues = values.filter((value) => typedValueToCompactText(value).length > 0);

    if (variant === "badges") {
        if (!visibleValues.length) {
            return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
            <div className="flex flex-wrap items-center gap-1">
                {visibleValues.slice(0, 2).map((value, index) => (
                    <Badge key={`${typedValueToCompactText(value)}-${index}`} variant="outline" className="text-xs max-w-full">
                        <span className="truncate">{typedValueToCompactText(value)}</span>
                    </Badge>
                ))}
                {visibleValues.length > 2 && (
                    <span className="text-xs text-muted-foreground">
                        +{visibleValues.length - 2}
                    </span>
                )}
            </div>
        );
    }

    const primaryText = visibleValues.length > 0 ? typedValueToCompactText(visibleValues[0]) : "-";
    const overflowCount = visibleValues.length > 1 ? visibleValues.length - 1 : 0;

    return (
        <div className="min-w-0 space-y-1.5">
            <p
                className="max-w-full overflow-hidden text-sm leading-snug [overflow-wrap:anywhere]"
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
            >
                {primaryText}
            </p>
            {secondaryText && (
                <p
                    className="max-w-full overflow-hidden text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]"
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                >
                    {secondaryText}
                </p>
            )}
            {!secondaryText && overflowCount > 0 && (
                <p className="text-xs text-muted-foreground">+{overflowCount} more</p>
            )}
        </div>
    );
}
