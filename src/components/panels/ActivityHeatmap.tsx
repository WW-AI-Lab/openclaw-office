import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventHistoryItem } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

const ROWS = 10;
const COLS = 24;
const CELL_W = 10;
const CELL_H = 14;

const COLOR_SCALE_LIGHT = [
  { max: 0, color: "#f3f4f6" },
  { max: 5, color: "#bbf7d0" },
  { max: 10, color: "#4ade80" },
  { max: Infinity, color: "#16a34a" },
];

const COLOR_SCALE_DARK = [
  { max: 0, color: "#1e293b" },
  { max: 5, color: "#14532d" },
  { max: 10, color: "#166534" },
  { max: Infinity, color: "#22c55e" },
];

function getColor(count: number, isDark: boolean): string {
  const scale = isDark ? COLOR_SCALE_DARK : COLOR_SCALE_LIGHT;
  for (const s of scale) {
    if (count <= s.max) {
      return s.color;
    }
  }
  return scale[scale.length - 1].color;
}

function buildHeatmapData(
  eventHistory: EventHistoryItem[],
): { agentId: string; agentName: string; counts: number[] }[] {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  const byAgent = new Map<string, { name: string; counts: number[] }>();
  for (const e of eventHistory) {
    const ts = e.timestamp;
    const hoursAgo = (now - ts) / hourMs;
    if (hoursAgo < 0 || hoursAgo >= COLS) {
      continue;
    }
    const colIdx = 23 - Math.min(23, Math.floor(hoursAgo));
    let entry = byAgent.get(e.agentId);
    if (!entry) {
      entry = { name: e.agentName, counts: Array.from({ length: COLS }, () => 0) };
      byAgent.set(e.agentId, entry);
    }
    if (colIdx >= 0 && colIdx < COLS) {
      entry.counts[colIdx]++;
    }
  }

  return Array.from(byAgent.entries())
    .map(([agentId, { name, counts }]) => ({ agentId, agentName: name, counts }))
    .toSorted((a, b) => {
      const sa = a.counts.reduce((s, c) => s + c, 0);
      const sb = b.counts.reduce((s, c) => s + c, 0);
      return sb - sa;
    })
    .slice(0, ROWS);
}

export function ActivityHeatmap() {
  const { t } = useTranslation("panels");
  const eventHistory = useOfficeStore((s) => s.eventHistory);
  const theme = useOfficeStore((s) => s.theme);
  const isDark = theme === "dark";
  const [tooltip, setTooltip] = useState<{
    agentName: string;
    hour: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const rows = useMemo(() => buildHeatmapData(eventHistory), [eventHistory]);

  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t("common:empty.noActivityData")}
      </div>
    );
  }

  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  return (
    <div className="relative">
      <svg width={COLS * CELL_W + 60} height={ROWS * CELL_H + 24} className="overflow-visible">
        {rows.map((row, ri) => (
          <g key={row.agentId}>
            <text
              x={0}
              y={ri * CELL_H + CELL_H / 2 + 4}
              fontSize={9}
              fill={isDark ? "#e2e8f0" : "#374151"}
            >
              {row.agentName.length > 10 ? `${row.agentName.slice(0, 8)}…` : row.agentName}
            </text>
            {row.counts.map((count, ci) => {
              const x = 55 + ci * CELL_W;
              const y = ri * CELL_H + 4;
              const hourStart = now - (COLS - ci) * hourMs;
              const hourEnd = hourStart + hourMs;
              const hourStr = `${new Date(hourStart).getHours()}:00-${new Date(hourEnd).getHours()}:00`;
              return (
                <rect
                  key={ci}
                  x={x}
                  y={y}
                  width={CELL_W - 1}
                  height={CELL_H - 1}
                  fill={getColor(count, isDark)}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    setTooltip({
                      agentName: row.agentName,
                      hour: hourStr,
                      count,
                      x: rect.left,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </g>
        ))}
      </svg>
      {tooltip && (
        <div
          className="fixed z-10 rounded border border-gray-200 bg-white px-2 py-1 text-xs shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          style={{ left: tooltip.x, top: tooltip.y - 32 }}
        >
          {tooltip.agentName} | {tooltip.hour} | {tooltip.count} {t("activityHeatmap.eventsUnit")}
        </div>
      )}
    </div>
  );
}
