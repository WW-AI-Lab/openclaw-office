import { useTranslation } from "react-i18next";
import type { ChannelInfo } from "@/gateway/adapter-types";

interface ChannelStatsBarProps {
  channels: ChannelInfo[];
}

export function ChannelStatsBar({ channels }: ChannelStatsBarProps) {
  const { t } = useTranslation("console");
  const connected = channels.filter((c) => c.status === "connected").length;
  const errors = channels.filter((c) => c.status === "error").length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-gray-500 dark:text-gray-400">
        {t("channels.stats.total")}{" "}
        <strong className="text-gray-900 dark:text-gray-100">{channels.length}</strong>
      </span>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <span className="text-green-600 dark:text-green-400">
        {t("channels.stats.connected")} <strong>{connected}</strong>
      </span>
      {errors > 0 && (
        <>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-red-600 dark:text-red-400">
            {t("channels.stats.errors")} <strong>{errors}</strong>
          </span>
        </>
      )}
    </div>
  );
}
