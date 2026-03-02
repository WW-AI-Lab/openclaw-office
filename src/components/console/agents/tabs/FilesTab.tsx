import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { AgentSummary } from "@/gateway/types";
import { useAgentsStore } from "@/store/console-stores/agents-store";

interface FilesTabProps {
  agent: AgentSummary;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatRelativeTime(
  raw: string | number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const ts = typeof raw === "number" ? raw : new Date(raw).getTime();
  if (Number.isNaN(ts) || ts === 0) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return t("agents.files.justNow");
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return t("agents.files.justNow");
  if (hours < 24) return t("agents.files.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("agents.files.daysAgo", { count: days });
}

export function FilesTab({ agent }: FilesTabProps) {
  const { t } = useTranslation("console");
  const {
    files,
    filesLoading,
    selectedFileName,
    fileContent,
    isFileDirty,
    fileSaving,
    fetchFiles,
    fetchFileContent,
    setFileContent,
    resetFileContent,
    saveFileContent,
  } = useAgentsStore();

  useEffect(() => {
    fetchFiles(agent.id);
  }, [agent.id, fetchFiles]);

  const selectedFile = files.find((f) => f.name === selectedFileName);

  const handleSave = async () => {
    if (selectedFileName && fileContent != null) {
      await saveFileContent(agent.id, selectedFileName, fileContent);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("agents.files.title")}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t("agents.files.description")}
          </p>
        </div>
        <button
          onClick={() => fetchFiles(agent.id)}
          disabled={filesLoading}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${filesLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex gap-4">
        <div className="w-56 shrink-0 space-y-2">
          {files.map((file) => (
            <button
              key={file.name}
              onClick={() => fetchFileContent(agent.id, file.name)}
              className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                selectedFileName === file.name
                  ? "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800"
              }`}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(file.size)} · {formatRelativeTime(file.modifiedAt, t)}
              </p>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {selectedFile && fileContent != null ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedFile.name}
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetFileContent}
                    disabled={!isFileDirty}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    {t("agents.files.reset")}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!isFileDirty || fileSaving}
                    className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    {fileSaving ? t("agents.files.saving") : t("agents.files.save")}
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("agents.files.content")}
                </p>
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="h-80 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              {t("agents.files.selectFile")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
