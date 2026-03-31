/**
 * Utility functions for the Person Search feature.
 */

import { ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { COUNTRY_CODE_MAP } from "@/constants/countries";
import { SearchResultEntity } from "@/types/personSearch";

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Converts a date string in various formats to DD.MM.YYYY
 * (or DD.MM.YYYY HH:MM for datetimes).
 * Handles: YYYY-MM-DDThh:mm:ss[.ms]Z, YYYY-MM-DD, YYYY-MM, YYYY.
 * If the value doesn't match a known pattern it is returned as-is.
 */
export function formatDate(value: string): string {
  if (!value || value === "-") return value;

  // ISO 8601 datetime: YYYY-MM-DDThh:mm:ss[.sss][Z or ±hh:mm]
  const isoDateTime = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoDateTime)
    return `${isoDateTime[3]}.${isoDateTime[2]}.${isoDateTime[1]} ${isoDateTime[4]}:${isoDateTime[5]}`;

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

// ---------------------------------------------------------------------------
// URL detection & rendering
// ---------------------------------------------------------------------------

/** Returns true if the string looks like an http/https URL. */
export function isUrl(value: string): boolean {
  try {
    return new URL(value).protocol.startsWith("http");
  } catch {
    return false;
  }
}

/** Renders a value as a clickable link if it's a URL, otherwise formats as date. */
export function renderValue(value: string): ReactNode {
  if (isUrl(value)) {
    return (
      <button
        type="button"
        className="text-primary underline underline-offset-2 hover:opacity-80 break-all text-left"
        onClick={(e) => {
          e.stopPropagation();
          open(value);
        }}
      >
        {value}
      </button>
    );
  }
  return formatDate(value);
}

// ---------------------------------------------------------------------------
// Country resolution
// ---------------------------------------------------------------------------

/** Resolve a country string: if it looks like a 2-letter code, return the full name. */
export function resolveCountryName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 2) {
    return COUNTRY_CODE_MAP[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Property ordering & labels
// ---------------------------------------------------------------------------

/**
 * Priority order for properties displayed in the expanded row.
 * Lower number = shown first. Properties not listed get 1000 (shown last).
 */
export const PROP_ORDER: Record<string, number> = {
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

export function getPropPriority(key: string): number {
  return PROP_ORDER[key] ?? 1000;
}

/** Human-readable labels for property keys. Falls back to the key itself. */
export const PROP_LABELS: Record<string, string> = {
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

// ---------------------------------------------------------------------------
// Row data extraction
// ---------------------------------------------------------------------------

export function getEntityRowData(entity: SearchResultEntity) {
  const props = entity.properties ?? {};
  const displayName = entity.caption ?? props.name?.[0] ?? "Unknown";
  const aliases = props.alias ?? [];
  const birthDate = formatDate(props.birthDate?.[0] ?? "-");
  const rawCountries = props.country ?? props.nationality ?? [];
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
