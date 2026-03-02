import { useTranslation } from "react-i18next";
import type { CronTask } from "@/gateway/adapter-types";

interface CronStatsBarProps {
  tasks: CronTask[];
}

export function CronStatsBar({ tasks }: CronStatsBarProps) {
  const { t } = useTranslation("console");
  const active = tasks.filter((t) => t.enabled && t.state.lastRunStatus !== "error").length;
  const paused = tasks.filter((t) => !t.enabled).length;
  const failed = tasks.filter((t) => t.state.lastRunStatus === "error").length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-gray-500 dark:text-gray-400">
        {t("cron.stats.total")}{" "}
        <strong className="text-gray-900 dark:text-gray-100">{tasks.length}</strong>
      </span>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <span className="text-green-600 dark:text-green-400">
        {t("cron.stats.active")} <strong>{active}</strong>
      </span>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <span className="text-gray-500 dark:text-gray-400">
        {t("cron.stats.paused")} <strong>{paused}</strong>
      </span>
      {failed > 0 && (
        <>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-red-600 dark:text-red-400">
            {t("cron.stats.failed")} <strong>{failed}</strong>
          </span>
        </>
      )}
    </div>
  );
}
