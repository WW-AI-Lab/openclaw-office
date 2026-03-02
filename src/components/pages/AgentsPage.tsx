import { Bot } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AgentDetailHeader } from "@/components/console/agents/AgentDetailHeader";
import { AgentDetailTabs } from "@/components/console/agents/AgentDetailTabs";
import { AgentListPanel } from "@/components/console/agents/AgentListPanel";
import { CreateAgentDialog } from "@/components/console/agents/CreateAgentDialog";
import { DeleteAgentDialog } from "@/components/console/agents/DeleteAgentDialog";
import { useAgentsStore } from "@/store/console-stores/agents-store";

export function AgentsPage() {
  const { t } = useTranslation("console");
  const { selectedAgentId, agents, fetchAgents } = useAgentsStore();
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("agents.title")}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("agents.description")}</p>
      </div>

      <div className="flex gap-6">
        <AgentListPanel />

        <div className="min-w-0 flex-1">
          {selectedAgent ? (
            <div className="space-y-4">
              <AgentDetailHeader agent={selectedAgent} />
              <AgentDetailTabs agent={selectedAgent} />
            </div>
          ) : (
            <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <Bot className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("agents.selectAgent")}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {t("agents.selectAgentDesc")}
              </p>
            </div>
          )}
        </div>
      </div>

      <CreateAgentDialog />
      <DeleteAgentDialog />
    </div>
  );
}
