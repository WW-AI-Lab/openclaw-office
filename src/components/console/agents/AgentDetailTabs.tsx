import { useTranslation } from "react-i18next";
import type { AgentSummary } from "@/gateway/types";
import { useAgentsStore, type AgentTab } from "@/store/console-stores/agents-store";
import { ChannelsTab } from "./tabs/ChannelsTab";
import { CronJobsTab } from "./tabs/CronJobsTab";
import { FilesTab } from "./tabs/FilesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { SkillsTab } from "./tabs/SkillsTab";
import { ToolsTab } from "./tabs/ToolsTab";

const TABS: AgentTab[] = ["overview", "files", "tools", "skills", "channels", "cronJobs"];

interface AgentDetailTabsProps {
  agent: AgentSummary;
}

export function AgentDetailTabs({ agent }: AgentDetailTabsProps) {
  const { t } = useTranslation("console");
  const { activeTab, setActiveTab } = useAgentsStore();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex border-b border-gray-200 px-4 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t(`agents.tabs.${tab}`)}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === "overview" && <OverviewTab key={agent.id} agent={agent} />}
        {activeTab === "files" && <FilesTab key={agent.id} agent={agent} />}
        {activeTab === "tools" && <ToolsTab key={agent.id} agent={agent} />}
        {activeTab === "skills" && <SkillsTab key={agent.id} agent={agent} />}
        {activeTab === "channels" && <ChannelsTab key={agent.id} agent={agent} />}
        {activeTab === "cronJobs" && <CronJobsTab key={agent.id} agent={agent} />}
      </div>
    </div>
  );
}
