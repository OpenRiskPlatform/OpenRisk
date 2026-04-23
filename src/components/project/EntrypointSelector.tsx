import { Checkbox } from "@/components/ui/checkbox";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { PluginEntrypointRecord } from "@/core/backend/bindings";

interface EntrypointSelectorProps {
    entrypoints: PluginEntrypointRecord[];
    enabledEntrypoints: Record<string, boolean>;
    onChange: (entrypointId: string, enabled: boolean) => void;
    disabled?: boolean;
}

export function EntrypointSelector({
    entrypoints,
    enabledEntrypoints,
    onChange,
    disabled = false,
}: EntrypointSelectorProps) {
    if (entrypoints.length <= 1) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Select Entrypoints</CardTitle>
                <CardDescription>
                    Choose which screening entrypoints to run. Input fields shared across
                    selected entrypoints will be filled in once.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    {entrypoints.map((ep) => {
                        const isEnabled = Boolean(enabledEntrypoints[ep.id]);
                        return (
                            <label
                                key={ep.id}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 select-none transition-colors text-sm ${
                                    disabled
                                        ? "opacity-50 cursor-not-allowed"
                                        : "cursor-pointer"
                                } ${
                                    isEnabled
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:border-foreground/40"
                                }`}
                            >
                                <Checkbox
                                    id={`ep-${ep.id}`}
                                    checked={isEnabled}
                                    disabled={disabled}
                                    onCheckedChange={(checked) =>
                                        onChange(ep.id, Boolean(checked))
                                    }
                                    className="h-3.5 w-3.5"
                                />
                                <span className="font-medium">{ep.name}</span>
                                {ep.description && (
                                    <span className="hidden sm:inline text-xs opacity-70">
                                        — {ep.description}
                                    </span>
                                )}
                            </label>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
