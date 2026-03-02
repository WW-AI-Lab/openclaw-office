import { Check, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChannelInfo, ChannelType } from "@/gateway/adapter-types";
import { ALL_CHANNEL_TYPES, CHANNEL_SCHEMAS } from "@/lib/channel-schemas";

interface AvailableChannelGridProps {
  channels: ChannelInfo[];
  onSelect: (channelType: ChannelType) => void;
}

export function AvailableChannelGrid({ channels, onSelect }: AvailableChannelGridProps) {
  const { t } = useTranslation("console");
  const configuredTypes = new Set(channels.map((c) => c.type));

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("channels.available.title")}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {ALL_CHANNEL_TYPES.map((type) => {
          const schema = CHANNEL_SCHEMAS[type];
          const isConfigured = configuredTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/10"
            >
              <span className="text-2xl">{schema.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t(schema.nameKey)}
              </span>
              {isConfigured ? (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <Check className="h-3 w-3" />
                  {t("channels.available.configured")}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  <Plus className="h-3 w-3" />
                  {t("channels.available.add")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
