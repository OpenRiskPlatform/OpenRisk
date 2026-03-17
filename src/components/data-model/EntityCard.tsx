import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { PersonEntityCard } from "./PersonEntityCard";
import { TypedValueView } from "./TypedValueView";

interface EntityCardProps {
    entity: DataModelEntity;
}

export function EntityCard({ entity }: EntityCardProps) {
    if (entity.$entity === "entity.person") {
        return <PersonEntityCard entity={entity} />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{entity.$entity}</CardTitle>
                <CardDescription>ID: {entity.$id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    {Object.entries(entity.$props ?? {}).map(([key, values]) => (
                        <div key={key} className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">{key}</p>
                            <div className="space-y-1 text-sm">
                                {(values as TypedValue[]).map((value, idx) => (
                                    <TypedValueView key={`${key}-${idx}`} item={value} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
