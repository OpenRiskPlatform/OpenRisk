/**
 * Person Search Page - Search for persons by name, surname, personal number, etc.
 */

import { FormEvent, useState } from "react";
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
import { Loader2, Search, UserSearch, X } from "lucide-react";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useSettings } from "@/core/settings/SettingsContext";
import { usePlugins } from "@/hooks/usePlugins";
import { InstalledPlugin } from "@/core/plugin-system/types";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

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
  };

  const hasAnyField = Object.values(fields).some((v) => v.trim() !== "");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedPlugin) {
      setError("Please select a plugin to run the search.");
      return;
    }

    if (!hasAnyField) {
      setError("Please fill in at least one search field.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const settings = getPluginSettings(selectedPlugin);

      // Build inputs mapped to the plugin's expected field names
      const inputs: Record<string, string> = {};

      // OpenSanctions expects a single "name" field
      const nameParts = [fields.firstName, fields.lastName]
        .map((s) => s.trim())
        .filter(Boolean);
      if (nameParts.length > 0) inputs.name = nameParts.join(" ");

      // OpenSanctions accepts "age" (birth year or full date)
      if (fields.dateOfBirth.trim()) inputs.age = fields.dateOfBirth.trim();

      // Extra fields passed through for plugins that support them
      if (fields.personalNumber.trim()) inputs.personalNumber = fields.personalNumber.trim();
      if (fields.nationality.trim())    inputs.nationality    = fields.nationality.trim();

      const response = await backendClient.executePlugin(
        selectedPlugin,
        inputs,
        settings
      );

      if (response.success) {
        setResult(response.data as SearchResult);
      } else {
        setError(response.error || "Plugin execution failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
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

        {/* Search Form */}
        <Card>
          <CardHeader>
            <CardTitle>Search Criteria</CardTitle>
            <CardDescription>
              Fill in one or more fields to search for a person. All provided
              fields will be used to narrow the results.
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
                    type="date"
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>
                    {result.total?.value !== undefined
                      ? `${result.total.value} match${result.total.value !== 1 ? "es" : ""} found`
                      : "Results returned"}
                    {result.query ? ` for "${result.query}"` : ""}
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
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "table" ? (
                <PersonResultTable entities={result.results ?? []} />
              ) : (
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PersonResultTable({ entities }: { entities: SearchResultEntity[] }) {
  if (entities.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <UserSearch className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p>No results found for the given criteria.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Birth Date</TableHead>
            <TableHead>Nationality</TableHead>
            <TableHead>Topics / Sanctions</TableHead>
            <TableHead>Datasets</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entities.map((entity) => {
            const props = entity.properties ?? {};
            const displayName =
              entity.caption ?? props.name?.[0] ?? "Unknown";
            const aliases = props.alias ?? [];
            const birthDate = props.birthDate?.[0] ?? "-";
            const countries = props.country ?? props.nationality ?? [];
            const topics = props.topics ?? [];
            const datasets = entity.datasets ?? [];

            return (
              <TableRow key={entity.id}>
                <TableCell className="font-medium">
                  <div>{displayName}</div>
                  {aliases.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      aka: {aliases.slice(0, 2).join(", ")}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{entity.schema ?? "Unknown"}</Badge>
                </TableCell>
                <TableCell className="text-sm">{birthDate}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {countries.slice(0, 3).map((c: string) => (
                      <Badge key={c} variant="outline" className="text-xs">
                        {c.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {topics.slice(0, 3).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t
                          .replace("role.", "")
                          .replace("sanction", "sanctioned")}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {datasets.slice(0, 2).join(", ")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
