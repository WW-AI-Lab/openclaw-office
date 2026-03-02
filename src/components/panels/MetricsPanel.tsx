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

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: t("metrics.tabs.overview") },
    { id: "trend", label: t("metrics.tabs.trend") },
    { id: "topology", label: t("metrics.tabs.topology") },
    { id: "activity", label: t("metrics.tabs.activity") },
  ];

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
          <Suspense fallback={<TabSpinner />}>
            <NetworkGraph />
          </Suspense>
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
