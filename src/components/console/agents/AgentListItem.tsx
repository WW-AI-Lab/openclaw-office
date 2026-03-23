import { Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentSummary } from "@/gateway/types";

interface AgentListItemProps {
  agent: AgentSummary;
  isSelected: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onViewHistory: () => void;
}

export function AgentListItem({
  agent,
  isSelected,
  isDefault,
  onSelect,
  onViewHistory,
}: AgentListItemProps) {
  const { t } = useTranslation("console");
  const displayName = agent.identity?.name ?? agent.name ?? agent.id;
  const emoji = agent.identity?.emoji;
  const avatarUrl = agent.identity?.avatarUrl;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl pr-2 transition-colors ${
        isSelected
          ? "border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-800">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <span>{emoji ?? displayName.charAt(0).toLowerCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {displayName}
            </span>
            {isDefault && (
              <span className="shrink-0 rounded-md bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {t("agents.defaultBadge")}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{agent.id}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onViewHistory();
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-blue-400"
        title={t("agents.viewSpeechHistory")}
      >
        <Clock3 className="h-4 w-4" />
      </button>
    </div>
  );
}
