import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TypedSettingInput } from "@/components/settings/TypedSettingInput";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { PluginRecord, PluginInputDef } from "@/core/backend/bindings";

interface PluginRunCardProps {
    plugin: PluginRecord;
    enabledEntrypoints: Record<string, boolean>;
    onEntrypointChange: (entrypointId: string, enabled: boolean) => void;
    entrypointInputs: Record<string, Record<string, unknown>>;
    onFieldChange: (entrypointId: string, fieldName: string, value: unknown) => void;
    running: boolean;
    canRun: boolean;
    detailError: string | null;
    onRunScan: () => void;
}

/** Decide if an input should span the full row or share with a neighbour. */
function isFullWidth(input: PluginInputDef): boolean {
    return (
        input.type.name === "boolean" ||
        (input.type.values != null && input.type.values.length > 0) ||
        (input.description ?? "").length > 60
    );
}

export function PluginRunCard({
    plugin,
    enabledEntrypoints,
    onEntrypointChange,
    entrypointInputs,
    onFieldChange,
    running,
    canRun,
    detailError,
    onRunScan,
}: PluginRunCardProps) {
    const entrypoints = plugin.entrypoints;
    const inputDefs = plugin.inputDefs;
    const singleEntrypoint = entrypoints.length === 1;

    // Auto-enable the sole entrypoint
    useEffect(() => {
        console.log(`[PluginRunCard] plugin="${plugin.id}" inputDefs:`, JSON.stringify(plugin.inputDefs, null, 2));
        if (singleEntrypoint && !enabledEntrypoints[entrypoints[0].id]) {
            onEntrypointChange(entrypoints[0].id, true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plugin.id]);

    // Collect unique fields across all enabled entrypoints (deduplicated by field name)
    const enabledEpIds = entrypoints
        .filter((ep) => Boolean(enabledEntrypoints[ep.id]))
        .map((ep) => ep.id);

    const uniqueFields: PluginInputDef[] = [];
    const seenFieldNames = new Set<string>();
    for (const epId of enabledEpIds) {
        for (const input of inputDefs.filter((d) => d.entrypointId === epId)) {
            if (!seenFieldNames.has(input.name)) {
                seenFieldNames.add(input.name);
                uniqueFields.push(input);
            }
        }
    }

    // Which entrypoints own a given field name
    const entrypointsByField = (fieldName: string): string[] =>
        enabledEpIds.filter((epId) =>
            inputDefs.some((d) => d.entrypointId === epId && d.name === fieldName),
        );

    // Get current value: prefer the first entrypoint that has a non-null value
    const getFieldValue = (fieldName: string): unknown => {
        for (const epId of entrypointsByField(fieldName)) {
            const v = entrypointInputs[epId]?.[fieldName];
            if (v !== undefined && v !== null && v !== "") return v;
        }
        return entrypointInputs[enabledEpIds[0]]?.[fieldName];
    };

    // Set value on ALL entrypoints that share this field
    const handleSharedFieldChange = (fieldName: string, value: unknown) => {
        for (const epId of entrypointsByField(fieldName)) {
            onFieldChange(epId, fieldName, value);
        }
    };

    if (enabledEpIds.length === 0) return null;

    const allRequiredFilled = uniqueFields
        .filter((input) => !input.optional)
        .every((input) => {
            const v = getFieldValue(input.name);
            return v !== undefined && v !== null && String(v).trim() !== "";
        });

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Search</CardTitle>
            </CardHeader>
            <CardContent>
                {uniqueFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No input fields required for the selected entrypoints.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                        {uniqueFields.map((input) => {
                            const options =
                                input.type.values && input.type.values.length > 0
                                    ? input.type.values
                                    : undefined;
                            const full = isFullWidth(input);
                            const value = getFieldValue(input.name);

                            return (
                                <div
                                    key={input.name}
                                    className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}
                                >
                                    <p className="text-xs font-semibold text-foreground">
                                        {input.title}
                                        {!input.optional && (
                                            <span className="text-destructive ml-0.5">*</span>
                                        )}
                                    </p>
                                                <TypedSettingInput
                                                    typeName={input.type.name}
                                                    value={value}
                                                    options={options}
                                                    placeholder={
                                                        input.type.name !== "boolean"
                                                            ? input.title
                                                            : undefined
                                                    }
                                                    disabled={running}
                                                    onChange={(v) =>
                                                        handleSharedFieldChange(input.name, v)
                                                    }
                                                />
                                    {input.type.name === "boolean" && (
                                        <Label className="text-sm font-medium">
                                            {input.title}
                                            {!input.optional && (
                                                <span className="text-destructive ml-1">*</span>
                                            )}
                                        </Label>
                                    )}
                                    {input.description && (
                                        <p className="text-xs text-muted-foreground">
                                            {input.description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex flex-col items-center gap-2 pt-2">
                <Button
                    onClick={onRunScan}
                    disabled={running || !canRun || !allRequiredFilled}
                    className="w-full"
                >
                    {running ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Running…
                        </>
                    ) : (
                        "Run Scan"
                    )}
                </Button>
                {!canRun && (
                    <p className="text-xs text-muted-foreground">
                        Enable at least one entrypoint above to run the scan.
                    </p>
                )}
                {canRun && !allRequiredFilled && (
                    <p className="text-xs text-muted-foreground">
                        Fill in all required fields (<span className="text-destructive">*</span>) to run the scan.
                    </p>
                )}
                {detailError && (
                    <p className="text-sm text-destructive text-center">{detailError}</p>
                )}
            </CardFooter>
        </Card>
    );
}
