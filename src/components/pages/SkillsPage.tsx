import {
  AlertCircle,
  RefreshCw,
  Package,
  Search,
  ShieldCheck,
  X,
  WifiOff,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/console/shared/EmptyState";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { LoadingState } from "@/components/console/shared/LoadingState";
import { ClawHubDetailDialog } from "@/components/console/skills/ClawHubDetailDialog";
import { ClawHubInstallDialog } from "@/components/console/skills/ClawHubInstallDialog";
import { ClawHubSkillCard } from "@/components/console/skills/ClawHubSkillCard";
import { InstallOptionsDialog } from "@/components/console/skills/InstallOptionsDialog";
import { SkillCard } from "@/components/console/skills/SkillCard";
import { SkillDetailDialog } from "@/components/console/skills/SkillDetailDialog";
import { SkillTabBar } from "@/components/console/skills/SkillTabBar";
import type { SkillInfo } from "@/gateway/adapter-types";
import { useClawHubStore } from "@/store/console-stores/clawhub-store";
import { useSkillsStore } from "@/store/console-stores/skills-store";
import {
  filterInstalledSkills,
  filterMarketplaceSkills,
  getInstalledSkillIds,
} from "@/store/console-stores/skills-store";

export function SkillsPage() {
  const { t } = useTranslation("console");
  const {
    skills,
    isLoading,
    error,
    activeTab,
    sourceFilter,
    selectedSkill,
    detailDialogOpen,
    installing,
    fetchSkills,
    setTab,
    setSourceFilter,
    openDetail,
    closeDetail,
    toggleSkill,
    installSkill,
  } = useSkillsStore();

  const {
    searchResults,
    exploreItems,
    searchQuery,
    isSearching,
    isExploring,
    searchError,
    exploreError,
    nextCursor,
    offlineMode,
    search,
    searchImmediate,
    explore,
    clearSearch,
  } = useClawHubStore();

  const [installTarget, setInstallTarget] = useState<SkillInfo | null>(null);
  const [installedQuery, setInstalledQuery] = useState("");

  // ClawHub install dialog state
  const [clawhubInstall, setClawhubInstall] = useState<{
    slug: string;
    displayName: string;
  } | null>(null);
  // ClawHub detail dialog
  const [clawhubDetailSlug, setClawhubDetailSlug] = useState<string | null>(null);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Load ClawHub explore data when marketplace tab is active
  useEffect(() => {
    if (activeTab === "marketplace" && exploreItems.length === 0 && !offlineMode) {
      explore();
    }
  }, [activeTab, exploreItems.length, offlineMode, explore]);

  const installedSkills = useMemo(
    () => filterInstalledSkills(skills, installedQuery, sourceFilter),
    [skills, installedQuery, sourceFilter],
  );

  const localMarketplaceSkills = useMemo(
    () => filterMarketplaceSkills(skills, searchQuery),
    [skills, searchQuery],
  );

  const installedSlugs = useMemo(() => getInstalledSkillIds(skills), [skills]);

  const sourceStats = useMemo(
    () => ({
      all: skills.filter((skill) => skill.isBundled || skill.eligible).length,
      "built-in": skills.filter((skill) => skill.isBundled).length,
      marketplace: skills.filter((skill) => !skill.isBundled).length,
    }),
    [skills],
  );

  const handleInstall = (skill: SkillInfo) => {
    if (skill.installOptions && skill.installOptions.length > 1) {
      setInstallTarget(skill);
    } else if (skill.installOptions && skill.installOptions.length === 1) {
      installSkill(skill.id, skill.installOptions[0].id);
    }
  };

  const handleInstallSelect = async (installId: string) => {
    if (installTarget) {
      await installSkill(installTarget.id, installId);
      setInstallTarget(null);
    }
  };

  const handleClawHubInstall = useCallback((slug: string, displayName: string) => {
    setClawhubInstall({ slug, displayName });
  }, []);

  const handleClawHubInstallDone = useCallback(() => {
    setClawhubInstall(null);
    fetchSkills();
  }, [fetchSkills]);

  const handleMarketplaceSearch = useCallback(
    (value: string) => {
      search(value);
    },
    [search],
  );

  const handleSearchButton = useCallback(() => {
    if (searchQuery.trim()) {
      searchImmediate(searchQuery);
    }
  }, [searchQuery, searchImmediate]);

  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  const showSearchResults = searchQuery.trim().length > 0;
  const marketplaceError = searchError || exploreError;

  if (isLoading && skills.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("skills.title")}
          description={t("skills.description")}
          onRefresh={fetchSkills}
        />
        <LoadingState />
      </div>
    );
  }

  if (error && skills.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("skills.title")}
          description={t("skills.description")}
          onRefresh={fetchSkills}
        />
        <ErrorState message={error} onRetry={fetchSkills} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("skills.title")}
        description={t("skills.description")}
        onRefresh={fetchSkills}
        loading={isLoading}
      />

      <SkillTabBar activeTab={activeTab} onTabChange={setTab} />

      {activeTab === "installed" ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={installedQuery}
                onChange={(event) => setInstalledQuery(event.target.value)}
                placeholder={t("skills.installed.searchPlaceholder")}
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "built-in", "marketplace"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSourceFilter(filter)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${sourceFilter === filter ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"}`}
                >
                  {t(`skills.filters.${filter}`, { count: sourceStats[filter] })}
                </button>
              ))}
            </div>
          </div>

          {installedSkills.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t("skills.empty.title")}
              description={t("skills.empty.description")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {installedSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onToggle={toggleSkill}
                  onConfigure={openDetail}
                  onInstall={handleInstall}
                  isInstalling={installing.has(skill.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          {/* Security note */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-gray-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("skills.marketplace.securityNote")}
              </p>
            </div>
          </div>

          {/* Offline banner */}
          {offlineMode && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-900/20">
              <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                <WifiOff className="h-4 w-4" />
                {t("clawhub.offlineNotice")}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleMarketplaceSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchButton()}
                placeholder={t("clawhub.searchPlaceholder")}
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearchButton}
              disabled={isSearching || !searchQuery.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                t("skills.marketplace.searchButton")
              )}
            </button>
          </div>

          {/* Error */}
          {marketplaceError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {marketplaceError}
              </div>
            </div>
          )}

          {/* Results */}
          {offlineMode ? (
            // Offline: show local marketplace skills
            localMarketplaceSkills.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t("skills.marketplace.emptyTitle")}
                description={t("skills.marketplace.emptyDescription")}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {localMarketplaceSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onToggle={toggleSkill}
                    onConfigure={openDetail}
                    onInstall={handleInstall}
                    isInstalling={installing.has(skill.id)}
                  />
                ))}
              </div>
            )
          ) : showSearchResults ? (
            // Search results from ClawHub
            isSearching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : searchResults.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t("clawhub.noSearchResults")}
                description={t("clawhub.tryDifferentQuery")}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {searchResults.map((item) => (
                  <ClawHubSkillCard
                    key={item.slug}
                    item={item}
                    isInstalled={installedSlugs.has(item.slug)}
                    onInstall={handleClawHubInstall}
                    onOpenDetail={(slug) => setClawhubDetailSlug(slug)}
                  />
                ))}
              </div>
            )
          ) : (
            // Browse latest from ClawHub
            <>
              {isExploring && exploreItems.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : exploreItems.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={t("clawhub.noSkills")}
                  description={t("clawhub.noSkillsDescription")}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {exploreItems.map((item) => (
                      <ClawHubSkillCard
                        key={item.slug}
                        item={item}
                        isInstalled={installedSlugs.has(item.slug)}
                        onInstall={handleClawHubInstall}
                        onOpenDetail={(slug) => setClawhubDetailSlug(slug)}
                      />
                    ))}
                  </div>
                  {nextCursor && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => explore(true)}
                        disabled={isExploring}
                        className="rounded-xl border border-gray-300 px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        {isExploring ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          t("clawhub.loadMore")
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Existing dialogs */}
      <SkillDetailDialog
        open={detailDialogOpen}
        skill={selectedSkill}
        onClose={closeDetail}
        onSaved={fetchSkills}
      />

      <InstallOptionsDialog
        open={installTarget !== null}
        skillName={installTarget?.name ?? ""}
        options={installTarget?.installOptions ?? []}
        onSelect={handleInstallSelect}
        onCancel={() => setInstallTarget(null)}
      />

      {/* ClawHub dialogs */}
      <ClawHubDetailDialog
        slug={clawhubDetailSlug}
        onClose={() => setClawhubDetailSlug(null)}
        onInstall={handleClawHubInstall}
        isInstalled={clawhubDetailSlug ? installedSlugs.has(clawhubDetailSlug) : false}
      />

      <ClawHubInstallDialog
        open={clawhubInstall !== null}
        slug={clawhubInstall?.slug ?? ""}
        displayName={clawhubInstall?.displayName ?? ""}
        onClose={() => setClawhubInstall(null)}
        onConfirmDone={handleClawHubInstallDone}
      />
    </div>
  );
}

function PageHeader({
  title,
  description,
  onRefresh,
  loading,
}: {
  title: string;
  description: string;
  onRefresh: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {t("actions.refresh")}
      </button>
    </div>
  );
}
