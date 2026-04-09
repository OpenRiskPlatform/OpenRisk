/**
 * Shared TypeScript types for the Person Search feature.
 */

export interface PersonSearchFields {
  firstName: string;
  lastName: string;
  personalNumber: string;
  dateOfBirth: string;
  nationality: string;
}

export interface SearchResultEntity {
  id: string;
  schema: string;
  caption?: string;
  properties: Record<string, string[]>;
  datasets?: string[];
  target?: boolean;
}

export interface SearchResult {
  success: boolean;
  query: string;
  error?: string;
  total?: { value: number; relation: string };
  results?: SearchResultEntity[];
  timestamp?: string;
  logs?: string[];
}

export const emptyFields: PersonSearchFields = {
  firstName: "",
  lastName: "",
  personalNumber: "",
  dateOfBirth: "",
  nationality: "",
};

export const PAGE_SIZE = 6;

export interface ScanHistoryEntry {
  id: string;
  query: string;
  fields: PersonSearchFields;
  searchType: "person" | "company";
  pluginId: string | null;
  result: SearchResult;
  timestamp: Date;
}

export interface FavoriteEntity {
  id: string;
  entity: SearchResultEntity;
  query: string;
  pluginId: string | null;
  savedAt: Date;
}

