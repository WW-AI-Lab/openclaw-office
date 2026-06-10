import { memo } from "react";
import type { VisualAgent } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";
import { AgentAvatar } from "./AgentAvatar";
import { Desk, Chair } from "./furniture";

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
