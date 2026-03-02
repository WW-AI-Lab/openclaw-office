import { RefreshCw, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConfigStore } from "@/store/console-stores/config-store";

export function GatewaySection() {
  const { t } = useTranslation("console");
  const status = useConfigStore((s) => s.status);
  const statusLoading = useConfigStore((s) => s.statusLoading);
  const statusError = useConfigStore((s) => s.statusError);
  const fetchStatus = useConfigStore((s) => s.fetchStatus);

  const uptimeHours = status?.uptime ? Math.floor(status.uptime / 3600) : 0;
  const uptimeMinutes = status?.uptime ? Math.floor((status.uptime % 3600) / 60) : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t("settings.gateway.title")}
        </h3>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={statusLoading}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${statusLoading ? "animate-spin" : ""}`} />
          {t("settings.gateway.refresh")}
        </button>
      </div>

      {statusError ? (
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
          <WifiOff className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {t("settings.gateway.notConnected")}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("settings.gateway.notConnectedHint")}
            </p>
          </div>
        </div>
      ) : status ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <InfoItem label={t("settings.gateway.version")} value={status.version ?? "—"} />
          <InfoItem
            label={t("settings.gateway.port")}
            value={status.port != null ? String(status.port) : "—"}
          />
          <InfoItem
            label={t("settings.gateway.uptime")}
            value={
              status.uptime != null
                ? t("settings.gateway.uptimeFormat", { hours: uptimeHours, minutes: uptimeMinutes })
                : "—"
            }
          />
          <InfoItem label={t("settings.gateway.mode")} value={status.mode ?? "—"} />
          <InfoItem label={t("settings.gateway.nodeVersion")} value={status.nodeVersion ?? "—"} />
          <InfoItem label={t("settings.gateway.platform")} value={status.platform ?? "—"} />
        </div>
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
