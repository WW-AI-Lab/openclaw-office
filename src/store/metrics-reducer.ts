import type { GlobalMetrics, VisualAgent } from "@/gateway/types";

export function computeMetrics(
  agents: Map<string, VisualAgent>,
  prevMetrics: GlobalMetrics,
): GlobalMetrics {
  let activeCount = 0;
  let realCount = 0;

  for (const agent of agents.values()) {
    if (agent.isPlaceholder || !agent.confirmed) continue;
    realCount++;
    if (agent.status !== "idle" && agent.status !== "offline") {
      activeCount++;
    }
  }

  const collaborationHeat = realCount > 0 ? Math.min((activeCount / realCount) * 100, 100) : 0;

  return {
    activeAgents: activeCount,
    totalAgents: realCount,
    totalTokens: prevMetrics.totalTokens,
    tokenRate: prevMetrics.tokenRate,
    collaborationHeat,
  };
}
