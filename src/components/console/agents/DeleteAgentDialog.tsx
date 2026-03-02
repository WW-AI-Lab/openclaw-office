import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgentsStore } from "@/store/console-stores/agents-store";

export function DeleteAgentDialog() {
  const { t } = useTranslation("console");
  const { deleteDialogOpen, setDeleteDialogOpen, selectedAgentId, agents, deleteAgent } =
    useAgentsStore();
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const agent = agents.find((a) => a.id === selectedAgentId);

  if (!deleteDialogOpen || !agent) return null;

  const displayName = agent.identity?.name ?? agent.name ?? agent.id;

  const handleClose = () => {
    setDeleteDialogOpen(false);
    setDeleteFiles(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deleteAgent(agent.id, deleteFiles);
    setDeleting(false);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("agents.deleteDialog.title")}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {t("agents.deleteDialog.confirm", { name: displayName })}
        </p>

        <label className="mb-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={deleteFiles}
            onChange={(e) => setDeleteFiles(e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          {t("agents.deleteDialog.deleteFiles")}
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t("agents.deleteDialog.cancel")}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? t("agents.deleteDialog.deleting") : t("agents.deleteDialog.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
