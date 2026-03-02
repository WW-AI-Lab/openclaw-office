import { Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SkillInfo } from "@/gateway/adapter-types";

interface SkillOverviewProps {
  skills: SkillInfo[];
}

export function SkillOverview({ skills }: SkillOverviewProps) {
  const { t } = useTranslation("console");
  const enabled = skills.filter((s) => s.enabled);

  if (enabled.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("dashboard.skillOverview.title")}
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Wrench className="h-4 w-4" />
          <span>{t("dashboard.skillOverview.empty")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("dashboard.skillOverview.title")}
      </h3>
      <div className="flex flex-wrap gap-3">
        {enabled.map((sk) => (
          <div
            key={sk.id}
            className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 dark:bg-gray-700/50"
          >
            <span className="text-base">{sk.icon || "📦"}</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{sk.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
