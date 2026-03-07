import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VisualAgent } from "@/gateway/types";
import { STATUS_COLORS } from "@/lib/constants";
import { useOfficeStore } from "@/store/office-store";

const NODE_MIN_R = 8;
const NODE_MAX_R = 24;
const TOP_AGENTS = 20;
const SVG_SIZE = 280;

function circularLayout(
  agents: VisualAgent[],
  centerX: number,
  centerY: number,
  radius: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const n = agents.length;
  if (n === 0) {
    return positions;
  }
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.set(agents[i].id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }
  return positions;
}

function mapToolCountToRadius(count: number, maxCount: number): number {
  if (maxCount <= 0) {
    return NODE_MIN_R;
  }
  const t = Math.min(count / maxCount, 1);
  return NODE_MIN_R + t * (NODE_MAX_R - NODE_MIN_R);
}

function formatAge(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function NetworkGraph() {
  const { t } = useTranslation();
  const agents = useOfficeStore((s) => s.agents);
  const links = useOfficeStore((s) => s.links);
  const demoLinks = useOfficeStore((s) => s.demoLinks);
  const demoTopologyEnabled = useOfficeStore((s) => s.demoTopologyEnabled);
  const theme = useOfficeStore((s) => s.theme);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const isDark = theme === "dark";
  const effectiveLinks = demoTopologyEnabled && demoLinks.length > 0 ? demoLinks : links;

  const { topAgents, positions, maxToolCount } = useMemo(() => {
    const list = Array.from(agents.values())
      .toSorted((a, b) => b.toolCallCount - a.toolCallCount)
      .slice(0, TOP_AGENTS);
    const maxCount = Math.max(1, ...list.map((a) => a.toolCallCount));
    const r = Math.min(80, Math.max(40, list.length * 8));
    const positions = circularLayout(list, SVG_SIZE / 2, SVG_SIZE / 2, r);
    return { topAgents: list, positions, maxToolCount: maxCount };
  }, [agents]);

  const hoverLinks = useMemo(() => {
    if (!hoverId) {
      return new Set<string>();
    }
    const s = new Set<string>();
    for (const l of effectiveLinks) {
      if (l.sourceId === hoverId || l.targetId === hoverId) {
        s.add(`${l.sourceId}-${l.targetId}`);
      }
    }
    return s;
  }, [effectiveLinks, hoverId]);

  if (topAgents.length === 0 && effectiveLinks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t("empty.noRelationData")}
      </div>
    );
  }

  return (
    <svg
      width="100%"
      height={200}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      className="overflow-visible"
      onMouseLeave={() => setHoverId(null)}
    >
      {effectiveLinks
        .filter((l) => positions.has(l.sourceId) && positions.has(l.targetId))
        .map((l) => {
          const src = positions.get(l.sourceId)!;
          const tgt = positions.get(l.targetId)!;
          const key = `${l.sourceId}-${l.targetId}`;
          const isHovered = hoverLinks.has(key);
          const strokeWidth = Math.max(1, l.strength * 3);
          return (
            <line
              key={key}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke={isHovered ? "#3b82f6" : "rgba(107,114,128,0.4)"}
              strokeWidth={strokeWidth}
            >
              <title>{`session: ${l.sessionKey}\nstrength: ${l.strength.toFixed(2)}\nlast activity: ${formatAge(l.lastActivityAt)}`}</title>
            </line>
          );
        })}
      {topAgents.map((agent) => {
        const pos = positions.get(agent.id);
        if (!pos) {
          return null;
        }
        const r = mapToolCountToRadius(agent.toolCallCount, maxToolCount);
        const isHovered = hoverId === agent.id;
        const scale = isHovered ? 1.2 : 1;
        const color = STATUS_COLORS[agent.status];
        return (
          <g
            key={agent.id}
            onMouseEnter={() => setHoverId(agent.id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={r * scale}
              fill={color}
              stroke={isHovered ? "#1e40af" : "transparent"}
              strokeWidth={2}
            />
            <text
              x={pos.x}
              y={pos.y + r + 10}
              textAnchor="middle"
              fontSize={9}
              fill={isDark ? "#e2e8f0" : "#374151"}
            >
              {agent.name.length > 8 ? `${agent.name.slice(0, 6)}…` : agent.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
