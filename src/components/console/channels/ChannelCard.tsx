import { LogOut, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/console/shared/StatusBadge";
import type { ChannelInfo } from "@/gateway/adapter-types";
import { CHANNEL_SCHEMAS } from "@/lib/channel-schemas";

interface ChannelCardProps {
  channel: ChannelInfo;
  onLogout: (channel: ChannelInfo) => void;
  onDetail: (channel: ChannelInfo) => void;
}

const BORDER_COLORS: Record<string, string> = {
  connected: "border-l-green-500",
  error: "border-l-red-500",
  connecting: "border-l-yellow-500",
  disconnected: "border-l-gray-300 dark:border-l-gray-600",
};

export function ChannelCard({ channel, onLogout, onDetail }: ChannelCardProps) {
  const { t } = useTranslation("console");
  const schema = CHANNEL_SCHEMAS[channel.type];
  const borderColor = BORDER_COLORS[channel.status] ?? "border-l-gray-300";

  const lastConnected = channel.lastConnectedAt
    ? new Date(channel.lastConnectedAt).toLocaleString()
    : null;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-l-4 bg-white p-4 dark:bg-gray-800 ${borderColor} border-gray-200 dark:border-gray-700`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{schema?.icon ?? "📡"}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{channel.name}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {channel.type}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <StatusBadge status={channel.status} />
            {lastConnected && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t("channels.card.lastConnected", { time: lastConnected })}
              </span>
            )}
          </div>
          {channel.error && <p className="mt-1 text-xs text-red-500">{channel.error}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDetail(channel)}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
          title={t("channels.card.details")}
        >
          <Info className="h-4 w-4" />
        </button>
        {channel.status === "connected" && (
          <button
            type="button"
            onClick={() => onLogout(channel)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            title={t("channels.card.logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
