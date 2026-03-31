/**
 * SearchTypeToggle – pill toggle between Person and Company search modes.
 */

import { Building2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SearchTypeToggleProps {
  searchType: "person" | "company";
  onChange: (type: "person" | "company") => void;
}

export function SearchTypeToggle({ searchType, onChange }: SearchTypeToggleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <div className="relative inline-flex items-center rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => onChange("person")}
              className={`relative z-10 inline-flex items-center gap-2 rounded-full px-6 py-2 text-base font-medium transition-colors ${
                searchType === "person"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4" />
              Person
            </button>
            <button
              type="button"
              disabled
              className="relative z-10 inline-flex items-center gap-2 rounded-full px-6 py-2 text-base font-medium text-muted-foreground/40 cursor-not-allowed"
            >
              <Building2 className="h-4 w-4" />
              Company
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
