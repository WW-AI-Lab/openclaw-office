import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { generateAvatar3dColor } from "@/lib/avatar-generator";
import { useOfficeStore } from "@/store/office-store";

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

export function CostPieChart() {
  const { t } = useTranslation();
  const agentCosts = useOfficeStore((s) => s.agentCosts);
  const agents = useOfficeStore((s) => s.agents);

  const entries = Object.entries(agentCosts).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (entries.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t("empty.noCostData")}
      </div>
    );
  }

  const data = entries.map(([agentId, value]) => ({
    name: agents.get(agentId)?.name ?? agentId,
    agentId,
    value,
    color: generateAvatar3dColor(agentId),
  }));

  return (
    <div className="relative h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, name: string) => {
              const v = typeof value === "number" ? value : 0;
              const pct = total > 0 ? ((v / total) * 100).toFixed(0) : "0";
              return `${name}: ${formatTokens(v)} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          {formatTokens(total)}
        </span>
      </div>
    </div>
  );
}
