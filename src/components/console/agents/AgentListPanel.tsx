import { RefreshCw, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentsStore } from "@/store/console-stores/agents-store";
import { AgentListItem } from "./AgentListItem";

export function AgentListPanel() {
  const { t } = useTranslation("console");
  const {
    agents,
    isLoading,
    selectedAgentId,
    searchQuery,
    defaultAgentId,
    fetchAgents,
    selectAgent,
    setSearchQuery,
    setCreateDialogOpen,
  } = useAgentsStore();

  const filteredAgents = agents.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (a.identity?.name ?? a.name ?? a.id).toLowerCase();
    return name.includes(q) || a.id.toLowerCase().includes(q);
  });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("agents.panelTitle")}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("agents.configured", { count: agents.length })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            title={t("agents.addAgent")}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => fetchAgents()}
            disabled={isLoading}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            title={t("agents.refresh")}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("agents.searchPlaceholder")}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-2">
        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("agents.noAgents")}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAgents.map((agent) => (
              <AgentListItem
                key={agent.id}
                agent={agent}
                isSelected={selectedAgentId === agent.id}
                isDefault={agent.id === defaultAgentId}
                onSelect={() => selectAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
