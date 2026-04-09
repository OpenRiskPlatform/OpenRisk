/**
 * AdverseaEndpointSelector – shown when the Adversea plugin is selected.
 * Lets the user pick which Adversea screening endpoints to call.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface AdverseaEndpoint {
  id: string;
  label: string;
  description: string;
}

export const ADVERSEA_ENDPOINTS: AdverseaEndpoint[] = [
  {
    id: "screening/rpo",
    label: "RPO Screening",
    description: "Screen against the Register of Public Officials and business registries.",
  },
  {
    id: "screening/socialMedia",
    label: "Social Media Scan",
    description: "Search for the target's presence across social media platforms.",
  },
];

interface AdverseaEndpointSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  highlighted?: boolean;
}

export function AdverseaEndpointSelector({ selected, onChange, highlighted = false }: AdverseaEndpointSelectorProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((e) => e !== id) : [...selected, id]
    );
  };

  return (
    <Card className={`transition-all ${highlighted ? "ring-2 ring-green-500" : ""}`}>
      <CardHeader>
        <CardTitle>Adversea Endpoints</CardTitle>
        <CardDescription>Select which screening endpoints to call. Each endpoint will cost 1 token.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ADVERSEA_ENDPOINTS.map((endpoint) => (
          <div key={endpoint.id} className="flex items-start gap-3">
            <Checkbox
              id={`adversea-endpoint-${endpoint.id}`}
              checked={selected.includes(endpoint.id)}
              onCheckedChange={() => toggle(endpoint.id)}
            />
            <div className="grid gap-0.5">
              <Label
                htmlFor={`adversea-endpoint-${endpoint.id}`}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {endpoint.label}
              </Label>
              <p className="text-xs text-muted-foreground">{endpoint.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
