/**
 * Person Search Page - Search for persons by name, surname, personal number, etc.
 */

import React, { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, ChevronDown, ChevronRight, Clipboard, GripVertical, Loader2, Search, User, UserSearch, X } from "lucide-react";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useSettings } from "@/core/settings/SettingsContext";
import { usePlugins } from "@/hooks/usePlugins";
import { InstalledPlugin } from "@/core/plugin-system/types";
import { open } from "@tauri-apps/plugin-shell";
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

// ---------------------------------------------------------------------------
// Country list (ISO 3166-1 alpha-2)
// ---------------------------------------------------------------------------
const COUNTRIES: { code: string; label: string }[] = [
  { code: "AF", label: "Afghanistan" },
  { code: "AL", label: "Albania" },
  { code: "DZ", label: "Algeria" },
  { code: "AD", label: "Andorra" },
  { code: "AO", label: "Angola" },
  { code: "AG", label: "Antigua and Barbuda" },
  { code: "AR", label: "Argentina" },
  { code: "AM", label: "Armenia" },
  { code: "AU", label: "Australia" },
  { code: "AT", label: "Austria" },
  { code: "AZ", label: "Azerbaijan" },
  { code: "BS", label: "Bahamas" },
  { code: "BH", label: "Bahrain" },
  { code: "BD", label: "Bangladesh" },
  { code: "BB", label: "Barbados" },
  { code: "BY", label: "Belarus" },
  { code: "BE", label: "Belgium" },
  { code: "BZ", label: "Belize" },
  { code: "BJ", label: "Benin" },
  { code: "BT", label: "Bhutan" },
  { code: "BO", label: "Bolivia" },
  { code: "BA", label: "Bosnia and Herzegovina" },
  { code: "BW", label: "Botswana" },
  { code: "BR", label: "Brazil" },
  { code: "BN", label: "Brunei" },
  { code: "BG", label: "Bulgaria" },
  { code: "BF", label: "Burkina Faso" },
  { code: "BI", label: "Burundi" },
  { code: "CV", label: "Cabo Verde" },
  { code: "KH", label: "Cambodia" },
  { code: "CM", label: "Cameroon" },
  { code: "CA", label: "Canada" },
  { code: "CF", label: "Central African Republic" },
  { code: "TD", label: "Chad" },
  { code: "CL", label: "Chile" },
  { code: "CN", label: "China" },
  { code: "CO", label: "Colombia" },
  { code: "KM", label: "Comoros" },
  { code: "CD", label: "Congo (DRC)" },
  { code: "CG", label: "Congo (Republic)" },
  { code: "CR", label: "Costa Rica" },
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "HR", label: "Croatia" },
  { code: "CU", label: "Cuba" },
  { code: "CY", label: "Cyprus" },
  { code: "CZ", label: "Czech Republic" },
  { code: "DK", label: "Denmark" },
  { code: "DJ", label: "Djibouti" },
  { code: "DM", label: "Dominica" },
  { code: "DO", label: "Dominican Republic" },
  { code: "EC", label: "Ecuador" },
  { code: "EG", label: "Egypt" },
  { code: "SV", label: "El Salvador" },
  { code: "GQ", label: "Equatorial Guinea" },
  { code: "ER", label: "Eritrea" },
  { code: "EE", label: "Estonia" },
  { code: "SZ", label: "Eswatini" },
  { code: "ET", label: "Ethiopia" },
  { code: "FJ", label: "Fiji" },
  { code: "FI", label: "Finland" },
  { code: "FR", label: "France" },
  { code: "GA", label: "Gabon" },
  { code: "GM", label: "Gambia" },
  { code: "GE", label: "Georgia" },
  { code: "DE", label: "Germany" },
  { code: "GH", label: "Ghana" },
  { code: "GR", label: "Greece" },
  { code: "GD", label: "Grenada" },
  { code: "GT", label: "Guatemala" },
  { code: "GN", label: "Guinea" },
  { code: "GW", label: "Guinea-Bissau" },
  { code: "GY", label: "Guyana" },
  { code: "HT", label: "Haiti" },
  { code: "HN", label: "Honduras" },
  { code: "HU", label: "Hungary" },
  { code: "IS", label: "Iceland" },
  { code: "IN", label: "India" },
  { code: "ID", label: "Indonesia" },
  { code: "IR", label: "Iran" },
  { code: "IQ", label: "Iraq" },
  { code: "IE", label: "Ireland" },
  { code: "IL", label: "Israel" },
  { code: "IT", label: "Italy" },
  { code: "JM", label: "Jamaica" },
  { code: "JP", label: "Japan" },
  { code: "JO", label: "Jordan" },
  { code: "KZ", label: "Kazakhstan" },
  { code: "KE", label: "Kenya" },
  { code: "KI", label: "Kiribati" },
  { code: "KP", label: "Korea (North)" },
  { code: "KR", label: "Korea (South)" },
  { code: "KW", label: "Kuwait" },
  { code: "KG", label: "Kyrgyzstan" },
  { code: "LA", label: "Laos" },
  { code: "LV", label: "Latvia" },
  { code: "LB", label: "Lebanon" },
  { code: "LS", label: "Lesotho" },
  { code: "LR", label: "Liberia" },
  { code: "LY", label: "Libya" },
  { code: "LI", label: "Liechtenstein" },
  { code: "LT", label: "Lithuania" },
  { code: "LU", label: "Luxembourg" },
  { code: "MG", label: "Madagascar" },
  { code: "MW", label: "Malawi" },
  { code: "MY", label: "Malaysia" },
  { code: "MV", label: "Maldives" },
  { code: "ML", label: "Mali" },
  { code: "MT", label: "Malta" },
  { code: "MH", label: "Marshall Islands" },
  { code: "MR", label: "Mauritania" },
  { code: "MU", label: "Mauritius" },
  { code: "MX", label: "Mexico" },
  { code: "FM", label: "Micronesia" },
  { code: "MD", label: "Moldova" },
  { code: "MC", label: "Monaco" },
  { code: "MN", label: "Mongolia" },
  { code: "ME", label: "Montenegro" },
  { code: "MA", label: "Morocco" },
  { code: "MZ", label: "Mozambique" },
  { code: "MM", label: "Myanmar" },
  { code: "NA", label: "Namibia" },
  { code: "NR", label: "Nauru" },
  { code: "NP", label: "Nepal" },
  { code: "NL", label: "Netherlands" },
  { code: "NZ", label: "New Zealand" },
  { code: "NI", label: "Nicaragua" },
  { code: "NE", label: "Niger" },
  { code: "NG", label: "Nigeria" },
  { code: "MK", label: "North Macedonia" },
  { code: "NO", label: "Norway" },
  { code: "OM", label: "Oman" },
  { code: "PK", label: "Pakistan" },
  { code: "PW", label: "Palau" },
  { code: "PA", label: "Panama" },
  { code: "PG", label: "Papua New Guinea" },
  { code: "PY", label: "Paraguay" },
  { code: "PE", label: "Peru" },
  { code: "PH", label: "Philippines" },
  { code: "PL", label: "Poland" },
  { code: "PT", label: "Portugal" },
  { code: "QA", label: "Qatar" },
  { code: "RO", label: "Romania" },
  { code: "RU", label: "Russia" },
  { code: "RW", label: "Rwanda" },
  { code: "KN", label: "Saint Kitts and Nevis" },
  { code: "LC", label: "Saint Lucia" },
  { code: "VC", label: "Saint Vincent and the Grenadines" },
  { code: "WS", label: "Samoa" },
  { code: "SM", label: "San Marino" },
  { code: "ST", label: "Sao Tome and Principe" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "SN", label: "Senegal" },
  { code: "RS", label: "Serbia" },
  { code: "SC", label: "Seychelles" },
  { code: "SL", label: "Sierra Leone" },
  { code: "SG", label: "Singapore" },
  { code: "SK", label: "Slovakia" },
  { code: "SI", label: "Slovenia" },
  { code: "SB", label: "Solomon Islands" },
  { code: "SO", label: "Somalia" },
  { code: "ZA", label: "South Africa" },
  { code: "SS", label: "South Sudan" },
  { code: "ES", label: "Spain" },
  { code: "LK", label: "Sri Lanka" },
  { code: "SD", label: "Sudan" },
  { code: "SR", label: "Suriname" },
  { code: "SE", label: "Sweden" },
  { code: "CH", label: "Switzerland" },
  { code: "SY", label: "Syria" },
  { code: "TW", label: "Taiwan" },
  { code: "TJ", label: "Tajikistan" },
  { code: "TZ", label: "Tanzania" },
  { code: "TH", label: "Thailand" },
  { code: "TL", label: "Timor-Leste" },
  { code: "TG", label: "Togo" },
  { code: "TO", label: "Tonga" },
  { code: "TT", label: "Trinidad and Tobago" },
  { code: "TN", label: "Tunisia" },
  { code: "TR", label: "Turkey" },
  { code: "TM", label: "Turkmenistan" },
  { code: "TV", label: "Tuvalu" },
  { code: "UG", label: "Uganda" },
  { code: "UA", label: "Ukraine" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "UY", label: "Uruguay" },
  { code: "UZ", label: "Uzbekistan" },
  { code: "VU", label: "Vanuatu" },
  { code: "VE", label: "Venezuela" },
  { code: "VN", label: "Vietnam" },
  { code: "YE", label: "Yemen" },
  { code: "ZM", label: "Zambia" },
  { code: "ZW", label: "Zimbabwe" },
];

interface PersonSearchFields {
  firstName: string;
  lastName: string;
  personalNumber: string;
  dateOfBirth: string;
  nationality: string;
}

interface SearchResultEntity {
  id: string;
  schema: string;
  caption?: string;
  properties: Record<string, string[]>;
  datasets?: string[];
  target?: boolean;
}

interface SearchResult {
  success: boolean;
  query: string;
  total?: { value: number; relation: string };
  results?: SearchResultEntity[];
  timestamp?: string;
  logs?: string[];
}

/** Converts a date string in various formats to DD.MM.YYYY (or DD.MM.YYYY HH:MM for datetimes).
 *  Handles: YYYY-MM-DDThh:mm:ss[.ms]Z, YYYY-MM-DD, YYYY-MM, YYYY.
 *  If the value doesn't match a known pattern it is returned as-is. */
function formatDate(value: string): string {
  if (!value || value === "-") return value;
  // ISO 8601 datetime: YYYY-MM-DDThh:mm:ss[.sss][Z or ±hh:mm]
  const isoDateTime = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoDateTime) return `${isoDateTime[3]}.${isoDateTime[2]}.${isoDateTime[1]} ${isoDateTime[4]}:${isoDateTime[5]}`;
  // Full date: YYYY-MM-DD
  const isoFull = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoFull) return `${isoFull[3]}.${isoFull[2]}.${isoFull[1]}`;
  // Year-month only: YYYY-MM
  const isoYM = value.match(/^(\d{4})-(\d{2})$/);
  if (isoYM) return `${isoYM[2]}.${isoYM[1]}`;
  // Year only: YYYY
  if (/^\d{4}$/.test(value)) return value;
  return value;
}

/** Returns true if the string looks like an http/https URL. */
function isUrl(value: string): boolean {
  try { return new URL(value).protocol.startsWith("http"); } catch { return false; }
}

/** Renders a value as a clickable link if it's a URL, otherwise formats it as a date. */
function renderValue(value: string): ReactNode {
  if (isUrl(value)) {
    return (
      <button
        type="button"
        className="text-primary underline underline-offset-2 hover:opacity-80 break-all text-left"
        onClick={(e) => { e.stopPropagation(); open(value); }}
      >
        {value}
      </button>
    );
  }
  return formatDate(value);
}

const emptyFields: PersonSearchFields = {
  firstName: "",
  lastName: "",
  personalNumber: "",
  dateOfBirth: "",
  nationality: "",
};

export function PersonSearchPage() {
  const backendClient = useBackendClient();
  const { getPluginSettings } = useSettings();
  const { installedPlugins } = usePlugins();

  const [fields, setFields] = useState<PersonSearchFields>(emptyFields);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<"person" | "company">("person");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);

  const [countrySearch, setCountrySearch] = useState("");

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.label.toLowerCase().includes(countrySearch.toLowerCase()) ||
          c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : COUNTRIES;

  const handleFieldChange =
    (field: keyof PersonSearchFields) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFields((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleClear = () => {
    setFields(emptyFields);
    setResult(null);
    setError(null);
    setPage(1);
  };

  const hasAnyField = Object.values(fields).some((v) => v.trim() !== "");

  const runSearch = async (pageNumber: number) => {
    if (!selectedPlugin) {
      setError("Please select a plugin to run the search.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const settings = getPluginSettings(selectedPlugin);
      const inputs: Record<string, string> = {};

      const nameParts = [fields.firstName, fields.lastName]
        .map((s) => s.trim())
        .filter(Boolean);
      if (nameParts.length > 0) inputs.name = nameParts.join(" ");
      if (fields.dateOfBirth.trim()) inputs.age = fields.dateOfBirth.trim();
      if (fields.personalNumber.trim()) inputs.personalNumber = fields.personalNumber.trim();
      if (fields.nationality.trim()) inputs.nationality = fields.nationality.trim();

      inputs.limit = String(PAGE_SIZE);
      inputs.offset = String((pageNumber - 1) * PAGE_SIZE);

      const response = await backendClient.executePlugin(
        selectedPlugin,
        inputs,
        settings
      );

      if (response.success) {
        setResult(response.data as SearchResult);
        setPage(pageNumber);
      } else {
        setError(response.error || "Plugin execution failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasAnyField) {
      setError("Please fill in at least one search field.");
      return;
    }
    setResult(null);
    setPage(1);
    await runSearch(1);
  };

  const handlePageChange = async (newPage: number) => {
    await runSearch(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
        {/* Page Header */}
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <UserSearch className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">Person Search</h1>
          </div>
          <p className="text-muted-foreground">
            Search for individuals by name, personal number, date of birth, or
            nationality using the installed risk-analysis plugins.
          </p>
        </header>

        {/* Plugin Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Plugin</CardTitle>
            <CardDescription>
              Choose which plugin to use for the person search.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {installedPlugins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No plugins installed. Go to Settings to install a plugin.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {installedPlugins.map((plugin: InstalledPlugin) => (
                  <Card
                    key={plugin.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedPlugin === plugin.id
                        ? "ring-2 ring-primary border-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedPlugin(plugin.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        {plugin.icon && (
                          <img
                            src={plugin.icon}
                            alt={`${plugin.name} icon`}
                            className="w-9 h-9 rounded"
                          />
                        )}
                        <div>
                          <CardTitle className="text-base">
                            {plugin.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            v{plugin.version}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {plugin.description}
                      </p>
                      <Badge
                        className="mt-2"
                        variant={
                          selectedPlugin === plugin.id ? "default" : "outline"
                        }
                      >
                        {selectedPlugin === plugin.id ? "Selected" : "Select"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Type Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>Search Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="relative inline-flex items-center rounded-full bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setSearchType("person")}
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

        {/* Search Form */}
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
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="e.g. John"
                    value={fields.firstName}
                    onChange={handleFieldChange("firstName")}
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
                    onChange={handleFieldChange("lastName")}
                    disabled={loading}
                  />
                </div>

                {/* Personal Number */}
                <div className="space-y-2">
                  <Label htmlFor="personalNumber">
                    Personal / ID Number
                  </Label>
                  <Input
                    id="personalNumber"
                    placeholder="e.g. 8001011234"
                    value={fields.personalNumber}
                    onChange={handleFieldChange("personalNumber")}
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
                    onChange={handleFieldChange("dateOfBirth")}
                    disabled={loading}
                  />
                </div>

                {/* Nationality */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="nationality">Nationality / Country</Label>
                  <Select
                    value={fields.nationality}
                    onValueChange={(val) =>
                      setFields((prev) => ({ ...prev, nationality: val }))
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="nationality" className="sm:max-w-xs">
                      <SelectValue placeholder="Select a country…" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Inline search filter */}
                      <div className="px-2 py-1.5 sticky top-0 bg-popover z-10">
                        <Input
                          placeholder="Search country…"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
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
                      onClick={() => {
                        setFields((prev) => ({ ...prev, nationality: "" }));
                        setCountrySearch("");
                      }}
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
                  onClick={handleClear}
                  disabled={loading}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="isolate">
          <Card className="overflow-visible">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>
                    {(() => {
                      const shown = result.results?.length ?? 0;
                      const total = result.total?.value;
                      return (
                        <>
                          <span>
                            {shown} result{shown !== 1 ? "s" : ""} returned in results
                            {total !== undefined && total !== shown && (
                              <span className="text-muted-foreground/70"> (out of {total} expected)</span>
                            )}
                          </span>
                          {result.query && <span> for &ldquo;{result.query}&rdquo;</span>}
                        </>
                      );
                    })()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "table" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                  >
                    Table
                  </Button>
                  <Button
                    variant={viewMode === "json" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("json")}
                  >
                    JSON
                  </Button>
                  {viewMode === "json" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Clipboard className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className={viewMode === "table" ? "p-0 pt-0" : undefined}>
              {viewMode === "table" ? (
                <PersonResultTable
                  entities={result.results ?? []}
                  page={page}
                  totalResults={result.results?.length ?? 0}
                  onPageChange={handlePageChange}
                  loading={loading}
                />
              ) : (
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs mx-6 mb-6">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const PAGE_SIZE = 6;

interface PersonResultTableProps {
  entities: SearchResultEntity[];
  page: number;
  totalResults: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

function PersonResultTable({ entities, page, totalResults, onPageChange, loading }: PersonResultTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [orderedEntities, setOrderedEntities] = useState<SearchResultEntity[]>(entities);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Point scrollRef at the nearest scrollable ancestor (<main>)
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (tableRef.current) {
      const firstRow = tableRef.current.querySelector("tbody tr");
      if (firstRow) {
        const cells = firstRow.querySelectorAll("td");
        setColumnWidths(Array.from(cells).map((td) => td.getBoundingClientRect().width));
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
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleDragCancel = () => setActiveId(null);

  const lockXAxis: Modifier = useCallback(({ transform, draggingNodeRect }) => {
    if (!containerRef.current || !draggingNodeRect) return { ...transform, x: 0 };
    const containerRect = containerRef.current.getBoundingClientRect();
    const overlayTop = draggingNodeRect.top + transform.y;
    const overlayBottom = overlayTop + draggingNodeRect.height;
    let clampedY = transform.y;
    if (overlayTop < containerRect.top) clampedY = transform.y + (containerRect.top - overlayTop);
    if (overlayBottom > containerRect.bottom) clampedY = transform.y - (overlayBottom - containerRect.bottom);
    return { ...transform, x: 0, y: clampedY };
  }, []);

  const handleDragMove = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (el.scrollTop >= maxScroll) {
      el.scrollTop = maxScroll;
    }
  }, []);

  const activeEntity = activeId ? orderedEntities.find((e) => e.id === activeId) : null;

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
        autoScroll={{
          threshold: { x: 0, y: 0.1 },
          acceleration: 0.05,
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="border-t" ref={containerRef}>
          <Table ref={tableRef} wrapperClassName="relative w-full" className="border-separate border-spacing-0">
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className="!border-b-0 hover:!bg-transparent">
                <TableHead className="w-6 sticky top-0 z-10 bg-card" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border))" }} />
                <TableHead className="w-8 sticky top-0 z-10 bg-card" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border))" }} />
                <TableHead className="sticky top-0 z-10 bg-card" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border))" }}>Name</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border))" }}>Type</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border))" }}>Birth Date</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border))" }}>Nationality</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border))" }}>Topics / Sanctions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext items={entityIds} strategy={verticalListSortingStrategy}>
                {orderedEntities.map((entity) => (
                  <SortableRow
                    key={entity.id}
                    entity={entity}
                    isExpanded={expandedRows.has(entity.id)}
                    isDragging={activeId === entity.id}
                    toggleRow={toggleRow}
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
                width: columnWidths.length > 0 ? columnWidths.reduce((a, b) => a + b, 0) : undefined,
                tableLayout: "fixed",
                backgroundImage: "linear-gradient(rgba(34,197,94,0.18), rgba(34,197,94,0.18))",
              }}
            >
              {columnWidths.length > 0 && (
                <colgroup>
                  {columnWidths.map((w, i) => (<col key={i} style={{ width: w }} />))}
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
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalResults)} of {totalResults}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={page === 1 || loading}>«</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1 || loading}>‹</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-2">…</span>
                ) : (
                  <Button key={p} variant={page === p ? "default" : "outline"} size="sm" onClick={() => onPageChange(p as number)} disabled={loading} className="min-w-[32px]">{p}</Button>
                )
              )}
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page === totalPages || loading}>›</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(totalPages)} disabled={page === totalPages || loading}>»</Button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper: extract row display data from an entity
// ---------------------------------------------------------------------------

/** Map of ISO 3166-1 alpha-2 codes → full country names, built from COUNTRIES. */
const COUNTRY_CODE_MAP: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code.toLowerCase(), c.label])
);

/** Resolve a country string: if it looks like a 2-letter code, return the full name. */
function resolveCountryName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 2) {
    return COUNTRY_CODE_MAP[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
  }
  return trimmed;
}

/**
 * Priority order for properties displayed in the expanded row.
 * Lower number = shown first. Properties not listed get 1000 (shown last).
 *
 * Groups:
 *  1. Name / alias related
 *  2. Gender
 *  3. Birth date / birth place / birth country / citizenship
 *  4. Education
 *  5. Religion
 *  6. Everything else
 */
const PROP_ORDER: Record<string, number> = {
  // 1 – name / alias related
  name: 1,
  firstName: 2,
    middleName: 3,
  lastName: 4,
  secondName: 5,
  fatherName: 6,
  motherName: 7,
  maidenName: 8,
  alias: 9,
  weakAlias: 10,
  previousName: 11,
  title: 12,
  // 2 – gender
  gender: 13,
  // 3 – birth / place / citizenship
  birthDate: 14,
  birthPlace: 15,
  birthCountry: 16,
  placeOfBirth: 17,
  country: 18,
  nationality: 19,
  citizenship: 20,
  residency: 21,
  address: 22,
  addressEntity: 23,
  // 4 – education
  education: 24,
  // 5 – religion
  religion: 25,
  // topics go after all structured data
  topics: 26,
};

function getPropPriority(key: string): number {
  return PROP_ORDER[key] ?? 1000;
}

/** Human-readable labels for property keys. Falls back to the key itself. */
const PROP_LABELS: Record<string, string> = {
  alias: "Aliases",
  weakAlias: "Weak Aliases",
  previousName: "Previous Names",
  firstName: "First Name",
  lastName: "Last Name",
  secondName: "Second Name",
  middleName: "Middle Name",
  fatherName: "Father's Name",
  motherName: "Mother's Name",
  maidenName: "Maiden Name",
  title: "Title",
  gender: "Gender",
  birthDate: "Birth Date",
  birthPlace: "Birth Place",
  birthCountry: "Birth Country",
  placeOfBirth: "Place of Birth",
  country: "Country",
  nationality: "Nationality",
  citizenship: "Citizenship",
  residency: "Residency",
  address: "Address",
  addressEntity: "Address Entity",
  education: "Education",
  religion: "Religion",
  topics: "Topics / Sanctions",
};

function getEntityRowData(entity: SearchResultEntity) {
  const props = entity.properties ?? {};
  const displayName = entity.caption ?? props.name?.[0] ?? "Unknown";
  const aliases = props.alias ?? [];
  const birthDate = formatDate(props.birthDate?.[0] ?? "-");
  const rawCountries = props.country ?? props.nationality ?? [];
  // Resolve codes → full names and deduplicate
  const countries = [...new Set(rawCountries.map(resolveCountryName))];
  const topics = props.topics ?? [];

  // All properties sorted by priority for the expanded detail section.
  // Exclude "name" (shown as display name in the row header).
  const allDetailProps = Object.entries(props)
    .filter(([key]) => key !== "name")
    .sort(([a], [b]) => getPropPriority(a) - getPropPriority(b));

  const hasMore =
    aliases.length > 2 ||
    countries.length > 3 ||
    topics.length > 3 ||
    allDetailProps.length > 0;

  return { props, displayName, aliases, birthDate, countries, topics, allDetailProps, hasMore };
}

// ---------------------------------------------------------------------------
// Row cell contents
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
        onClick={onChevronClick ? (e) => { e.stopPropagation(); onChevronClick(); } : undefined}
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
              <span className="ml-1 text-primary">+{aliases.length - 2} more</span>
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
            <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
          ))}
          {countries.length > 3 && (
            <span className="text-xs text-muted-foreground">+{countries.length - 3}</span>
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
            <span className="text-xs text-muted-foreground">+{topics.length - 3}</span>
          )}
        </div>
      </TableCell>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sortable row
// ---------------------------------------------------------------------------
interface SortableRowProps {
  entity: SearchResultEntity;
  isExpanded: boolean;
  isDragging: boolean;
  toggleRow: (id: string) => void;
}

function SortableRow({ entity, isExpanded, isDragging, toggleRow }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isSorting,
  } = useSortable({ id: entity.id });

  const style: React.CSSProperties = {
    transform: transform ? `translateY(${Math.round(transform.y)}px)` : undefined,
    transition,
    ...(isDragging ? { visibility: "hidden" as const } : {}),
  };

  const { displayName, aliases, birthDate, countries, topics, allDetailProps, hasMore } =
    getEntityRowData(entity);

  return (
    <>
      <TableRow
        ref={setNodeRef}
        style={{
          ...style,
          ...(isExpanded ? { background: "hsl(var(--muted))", boxShadow: "inset 0 -1px 0 hsl(var(--border))" } : {}),
        }}
        className={`transition-colors ${hasMore && !isExpanded ? "cursor-pointer" : ""} ${isExpanded ? "bg-muted !border-b-0 hover:!bg-muted" : "hover:bg-muted/50"}`}
        onClick={() => { if (isSorting || isExpanded) return; if (hasMore) toggleRow(entity.id); }}
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
          onChevronClick={isExpanded ? () => toggleRow(entity.id) : undefined}
          gripProps={{
            onClick: (e) => e.stopPropagation(),
            ...attributes,
            ...listeners,
          }}
        />
      </TableRow>
      {isExpanded && hasMore && (
        <TableRow key={`${entity.id}-expanded`} className="hover:!bg-muted" style={{ background: "hsl(var(--muted))" }}>
          <TableCell />
          <TableCell />
          <TableCell colSpan={5} className="py-4 px-6">
            <div className="text-sm">
              {allDetailProps.map(([key, values], sectionIdx) => {
                const isCountryLike = ["country", "nationality", "birthCountry", "citizenship"].includes(key);
                const resolvedValues = isCountryLike
                  ? [...new Set((values as string[]).map(resolveCountryName))]
                  : (values as string[]);
                const label = PROP_LABELS[key] ?? key;
                return (
                  <div key={key} className="mb-4">
                    <p className="text-center font-semibold text-foreground mb-2 capitalize">{label}</p>
                    {resolvedValues.length === 1 && !isCountryLike && key !== "topics" ? (
                      <p className="text-center text-muted-foreground">{renderValue(resolvedValues[0])}</p>
                    ) : key === "topics" ? (
                      <div className="flex flex-wrap gap-2 justify-center">
                        {resolvedValues.map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t.replace("role.", "").replace("sanction", "sanctioned")}
                          </Badge>
                        ))}
                      </div>
                    ) : isCountryLike ? (
                      <div className="flex flex-wrap gap-2 justify-center">
                        {resolvedValues.map((c: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    ) : (
                      <ul className="list-disc ml-6 space-y-1">
                        {resolvedValues.map((v, i) => (
                          <li key={i} className="text-muted-foreground">{renderValue(v)}</li>
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
      )}
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

