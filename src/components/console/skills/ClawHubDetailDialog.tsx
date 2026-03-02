import { X, Download, Star, User, ExternalLink, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useClawHubStore } from "@/store/console-stores/clawhub-store";

interface ClawHubDetailDialogProps {
  slug: string | null;
  onClose: () => void;
  onInstall: (slug: string, displayName: string) => void;
  isInstalled: boolean;
}

export function ClawHubDetailDialog({
  slug,
  onClose,
  onInstall,
  isInstalled,
}: ClawHubDetailDialogProps) {
  const { t } = useTranslation("console");
  const fetchDetail = useClawHubStore((s) => s.fetchDetail);
  const detail = useClawHubStore((s) => s.selectedDetail);
  const loading = useClawHubStore((s) => s.detailLoading);
  const clearDetail = useClawHubStore((s) => s.clearDetail);

  useEffect(() => {
    if (slug) fetchDetail(slug);
    return () => {
      clearDetail();
    };
  }, [slug, fetchDetail, clearDetail]);

  if (!slug) return null;

  const skill = detail?.skill;
  const version = detail?.latestVersion;
  const owner = detail?.owner;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : skill ? (
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {skill.displayName}
            </h2>
            {skill.summary && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{skill.summary}</p>
            )}

            {owner && owner.handle && (
              <div className="mt-3 flex items-center gap-2">
                {owner.image ? (
                  <img src={owner.image} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <User className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {owner.displayName ?? owner.handle}
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              {skill.stats.downloads > 0 && (
                <span className="flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {skill.stats.downloads.toLocaleString()} {t("clawhub.downloads")}
                </span>
              )}
              {skill.stats.stars > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  {skill.stats.stars} {t("clawhub.stars")}
                </span>
              )}
            </div>

            {version && (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    v{version.version}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(version.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {version.changelog && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
                    {version.changelog}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              {isInstalled ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {t("skills.marketplace.installed")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onInstall(skill.slug, skill.displayName)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  {t("skills.card.install")}
                </button>
              )}
              <a
                href={`https://clawhub.ai/skills/${skill.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("clawhub.viewOnClawHub")}
              </a>
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-500">
            {t("clawhub.notFound")}
          </div>
        )}
      </div>
    </div>
  );
}
