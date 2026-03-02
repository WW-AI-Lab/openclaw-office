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

    return (
      <g transform={`translate(${x}, ${y})`}>
        <Desk x={0} y={30} isDark={isDark} />
        <Chair x={0} y={-12} isDark={isDark} />
        {agent && <AgentAvatar agent={{ ...agent, position: { x: 0, y: -12 } }} />}
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
