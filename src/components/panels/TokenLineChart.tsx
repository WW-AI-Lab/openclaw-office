import { useTranslation } from "react-i18next";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TokenSnapshot } from "@/gateway/types";
import { PALETTE } from "@/lib/avatar-generator";
import { useOfficeStore } from "@/store/office-store";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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

export function TokenLineChart() {
  const { t } = useTranslation("panels");
  const tokenHistory = useOfficeStore((s) => s.tokenHistory);

  if (tokenHistory.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t("common:empty.waitingUsageData")}
      </div>
    );
  }

  const topAgentIds = getTopAgentIds(tokenHistory, 5);
  const chartData = tokenHistory.map((snap) => {
    const point: Record<string, number | string> = {
      timestamp: snap.timestamp,
      time: formatTime(snap.timestamp),
      total: snap.total,
    };
    for (const aid of topAgentIds) {
      point[aid] = snap.byAgent[aid] ?? 0;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatTokens} />
        <Tooltip
          formatter={(value: number) => formatTokens(value)}
          labelFormatter={(_, payload) => {
            const p = payload[0]?.payload as Record<string, unknown> | undefined;
            return p ? formatTime(p.timestamp as number) : "";
          }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) {
              return null;
            }
            const p = payload[0]?.payload as Record<string, unknown>;
            if (!p) {
              return null;
            }
            const total = p.total as number;
            const lines = [
              <div key="total">
                {t("tokenChart.total")} {formatTokens(total)}
              </div>,
              ...topAgentIds.map((aid, i) => {
                const v = (p[aid] as number) ?? 0;
                return (
                  <div key={aid} style={{ color: PALETTE[i % PALETTE.length] }}>
                    {aid}: {formatTokens(v)}
                  </div>
                );
              }),
            ];
            return (
              <div className="rounded border border-gray-200 bg-white px-2 py-1 text-xs shadow dark:border-gray-700 dark:bg-gray-900">
                <div className="font-medium text-gray-700 dark:text-gray-300">{label}</div>
                {lines}
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name={t("tokenChart.totalLine")}
        />
        {topAgentIds.map((aid, i) => (
          <Line
            key={aid}
            type="monotone"
            dataKey={aid}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={1}
            strokeDasharray="4 2"
            dot={false}
            name={aid}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function getTopAgentIds(history: TokenSnapshot[], limit: number): string[] {
  const sums: Record<string, number> = {};
  for (const snap of history) {
    for (const [aid, v] of Object.entries(snap.byAgent)) {
      sums[aid] = (sums[aid] ?? 0) + v;
    }
  }
  return Object.entries(sums)
    .toSorted(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id);
}
