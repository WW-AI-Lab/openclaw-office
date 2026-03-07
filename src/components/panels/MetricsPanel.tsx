import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOfficeStore } from "@/store/office-store";

const TokenLineChart = lazy(() =>
  import("./TokenLineChart").then((m) => ({ default: m.TokenLineChart })),
);
const CostPieChart = lazy(() =>
  import("./CostPieChart").then((m) => ({ default: m.CostPieChart })),
);
const NetworkGraph = lazy(() =>
  import("./NetworkGraph").then((m) => ({ default: m.NetworkGraph })),
);
const ActivityHeatmap = lazy(() =>
  import("./ActivityHeatmap").then((m) => ({ default: m.ActivityHeatmap })),
);

function TabSpinner() {
  return (
    <div className="flex min-h-[140px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

type TabId = "overview" | "trend" | "topology" | "activity";

export function MetricsPanel() {
  const { t } = useTranslation("panels");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const metrics = useOfficeStore((s) => s.globalMetrics);
  const links = useOfficeStore((s) => s.links);
  const demoLinks = useOfficeStore((s) => s.demoLinks);
  const demoTopologyEnabled = useOfficeStore((s) => s.demoTopologyEnabled);
  const setDemoTopologyEnabled = useOfficeStore((s) => s.setDemoTopologyEnabled);
  const forceCollaborationDemo = useOfficeStore((s) => s.forceCollaborationDemo);
  const clearDemoTopology = useOfficeStore((s) => s.clearDemoTopology);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: t("metrics.tabs.overview") },
    { id: "trend", label: t("metrics.tabs.trend") },
    { id: "topology", label: t("metrics.tabs.topology") },
    { id: "activity", label: t("metrics.tabs.activity") },
  ];

  const topologySource: "live" | "demo" | "noData" =
    demoTopologyEnabled && demoLinks.length > 0
      ? "demo"
      : links.length > 0
        ? "live"
        : "noData";

  const effectiveLinks = demoTopologyEnabled && demoLinks.length > 0 ? demoLinks : links;
  const inMeetingCount = useOfficeStore(
    (s) => Array.from(s.agents.values()).filter((a) => a.zone === "meeting" && a.confirmed).length,
  );
  const topLink = [...effectiveLinks].sort((a, b) => b.strength - a.strength)[0];
  const meetingReason =
    inMeetingCount > 0 && topLink
      ? t("metrics.topology.meetingReason", {
          count: inMeetingCount,
          sessionKey: topLink.sessionKey,
          strength: topLink.strength.toFixed(2),
        })
      : null;

  const cards = [
    {
      label: t("metrics.activeAgents"),
      value: `${metrics.activeAgents}/${metrics.totalAgents}`,
      color: "#3b82f6",
    },
    {
      label: t("metrics.totalTokens"),
      value: formatTokens(metrics.totalTokens),
      color: "#22c55e",
    },
    {
      label: t("metrics.collaboration"),
      value: `${Math.round(metrics.collaborationHeat)}%`,
      color: "#f97316",
    },
    {
      label: t("metrics.tokenRate"),
      value: `${metrics.tokenRate.toFixed(0)}${t("metrics.tokenRateUnit")}`,
      color: "#a855f7",
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-4 gap-1 p-2">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg bg-gray-50 px-1 py-1 text-center dark:bg-gray-800"
          >
            <div className="text-xs font-bold leading-tight" style={{ color: card.color }}>
              {card.value}
            </div>
            <div className="text-[8px] text-gray-500 dark:text-gray-400">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 border-t border-gray-100 px-2 py-1 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded px-2 py-0.5 text-[10px] ${
              activeTab === tab.id
                ? "bg-gray-200 font-medium dark:bg-gray-700 dark:text-gray-200"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-2">
        {activeTab === "overview" && (
          <Suspense fallback={<TabSpinner />}>
            <CostPieChart />
          </Suspense>
        )}
        {activeTab === "trend" && (
          <Suspense fallback={<TabSpinner />}>
            <TokenLineChart />
          </Suspense>
        )}
        {activeTab === "topology" && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  topologySource === "demo"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                    : topologySource === "live"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {t(`metrics.topology.source.${topologySource}`)}
              </span>
              <button
                type="button"
                onClick={() => setDemoTopologyEnabled(!demoTopologyEnabled)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                  demoTopologyEnabled
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {t("metrics.topology.demoMode")}
              </button>
              <button
                type="button"
                onClick={forceCollaborationDemo}
                className="rounded bg-purple-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-purple-700"
              >
                {t("metrics.topology.forceDemo")}
              </button>
              {demoLinks.length > 0 && (
                <button
                  type="button"
                  onClick={clearDemoTopology}
                  className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {t("metrics.topology.clearDemo")}
                </button>
              )}
            </div>
            {meetingReason && (
              <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
                {meetingReason}
              </div>
            )}
            <Suspense fallback={<TabSpinner />}>
              <NetworkGraph />
            </Suspense>
          </>
        )}
        {activeTab === "activity" && (
          <Suspense fallback={<TabSpinner />}>
            <ActivityHeatmap />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}
