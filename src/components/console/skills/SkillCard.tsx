import { AlertTriangle, Globe, Lock, Puzzle, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SkillInfo } from "@/gateway/adapter-types";

interface SkillCardProps {
  skill: SkillInfo;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onConfigure: (skill: SkillInfo) => void;
  isInstalling?: boolean;
  onInstall?: (skill: SkillInfo) => void;
}

export function SkillCard({
  skill,
  onToggle,
  onConfigure,
  isInstalling,
  onInstall,
}: SkillCardProps) {
  const { t } = useTranslation("console");

  const isCoreLocked = skill.isCore && skill.always;
  const hasMissing = skill.missing?.bins?.length || skill.missing?.env?.length;
  const sourceLabel = skill.isBundled ? t("skills.source.builtIn") : t("skills.source.marketplace");

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors dark:bg-gray-800 ${skill.enabled ? "border-blue-200 bg-blue-50/40 dark:border-blue-900/40" : "border-gray-200 bg-white opacity-75 dark:border-gray-700"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onConfigure(skill)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="text-2xl">{skill.icon || "📦"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{skill.name}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${skill.isBundled ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}
              >
                {sourceLabel}
              </span>
              {skill.isCore ? (
                <Lock className="h-3.5 w-3.5 text-gray-400" />
              ) : skill.isBundled ? (
                <Puzzle className="h-3.5 w-3.5 text-blue-500/70" />
              ) : (
                <Globe className="h-3.5 w-3.5 text-purple-500/70" />
              )}
              {skill.version && <span className="text-[10px] text-gray-400">v{skill.version}</span>}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
              {skill.description}
            </p>
            {hasMissing && (
              <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("skills.card.missingDeps")}
              </div>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onConfigure(skill)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
            title={t("skills.card.configure")}
          >
            <Settings className="h-4 w-4" />
          </button>

          {!skill.eligible && onInstall && (
            <button
              type="button"
              onClick={() => onInstall(skill)}
              disabled={isInstalling}
              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isInstalling ? t("skills.card.installing") : t("skills.card.install")}
            </button>
          )}

          <label
            className="relative inline-flex cursor-pointer items-center"
            title={isCoreLocked ? t("skills.card.coreProtected") : undefined}
          >
            <input
              type="checkbox"
              checked={skill.enabled}
              onChange={() => onToggle(skill.id, !skill.enabled)}
              disabled={isCoreLocked}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-gray-700 dark:peer-checked:bg-blue-500" />
          </label>
        </div>
      </div>
    </div>
  );
}
