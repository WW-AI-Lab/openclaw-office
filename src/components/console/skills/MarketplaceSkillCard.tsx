import { ExternalLink, Download, CheckCircle2, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SkillInfo } from "@/gateway/adapter-types";

interface MarketplaceSkillCardProps {
  skill: SkillInfo;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (skill: SkillInfo) => void;
  onOpenDetail: (skill: SkillInfo) => void;
}

export function MarketplaceSkillCard({
  skill,
  isInstalled,
  isInstalling,
  onInstall,
  onOpenDetail,
}: MarketplaceSkillCardProps) {
  const { t } = useTranslation("console");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-700">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onOpenDetail(skill)}
          className="flex min-w-0 flex-1 items-start gap-4 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-2xl dark:bg-blue-900/20">
            {skill.icon || "📦"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {skill.name}
              </h3>
              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {t("skills.source.marketplace")}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
              {skill.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span>{t("skills.marketplace.version", { version: skill.version || "—" })}</span>
              {skill.author && (
                <span>{t("skills.marketplace.author", { author: skill.author })}</span>
              )}
              {skill.homepage && (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("skills.marketplace.learnMore")}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenDetail(skill)}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title={t("skills.card.configure")}
          >
            <ExternalLink className="h-4 w-4" />
          </button>

          {isInstalled ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              {t("skills.marketplace.installed")}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onInstall(skill)}
              disabled={isInstalling || !skill.installOptions?.length}
              className="inline-flex min-w-24 items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isInstalling ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {t("skills.card.installing")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t("skills.card.install")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
