import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/console/shared/StatusBadge";
import type { ChannelInfo } from "@/gateway/adapter-types";

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "📱",
  telegram: "✈️",
  discord: "🎮",
  signal: "🔒",
  feishu: "🐦",
  imessage: "💬",
  matrix: "🔗",
  line: "🟢",
  msteams: "👔",
  googlechat: "💭",
  mattermost: "💠",
};

interface ChannelOverviewProps {
  channels: ChannelInfo[];
}

export function ChannelOverview({ channels }: ChannelOverviewProps) {
  const { t } = useTranslation("console");
  const connected = channels.filter((c) => c.status === "connected");

  if (connected.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("dashboard.channelOverview.title")}
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Radio className="h-4 w-4" />
          <span>{t("dashboard.channelOverview.empty")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("dashboard.channelOverview.title")}
      </h3>
      <div className="flex flex-wrap gap-3">
        {connected.map((ch) => (
          <div
            key={ch.id}
            className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 dark:bg-gray-700/50"
          >
            <span className="text-base">{CHANNEL_ICONS[ch.type] ?? "📡"}</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{ch.name}</span>
            <StatusBadge status={ch.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
