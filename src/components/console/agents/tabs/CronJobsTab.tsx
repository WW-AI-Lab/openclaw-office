import { RefreshCw, Plus, Loader2, Clock } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { CronTaskInput } from "@/gateway/adapter-types";
import type { AgentSummary } from "@/gateway/types";
import { CronTaskCard } from "@/components/console/cron/CronTaskCard";
import { CronTaskDialog } from "@/components/console/cron/CronTaskDialog";
import { useAgentsStore } from "@/store/console-stores/agents-store";

interface CronJobsTabProps {
  agent: AgentSummary;
}

export function CronJobsTab({ agent }: CronJobsTabProps) {
  const { t } = useTranslation("console");
  const {
    agentCronJobs,
    agentCronJobsLoading,
    cronDialogOpen,
    cronEditingTask,
    fetchAgentCronJobs,
    addAgentCronJob,
    updateAgentCronJob,
    removeAgentCronJob,
    runAgentCronJob,
    toggleAgentCronJob,
    openAgentCronDialog,
    closeAgentCronDialog,
  } = useAgentsStore();

  useEffect(() => {
    fetchAgentCronJobs(agent.id);
  }, [agent.id, fetchAgentCronJobs]);

  const tasks = agentCronJobs ?? [];
  const totalCount = tasks.length;
  const enabledCount = tasks.filter((t) => t.enabled).length;
  const errorCount = tasks.filter((t) => t.state.lastRunStatus === "error").length;

  const handleSave = (input: CronTaskInput) => {
    addAgentCronJob(agent.id, input);
  };

  const handleUpdate = (id: string, patch: Partial<CronTaskInput>) => {
    updateAgentCronJob(id, patch);
  };

  if (agentCronJobsLoading) {
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
          {t("agents.cronJobs.title")}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAgentCronDialog()}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("agents.cronJobs.addTask")}
          </button>
          <button
            onClick={() => fetchAgentCronJobs(agent.id)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title={t("agents.refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Statistics bar */}
      <div className="flex gap-4">
        <StatChip label={t("agents.cronJobs.total")} value={totalCount} />
        <StatChip label={t("agents.cronJobs.enabled")} value={enabledCount} color="green" />
        <StatChip label={t("agents.cronJobs.errors")} value={errorCount} color="red" />
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="py-8 text-center">
          <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t("agents.cronJobs.noCronJobs")}
          </p>
          <button
            onClick={() => openAgentCronDialog()}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {t("cron.empty.createFirst")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <CronTaskCard
              key={task.id}
              task={task}
              onToggle={(id, enabled) => toggleAgentCronJob(id, enabled)}
              onRun={(id) => runAgentCronJob(id)}
              onEdit={(t) => openAgentCronDialog(t)}
              onDelete={(id) => removeAgentCronJob(id)}
            />
          ))}
        </div>
      )}

      <CronTaskDialog
        open={cronDialogOpen}
        editingTask={cronEditingTask}
        onSave={handleSave}
        onUpdate={handleUpdate}
        onClose={closeAgentCronDialog}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "red";
}) {
  const textColor =
    color === "green"
      ? "text-green-600 dark:text-green-400"
      : color === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-900 dark:text-gray-100";

  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
      <div className={`text-lg font-semibold ${textColor}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
