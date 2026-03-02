import { RefreshCw, Plus, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CronStatsBar } from "@/components/console/cron/CronStatsBar";
import { CronTaskCard } from "@/components/console/cron/CronTaskCard";
import { CronTaskDialog } from "@/components/console/cron/CronTaskDialog";
import { ConfirmDialog } from "@/components/console/shared/ConfirmDialog";
import { EmptyState } from "@/components/console/shared/EmptyState";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { LoadingState } from "@/components/console/shared/LoadingState";
import { useCronStore } from "@/store/console-stores/cron-store";

export function CronPage() {
  const { t } = useTranslation("console");
  const {
    tasks,
    isLoading,
    error,
    dialogOpen,
    editingTask,
    fetchTasks,
    addTask,
    updateTask,
    removeTask,
    runTask,
    openDialog,
    closeDialog,
    initEventListeners,
  } = useCronStore();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
    const unsub = initEventListeners();
    return unsub;
  }, [fetchTasks, initEventListeners]);

  const handleToggle = (id: string, enabled: boolean) => {
    updateTask(id, { enabled } as Partial<import("@/gateway/adapter-types").CronTaskInput>);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await removeTask(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const handleRunConfirm = async () => {
    if (runTarget) {
      await runTask(runTarget);
      setRunTarget(null);
      await fetchTasks();
    }
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("cron.title")}
          description={t("cron.description")}
          onRefresh={fetchTasks}
          onCreate={() => openDialog()}
        />
        <LoadingState />
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("cron.title")}
          description={t("cron.description")}
          onRefresh={fetchTasks}
          onCreate={() => openDialog()}
        />
        <ErrorState message={error} onRetry={fetchTasks} />
      </div>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const aNext = a.state.nextRunAtMs ?? Infinity;
    const bNext = b.state.nextRunAtMs ?? Infinity;
    return aNext - bNext;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("cron.title")}
        description={t("cron.description")}
        onRefresh={fetchTasks}
        loading={isLoading}
        onCreate={() => openDialog()}
      />
      <CronStatsBar tasks={tasks} />

      {tasks.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={t("cron.empty.title")}
          action={{ label: t("cron.empty.createFirst"), onClick: () => openDialog() }}
        />
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => (
            <CronTaskCard
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onRun={setRunTarget}
              onEdit={openDialog}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <CronTaskDialog
        open={dialogOpen}
        editingTask={editingTask}
        onSave={addTask}
        onUpdate={updateTask}
        onClose={closeDialog}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("cron.delete.title")}
        description={t("cron.delete.description")}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />

      <ConfirmDialog
        open={runTarget !== null}
        title={t("cron.run.title")}
        description={t("cron.run.description")}
        onConfirm={handleRunConfirm}
        onCancel={() => setRunTarget(null)}
      />
    </div>
  );
}

function PageHeader({
  title,
  description,
  onRefresh,
  loading,
  onCreate,
}: {
  title: string;
  description: string;
  onRefresh: () => void;
  loading?: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("actions.create")}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("actions.refresh")}
        </button>
      </div>
    </div>
  );
}
