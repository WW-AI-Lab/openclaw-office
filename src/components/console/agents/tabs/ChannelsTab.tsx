import { RefreshCw, Loader2, Info, Radio } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ChannelInfo, ChannelStatus } from "@/gateway/adapter-types";
import type { AgentSummary } from "@/gateway/types";
import { useAgentsStore } from "@/store/console-stores/agents-store";

interface ChannelsTabProps {
  agent: AgentSummary;
}

const STATUS_COLORS: Record<ChannelStatus, string> = {
  connected: "bg-green-500",
  disconnected: "bg-gray-400",
  connecting: "bg-yellow-500",
  error: "bg-red-500",
};

const CHANNEL_INITIALS: Record<string, string> = {
  telegram: "TG",
  discord: "DC",
  whatsapp: "WA",
  signal: "SG",
  feishu: "FS",
  imessage: "iM",
  matrix: "MX",
  line: "LN",
  msteams: "MS",
  googlechat: "GC",
  mattermost: "MM",
};

export function ChannelsTab({ agent }: ChannelsTabProps) {
  const { t } = useTranslation("console");
  const { agentChannels, agentChannelsLoading, fetchAgentChannels } = useAgentsStore();

  useEffect(() => {
    fetchAgentChannels();
  }, [agent.id, fetchAgentChannels]);

  const channels = agentChannels ?? [];

  if (agentChannelsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("agents.channels.title")}
        </h3>
        <button
          onClick={() => fetchAgentChannels()}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title={t("agents.refresh")}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {t("agents.channels.gatewayInfo")}
        </p>
      </div>

      {/* Channel cards */}
      {channels.length === 0 ? (
        <div className="py-8 text-center">
          <Radio className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t("agents.channels.noBindings")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelCard({ channel }: { channel: ChannelInfo }) {
  const { t } = useTranslation("console");
  const initial = CHANNEL_INITIALS[channel.type] ?? channel.type.slice(0, 2).toUpperCase();
  const statusColor = STATUS_COLORS[channel.status] ?? "bg-gray-400";
  const statusLabel = t(`agents.channels.${channel.status}`);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {channel.name || channel.type}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{statusLabel}</span>
            {channel.configured && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {t("agents.channels.configured")}
              </span>
            )}
          </div>
          {channel.error && (
            <p className="mt-1 text-xs text-red-500">{channel.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
