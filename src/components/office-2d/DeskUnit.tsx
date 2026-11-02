import { memo } from "react";
import type { VisualAgent, AgentVisualStatus } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";
import { AgentAvatar } from "./AgentAvatar";
import { Desk, Chair } from "./furniture";

const STATUS_INDICATOR_COLORS: Record<AgentVisualStatus, string> = {
  idle: "#00D4AA",
  thinking: "#3B82F6",
  tool_calling: "#f97316",
  speaking: "#a855f7",
  spawning: "#00D4AA",
  error: "#ef4444",
  offline: "#475569",
};

interface DeskUnitProps {
  x: number;
  y: number;
  agent: VisualAgent | null;
}

export const DeskUnit = memo(
  function DeskUnit({ x, y, agent }: DeskUnitProps) {
    const isDark = useOfficeStore((s) => s.theme) === "dark";
    const isWorking =
      agent !== null &&
      (agent.status === "thinking" ||
        agent.status === "tool_calling" ||
        agent.status === "speaking");

    return (
      <g transform={`translate(${x}, ${y})`}>
        {/* Status indicator dot at top */}
        <g transform={`translate(0, -34)`}>
          {agent ? (
            <>
              {/* Glow ring */}
              <circle
                r={10}
                fill={STATUS_INDICATOR_COLORS[agent.status]}
                opacity={0.15}
                style={{ filter: `blur(3px)` }}
              />
              {/* Status dot */}
              <circle
                r={5}
                fill={STATUS_INDICATOR_COLORS[agent.status]}
                stroke={isDark ? "#1E293B" : "#fff"}
                strokeWidth={1.5}
              />
            </>
          ) : (
            /* Empty desk indicator */
            <circle
              r={5}
              fill="none"
              stroke={isDark ? "#334155" : "#cbd5e1"}
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
          )}
        </g>
        <Chair x={0} y={-14} isDark={isDark} />
        <Desk x={0} y={24} isDark={isDark} active={isWorking} />
        {agent && <AgentAvatar agent={{ ...agent, position: { x: 0, y: -18 } }} />}
      </g>
    );
  },
  (prev, next) => {
    if (prev.x !== next.x || prev.y !== next.y) {
      return false;
    }
    if (prev.agent === null && next.agent === null) {
      return true;
    }
    if (prev.agent === null || next.agent === null) {
      return false;
    }
    return (
      prev.agent.id === next.agent.id &&
      prev.agent.status === next.agent.status &&
      prev.agent.name === next.agent.name &&
      prev.agent.currentTool?.name === next.agent.currentTool?.name &&
      prev.agent.isSubAgent === next.agent.isSubAgent &&
      prev.agent.speechBubble?.text === next.agent.speechBubble?.text
    );
  },
);
