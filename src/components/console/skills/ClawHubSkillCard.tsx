import { Download, CheckCircle, Clock, Star, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClawHubSearchResult, ClawHubSkillListItem } from "@/gateway/clawhub-client";

interface ClawHubSkillCardProps {
  item: ClawHubSearchResult | ClawHubSkillListItem;
  isInstalled: boolean;
  onInstall: (slug: string, displayName: string) => void;
  onOpenDetail: (slug: string) => void;
}

function isSearchResult(
  item: ClawHubSearchResult | ClawHubSkillListItem,
): item is ClawHubSearchResult {
  return "score" in item;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ClawHubSkillCard({
  item,
  isInstalled,
  onInstall,
  onOpenDetail,
}: ClawHubSkillCardProps) {
  const { t } = useTranslation("console");
  const slug = item.slug;
  const displayName = item.displayName;
  const summary = item.summary;
  const updatedAt = item.updatedAt;

  const version = isSearchResult(item) ? item.version : item.latestVersion?.version;
  const score = isSearchResult(item) ? item.score : null;
  const stats = !isSearchResult(item) ? item.stats : null;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/80 dark:hover:border-blue-600">
      <button
        type="button"
        onClick={() => onOpenDetail(slug)}
        className="absolute inset-0 rounded-2xl focus:outline-none"
        aria-label={displayName}
      />
      <div className="relative z-10 pointer-events-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </h3>
            {summary && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {summary}
              </p>
            )}
          </div>
          <div className="pointer-events-auto shrink-0">
            {isInstalled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                {t("skills.marketplace.installed")}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInstall(slug, displayName);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Download className="h-3 w-3" />
                {t("skills.card.install")}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {version && <span className="flex items-center gap-1">v{version}</span>}
          {updatedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(updatedAt)}
            </span>
          )}
          {score != null && (
            <span className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
              <TrendingUp className="h-3 w-3" />
              {score.toFixed(1)}
            </span>
          )}
          {stats && stats.downloads > 0 && (
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {stats.downloads.toLocaleString()}
            </span>
          )}
          {stats && stats.stars > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {stats.stars}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
