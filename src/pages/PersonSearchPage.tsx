/**
 * Person Search Page – orchestrates sub-components and the usePersonSearch hook.
 * All business logic lives in hooks/usePersonSearch.ts.
 * All UI building blocks live in components/personSearch/.
 */

import { UserSearch } from "lucide-react";
import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePlugins } from "@/hooks/usePlugins";
import { usePersonSearchContext } from "@/core/personSearch/PersonSearchContext";
import { PluginSelector } from "@/components/personSearch/PluginSelector";
import { AdverseaEndpointSelector } from "@/components/personSearch/AdverseaEndpointSelector";
import { PersonSearchForm } from "@/components/personSearch/PersonSearchForm";
import { SearchResultsPanel } from "@/components/personSearch/SearchResultsPanel";
import { ScanHistorySidebar } from "@/components/personSearch/ScanHistorySidebar";

export function PersonSearchPage() {
  const { installedPlugins } = usePlugins();

  const {
    fields,
    setFields,
    selectedPlugin,
    setSelectedPlugin,
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
    // plugin token usage
    pluginTokens,
    committedFields,
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
  } = usePersonSearchContext();

  const favoriteEntityIds = new Set(favoriteEntities.map((f: any) => f.entity.id));
  const isFormDisabled = selectedPlugin === "adversea" && adverseaEndpoints.length === 0;
  const [formHovered, setFormHovered] = useState(false);

  const handleSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runNewSearch();
  };

  return (
    <MainLayout>
      <div className="flex h-full min-h-0">
        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
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

            <PluginSelector
              installedPlugins={installedPlugins}
              selectedPlugin={selectedPlugin}
              pluginTokens={pluginTokens}
              onSelect={setSelectedPlugin}
            />

            {selectedPlugin === "adversea" && (
              <AdverseaEndpointSelector
                selected={adverseaEndpoints}
                onChange={(next) => {
                  if (next.length < adverseaEndpoints.length) handleClear();
                  setAdverseaEndpoints(next);
                }}
                highlighted={formHovered && isFormDisabled}
              />
            )}

            <PersonSearchForm
              fields={fields}
              searchType="person"
              loading={loading}
              error={error}
              hasAnyField={hasAnyField}
              disabled={isFormDisabled}
              onHoverChange={isFormDisabled ? setFormHovered : undefined}
              countrySearch={countrySearch}
              filteredCountries={filteredCountries}
              onFieldChange={handleFieldChange}
              onNationalityChange={(val) => setFields((prev) => ({ ...prev, nationality: val }))}
              onCountrySearchChange={setCountrySearch}
              onClearNationality={() => { setFields((prev) => ({ ...prev, nationality: "" })); setCountrySearch(""); }}
              onSubmit={handleSubmitForm}
              onClear={handleClear}
            />

            {result && (
              <SearchResultsPanel
                result={result}
                page={page}
                loading={loading}
                viewMode={viewMode}
                copied={copied}
                searchFields={committedFields ?? undefined}
                favoriteEntityIds={favoriteEntityIds}
                onToggleFavorite={handleToggleFavoriteEntity}
                onReorder={handleUpdateHistoryOrder}
                onViewModeChange={setViewMode}
                onPageChange={handlePageChange}
                onCopyJson={handleCopyJson}
              />
            )}
          </div>
        </div>

        {/* Scan history sidebar */}
        <ScanHistorySidebar
          entries={scanHistory}
          activeId={activeHistoryId}
          favoriteEntities={favoriteEntities}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
          onRemoveFavorite={handleRemoveFavoriteEntity}
          onClear={handleClearHistory}
        />
      </div>
    </MainLayout>
  );
}
