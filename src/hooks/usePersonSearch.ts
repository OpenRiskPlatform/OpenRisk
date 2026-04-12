/**
 * usePersonSearch – all state and business logic for the Person Search feature.
 */

import { FormEvent, useState } from "react";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useSettings } from "@/core/settings/SettingsContext";
import { COUNTRIES } from "@/constants/countries";
import {
  PersonSearchFields,
  SearchResult,
  SearchResultEntity,
  ScanHistoryEntry,
  FavoriteEntity,
  emptyFields,
  PAGE_SIZE,
} from "@/types/personSearch";

export function usePersonSearch() {
  const backendClient = useBackendClient();
  const { getPluginSettings } = useSettings();

  const [fields, setFields] = useState<PersonSearchFields>(emptyFields);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<"person" | "company">("person");
  const [adverseaEndpoints, setAdverseaEndpoints] = useState<string[]>([]);
  const [activeProjectDir, setActiveProjectDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [favoriteEntities, setFavoriteEntities] = useState<FavoriteEntity[]>([]);
  const [pluginTokens, setPluginTokens] = useState<Record<string, number>>({});
  const [pluginStats, setPluginStats] = useState<Record<string, { success: number; error: number }>>({});
  const [committedFields, setCommittedFields] = useState<PersonSearchFields | null>(null);

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
    setCommittedFields(null);
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
      if (fields.personalNumber.trim())
        inputs.personalNumber = fields.personalNumber.trim();
      if (fields.nationality.trim()) inputs.nationality = fields.nationality.trim();

      inputs.limit = String(PAGE_SIZE);
      inputs.offset = String((pageNumber - 1) * PAGE_SIZE);

      if (selectedPlugin === "adversea" && adverseaEndpoints.length > 0) {
        inputs.endpoints = adverseaEndpoints.join(",");
      }

      const response = await backendClient.executePlugin(
        selectedPlugin,
        inputs,
        settings
      );

      if (response.success) {
        const data = response.data as SearchResult;
        setResult(data);
        setPage(pageNumber);

        if (pageNumber === 1 && data.success !== false) {
          const tokensUsed =
            selectedPlugin === "adversea"
              ? Math.max(adverseaEndpoints.length, 1)
              : 1;
          setPluginTokens((prev) => ({
            ...prev,
            [selectedPlugin]: (prev[selectedPlugin] ?? 0) + tokensUsed,
          }));
        }

        if (pageNumber === 1) {
          // Track search stats
          const statKey = data.success !== false ? "success" : "error";
          setPluginStats((prev) => ({
            ...prev,
            [selectedPlugin]: {
              success: (prev[selectedPlugin]?.success ?? 0) + (statKey === "success" ? 1 : 0),
              error: (prev[selectedPlugin]?.error ?? 0) + (statKey === "error" ? 1 : 0),
            },
          }));
          const nameParts2 = [fields.firstName, fields.lastName]
            .map((s) => s.trim())
            .filter(Boolean);
          const query = nameParts2.join(" ") || fields.personalNumber || fields.dateOfBirth || fields.nationality;
          const entry: ScanHistoryEntry = {
            id: crypto.randomUUID(),
            query,
            fields: { ...fields },
            searchType,
            pluginId: selectedPlugin,
            result: data,
            timestamp: new Date(),
          };
          setScanHistory((prev) => [entry, ...prev]);
          setActiveHistoryId(entry.id);
        }
      } else {
        setError(response.error || "Plugin execution failed.");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  const runNewSearch = async () => {
    if (!hasAnyField) {
      setError("Please fill in at least one search field.");
      return;
    }
    setResult(null);
    setPage(1);
    setCommittedFields({ ...fields });
    await runSearch(1);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await runNewSearch();
  };

  const handlePageChange = async (newPage: number) => {
    await runSearch(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopyJson = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectHistory = (entry: ScanHistoryEntry) => {
    setResult(entry.result);
    setPage(1);
    setActiveHistoryId(entry.id);
    setFields(entry.fields);
    setCommittedFields(entry.fields);
    setSearchType(entry.searchType);
    if (entry.pluginId) setSelectedPlugin(entry.pluginId);
  };

  const handleClearHistory = () => {
    setScanHistory([]);
    setActiveHistoryId(null);
  };

  const handleDeleteHistory = (id: string) => {
    setScanHistory((prev) => prev.filter((e) => e.id !== id));
    if (activeHistoryId === id) setActiveHistoryId(null);
  };

  const handleUpdateHistoryOrder = (orderedEntities: SearchResultEntity[]) => {
    if (!activeHistoryId) return;
    setScanHistory((prev) =>
      prev.map((e) =>
        e.id === activeHistoryId
          ? { ...e, result: { ...e.result, results: orderedEntities } }
          : e
      )
    );
    setResult((prev) =>
      prev ? { ...prev, results: orderedEntities } : prev
    );
  };

  const handleToggleFavoriteEntity = (entity: SearchResultEntity) => {
    setFavoriteEntities((prev) => {
      const exists = prev.find((f) => f.entity.id === entity.id);
      if (exists) return prev.filter((f) => f.entity.id !== entity.id);
      const nameParts = [fields.firstName, fields.lastName].map((s) => s.trim()).filter(Boolean);
      const query = nameParts.join(" ") || fields.personalNumber || fields.dateOfBirth || fields.nationality;
      const entry: FavoriteEntity = {
        id: crypto.randomUUID(),
        entity,
        query,
        pluginId: selectedPlugin,
        savedAt: new Date(),
      };
      return [entry, ...prev];
    });
  };

  const handleRemoveFavoriteEntity = (favoriteId: string) => {
    setFavoriteEntities((prev) => prev.filter((f) => f.id !== favoriteId));
  };


  const isFavoriteEntity = (entityId: string) =>
    favoriteEntities.some((f) => f.entity.id === entityId);

  // Resets form fields and results when switching to a different plugin
  const setSelectedPluginAndReset = (pluginId: string | null) => {
    if (pluginId !== selectedPlugin) {
      setFields(emptyFields);
      setResult(null);
      setError(null);
      setPage(1);
      setCommittedFields(null);
      setCountrySearch("");
    }
    setSelectedPlugin(pluginId);
  };

  const resetSearchState = () => {
    setFields(emptyFields);
    setResult(null);
    setError(null);
    setPage(1);
    setCommittedFields(null);
    setScanHistory([]);
    setActiveHistoryId(null);
    setFavoriteEntities([]);
    setPluginTokens({});
    setPluginStats({});
    setAdverseaEndpoints([]);
    setCountrySearch("");
    setViewMode("table");
    // NOTE: activeProjectDir is intentionally NOT reset here —
    // switchProject manages it so we don't re-trigger on same-project navigation
  };

  const switchProject = (projectDir: string | undefined) => {
    if (projectDir && projectDir !== activeProjectDir) {
      resetSearchState();
      setActiveProjectDir(projectDir);
    }
  };

  return {
    fields,
    setFields,
    selectedPlugin,
    setSelectedPlugin: setSelectedPluginAndReset,
    searchType,
    setSearchType,
    adverseaEndpoints,
    setAdverseaEndpoints,
    countrySearch,
    setCountrySearch,
    filteredCountries,
    hasAnyField,
    loading,
    error,
    result,
    page,
    viewMode,
    setViewMode,
    copied,
    scanHistory,
    activeHistoryId,
    favoriteEntities,
    isFavoriteEntity,
    pluginTokens,
    pluginStats,
    committedFields,
    activeProjectDir,
    handleFieldChange,
    handleClear,
    handleSubmit,
    runNewSearch,
    handlePageChange,
    handleCopyJson,
    handleSelectHistory,
    handleClearHistory,
    handleDeleteHistory,
    handleUpdateHistoryOrder,
    handleToggleFavoriteEntity,
    handleRemoveFavoriteEntity,
    resetSearchState,
    switchProject,
  };
}
