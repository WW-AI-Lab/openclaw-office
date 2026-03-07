import { Radio, Wrench, Zap, Clock, RefreshCw, WifiOff, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner } from "@/components/console/dashboard/AlertBanner";
import { ChannelOverview } from "@/components/console/dashboard/ChannelOverview";
import { QuickNavGrid } from "@/components/console/dashboard/QuickNavGrid";
import { SkillOverview } from "@/components/console/dashboard/SkillOverview";
import { StatCard } from "@/components/console/dashboard/StatCard";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { LoadingState } from "@/components/console/shared/LoadingState";
import { useDashboardStore } from "@/store/console-stores/dashboard-store";
import { useOfficeStore } from "@/store/office-store";

export function DashboardPage() {
  const { t } = useTranslation("console");
  const { channelsSummary, skillsSummary, usage, isLoading, error, refresh } = useDashboardStore();
  const wsStatus = useOfficeStore((s) => s.connectionStatus);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (isLoading && channelsSummary.length === 0) {
    const isDisconnected = wsStatus !== "connected" && wsStatus !== "connecting";
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("dashboard.title")}
          description={t("dashboard.description")}
          onRefresh={refresh}
        />
        {isDisconnected ? (
          <GatewayConnectionGuide status={wsStatus} onRetry={refresh} />
        ) : (
          <LoadingState message={t("dashboard.loading")} />
        )}
      </div>
    );
  }

  if (error && channelsSummary.length === 0 && skillsSummary.length === 0) {
    const isConnectionError = wsStatus !== "connected";
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("dashboard.title")}
          description={t("dashboard.description")}
          onRefresh={refresh}
        />
        {isConnectionError ? (
          <GatewayConnectionGuide status={wsStatus} onRetry={refresh} />
        ) : (
          <ErrorState message={error} onRetry={refresh} />
        )}
      </div>
    );
  }

  const connectedCount = channelsSummary.filter((c) => c.status === "connected").length;
  const errorChannelCount = channelsSummary.filter((c) => c.status === "error").length;
  const enabledSkillCount = skillsSummary.filter((s) => s.enabled).length;

  const primaryProvider = usage?.providers[0];
  const primaryWindow = primaryProvider?.windows[0];
  const usageDisplay = primaryProvider
    ? `${primaryProvider.displayName}: ${primaryWindow?.usedPercent ?? 0}%`
    : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        onRefresh={refresh}
        loading={isLoading}
      />

      {wsStatus !== "connected" && (
        <AlertBanner variant="warning" message={t("dashboard.alerts.gatewayDisconnected")} />
      )}
      {errorChannelCount > 0 && (
        <AlertBanner
          variant="error"
          message={t("dashboard.alerts.channelErrors", { count: errorChannelCount })}
        />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={Radio}
          title={t("dashboard.stats.channels")}
          value={`${connectedCount} / ${channelsSummary.length}`}
          color="text-green-500"
        />
        <StatCard
          icon={Wrench}
          title={t("dashboard.stats.skills")}
          value={`${enabledSkillCount} / ${skillsSummary.length}`}
          color="text-purple-500"
        />
        <StatCard
          icon={Zap}
          title={t("dashboard.stats.usage")}
          value={usageDisplay}
          progress={primaryWindow?.usedPercent}
          color="text-blue-500"
        />
        <StatCard
          icon={Clock}
          title={t("dashboard.stats.uptime")}
          value={wsStatus === "connected" ? t("dashboard.stats.uptimeOnline") : "—"}
          color="text-amber-500"
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("dashboard.quickNav.title")}
        </h2>
        <QuickNavGrid />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChannelOverview channels={channelsSummary} />
        <SkillOverview skills={skillsSummary} />
      </div>
    </div>
  );
}

function GatewayConnectionGuide({
  status,
  onRetry,
}: {
  status: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation("console");
  const { t: tc } = useTranslation("common");
  const isReconnecting = status === "reconnecting";

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-500/5 p-6">
        <div className="mb-4 flex items-center gap-3">
          {isReconnecting ? (
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          ) : (
            <WifiOff className="h-8 w-8 text-amber-500" />
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("dashboard.connectionGuide.title")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isReconnecting
                ? t("dashboard.connectionGuide.reconnecting")
                : t("dashboard.connectionGuide.subtitle")}
            </p>
          </div>
        </div>

        <ol className="mb-5 space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
              1
            </span>
            <span>{t("dashboard.connectionGuide.step1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
              2
            </span>
            <span>{t("dashboard.connectionGuide.step2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
              3
            </span>
            <span>{t("dashboard.connectionGuide.step3")}</span>
          </li>
        </ol>

        <div className="mb-4 rounded-md bg-gray-900/60 px-3 py-2 font-mono text-xs text-gray-300">
          <p className="text-gray-500"># {t("dashboard.connectionGuide.cmdComment")}</p>
          <p>openclaw-office --token &lt;your-token&gt;</p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-md bg-amber-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 transition-colors"
        >
          {tc("actions.retry")}
        </button>
      </div>
    </div>
  );
}

function PageHeader({
  title,
  description,
  onRefresh,
  loading,
}: {
  title: string;
  description: string;
  onRefresh: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
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
  );
}
