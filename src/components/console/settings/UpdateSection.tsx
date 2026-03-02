import { Download, Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/console/shared/ConfirmDialog";
import { useConfigStore } from "@/store/console-stores/config-store";

export function UpdateSection() {
  const { t } = useTranslation("console");
  const status = useConfigStore((s) => s.status);
  const config = useConfigStore((s) => s.config);
  const updateResult = useConfigStore((s) => s.updateResult);
  const updateLoading = useConfigStore((s) => s.updateLoading);
  const runUpdate = useConfigStore((s) => s.runUpdate);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const channel = (config?.update as Record<string, unknown> | undefined)?.channel as
    | string
    | undefined;

  const handleUpdate = async () => {
    setConfirmOpen(false);
    await runUpdate({ restartDelayMs: 3000 });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
        {t("settings.update.title")}
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t("settings.update.currentVersion")}
          </span>
          <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
            {status?.version ?? "—"}
          </span>
        </div>

        {channel && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("settings.update.channel")}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {channel}
            </span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={updateLoading}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("settings.update.updating")}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {t("settings.update.checkUpdate")}
              </>
            )}
          </button>
        </div>

        {updateResult && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
              updateResult.result.status === "ok"
                ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                : updateResult.result.status === "noop"
                  ? "bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                  : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
            }`}
          >
            {updateResult.result.status === "ok" && (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {updateResult.result.status === "noop" && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            {updateResult.result.status === "error" && (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {updateResult.result.status === "ok" &&
                t("settings.update.resultOk", {
                  before: updateResult.result.before ?? "?",
                  after: updateResult.result.after ?? "?",
                })}
              {updateResult.result.status === "noop" && t("settings.update.resultNoop")}
              {updateResult.result.status === "error" &&
                t("settings.update.resultError", {
                  reason: updateResult.result.reason ?? "Unknown error",
                })}
            </span>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("settings.update.confirmTitle")}
        description={t("settings.update.confirmDescription")}
        onConfirm={handleUpdate}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
