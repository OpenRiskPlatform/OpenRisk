/**
 * PersonSearchForm – the search criteria form (fields + submit/clear).
 */

import { FormEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PersonSearchFields } from "@/types/personSearch";

interface PersonSearchFormProps {
  fields: PersonSearchFields;
  searchType: "person" | "company";
  loading: boolean;
  error: string | null;
  hasAnyField: boolean;
  countrySearch: string;
  filteredCountries: { code: string; label: string }[];
  onFieldChange: (
    field: keyof PersonSearchFields
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNationalityChange: (val: string) => void;
  onCountrySearchChange: (val: string) => void;
  onClearNationality: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
}

export function PersonSearchForm({
  fields,
  searchType,
  loading,
  error,
  hasAnyField,
  countrySearch,
  filteredCountries,
  onFieldChange,
  onNationalityChange,
  onCountrySearchChange,
  onClearNationality,
  onSubmit,
  onClear,
}: PersonSearchFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Criteria</CardTitle>
        <CardDescription>
          {searchType === "person"
            ? "Fill in one or more fields to search for a person. All provided fields will be used to narrow the results."
            : "Fill in one or more fields to search for a company. All provided fields will be used to narrow the results."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="e.g. John"
                value={fields.firstName}
                onChange={onFieldChange("firstName")}
                disabled={loading}
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name / Surname</Label>
              <Input
                id="lastName"
                placeholder="e.g. Doe"
                value={fields.lastName}
                onChange={onFieldChange("lastName")}
                disabled={loading}
              />
            </div>

            {/* Personal Number */}
            <div className="space-y-2">
              <Label htmlFor="personalNumber">Personal / ID Number</Label>
              <Input
                id="personalNumber"
                placeholder="e.g. 8001011234"
                value={fields.personalNumber}
                onChange={onFieldChange("personalNumber")}
                disabled={loading}
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="text"
                placeholder="e.g. 31.01.1990"
                value={fields.dateOfBirth}
                onChange={onFieldChange("dateOfBirth")}
                disabled={loading}
              />
            </div>

            {/* Nationality */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nationality">Nationality / Country</Label>
              <Select
                value={fields.nationality}
                onValueChange={onNationalityChange}
                disabled={loading}
              >
                <SelectTrigger id="nationality" className="sm:max-w-xs">
                  <SelectValue placeholder="Select a country…" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 sticky top-0 bg-popover z-10">
                    <Input
                      placeholder="Search country…"
                      value={countrySearch}
                      onChange={(e) => onCountrySearchChange(e.target.value)}
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredCountries.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No country found.
                    </div>
                  )}
                  {filteredCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fields.nationality && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={onClearNationality}
                >
                  Clear selection
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button type="submit" disabled={loading || !hasAnyField}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClear}
              disabled={loading}
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
