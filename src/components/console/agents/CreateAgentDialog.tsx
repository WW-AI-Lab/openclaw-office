import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgentsStore } from "@/store/console-stores/agents-store";

export function CreateAgentDialog() {
  const { t } = useTranslation("console");
  const { createDialogOpen, setCreateDialogOpen, createAgent, selectAgent } = useAgentsStore();
  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [emoji, setEmoji] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (!createDialogOpen) return null;

  const handleClose = () => {
    setCreateDialogOpen(false);
    setName("");
    setWorkspace("");
    setEmoji("");
    setError("");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t("agents.createDialog.nameRequired"));
      return;
    }
    const ws =
      workspace.trim() || `~/.openclaw/workspace-${name.trim().toLowerCase().replace(/\s+/g, "-")}`;
    setCreating(true);
    setError("");
    const agentId = await createAgent({
      name: name.trim(),
      workspace: ws,
      emoji: emoji.trim() || undefined,
    });
    setCreating(false);
    if (agentId) {
      selectAgent(agentId);
      handleClose();
    } else {
      setError(t("agents.overview.saveError"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("agents.createDialog.title")}
          </h3>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("agents.createDialog.name")} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agents.createDialog.namePlaceholder")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("agents.createDialog.workspace")}
            </label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder={t("agents.createDialog.workspacePlaceholder")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("agents.createDialog.emoji")}
            </label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={t("agents.createDialog.emojiPlaceholder")}
              className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("agents.createDialog.cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? t("agents.createDialog.creating") : t("agents.createDialog.create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
