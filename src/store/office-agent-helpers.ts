import type {
  AgentVisualStatus,
  AgentZone,
  VisualAgent,
} from "@/gateway/types";
import { ZONES, CORRIDOR_ENTRANCE } from "@/lib/constants";
import { allocatePosition, calculateLoungePositions } from "@/lib/position-allocator";

export function createVisualAgent(
  id: string,
  name: string,
  isSubAgent: boolean,
  occupied: Set<string>,
  confirmed = true,
): VisualAgent {
  if (!confirmed) {
    return {
      id,
      name,
      status: "idle" as AgentVisualStatus,
      position: { ...CORRIDOR_ENTRANCE },
      currentTool: null,
      speechBubble: null,
      lastActiveAt: Date.now(),
      toolCallCount: 0,
      toolCallHistory: [],
      runId: null,
      isSubAgent: false,
      isPlaceholder: false,
      parentAgentId: null,
      childAgentIds: [],
      zone: "corridor" as const,
      originalPosition: null,
      movement: null,
      confirmed: false,
      arrivedAtHotDeskAt: null,
      pendingRetire: false,
      arrivedAtMeetingAt: null,
      manualMeeting: false,
    };
  }
  const position = allocatePosition(id, isSubAgent, occupied);
  return {
    id,
    name,
    status: "idle" as AgentVisualStatus,
    position,
    currentTool: null,
    speechBubble: null,
    lastActiveAt: Date.now(),
    toolCallCount: 0,
    toolCallHistory: [],
    runId: null,
    isSubAgent,
    isPlaceholder: false,
    parentAgentId: null,
    childAgentIds: [],
    zone: isSubAgent ? ("hotDesk" as const) : ("desk" as const),
    originalPosition: null,
    movement: null,
    confirmed: true,
    arrivedAtHotDeskAt: isSubAgent ? Date.now() : null,
    pendingRetire: false,
    arrivedAtMeetingAt: null,
    manualMeeting: false,
  };
}

export function positionKey(pos: { x: number; y: number }): string {
  return `${pos.x},${pos.y}`;
}

export function nextPlaceholderIndex(agents: Map<string, VisualAgent>): number {
  let maxIdx = -1;
  for (const a of agents.values()) {
    if (a.id.startsWith("placeholder-")) {
      const idx = parseInt(a.id.slice("placeholder-".length), 10);
      if (!Number.isNaN(idx) && idx > maxIdx) maxIdx = idx;
    }
  }
  return maxIdx + 1;
}

export function allocateNextPosition(
  agents: Map<string, VisualAgent>,
  toZone: AgentZone,
  maxSubAgents: number,
): { x: number; y: number } {
  if (toZone === "lounge") {
    const loungePositions = calculateLoungePositions(maxSubAgents);
    const occupied = new Set<string>();
    for (const a of agents.values()) {
      if (a.zone === "lounge") occupied.add(positionKey(a.position));
    }
    const free = loungePositions.find((p) => !occupied.has(positionKey(p)));
    if (free) return free;
    return loungePositions[0] ?? { x: ZONES.lounge.x + 60, y: ZONES.lounge.y + 40 };
  }

  // hotDesk or desk — use allocatePosition
  const occupied = new Set<string>();
  for (const a of agents.values()) {
    if (a.zone === toZone) occupied.add(positionKey(a.position));
  }
  return allocatePosition("temp-" + Date.now(), toZone === "hotDesk", occupied);
}

/**
 * Move an unconfirmed agent to a lounge placeholder position.
 * Removes one placeholder to make room; if none available, uses first lounge position.
 */
export function activateFromLoungePlaceholder(
  state: { agents: Map<string, VisualAgent>; maxSubAgents: number },
  agent: VisualAgent,
): void {
  // Find a placeholder to consume
  let placeholder: VisualAgent | undefined;
  for (const a of state.agents.values()) {
    if (a.isPlaceholder && a.zone === "lounge") {
      placeholder = a;
      break;
    }
  }
  if (placeholder) {
    agent.position = { ...placeholder.position };
    agent.zone = "lounge";
    state.agents.delete(placeholder.id);
  } else {
    const loungePositions = calculateLoungePositions(state.maxSubAgents);
    const loungeOccupied = new Set<string>();
    for (const a of state.agents.values()) {
      if (a.zone === "lounge") loungeOccupied.add(positionKey(a.position));
    }
    const freePos = loungePositions.find((p) => !loungeOccupied.has(positionKey(p)));
    agent.position = freePos ?? loungePositions[0] ?? { x: ZONES.lounge.x + 60, y: ZONES.lounge.y + 40 };
    agent.zone = "lounge";
  }
}

/**
 * Check if the given agentId is likely a registered main agent.
 * A main agent's sessionKey typically appears in the sessionKeyMap pointing
 * to an existing confirmed agent, or the agentId itself matches a known agent.
 * This prevents main agents with new runIds from becoming unconfirmed.
 */
export function isRegisteredMainAgentId(
  state: { agents: Map<string, VisualAgent>; sessionKeyMap: Map<string, string[]> },
  agentId: string,
  sessionKey?: string,
): boolean {
  for (const a of state.agents.values()) {
    if (!a.isSubAgent && !a.isPlaceholder && a.confirmed && a.id === agentId) {
      return true;
    }
  }
  if (sessionKey) {
    const mapped = state.sessionKeyMap.get(sessionKey);
    if (mapped) {
      for (const mid of mapped) {
        const ma = state.agents.get(mid);
        if (ma && !ma.isSubAgent && ma.confirmed) {
          return false;
        }
      }
    }
  }
  return false;
}

/**
 * Extract parent agent ID from a sub-agent sessionKey.
 * Gateway sessionKey format: "agent:<parentName>:subagent:<uuid>"
 * Parent sessionKey format: "agent:<parentName>:main"
 * Look up parent via sessionKeyMap or by matching agent name.
 */
export function extractParentFromSessionKey(
  state: { agents: Map<string, VisualAgent>; sessionKeyMap: Map<string, string[]> },
  sessionKey: string,
): string | null {
  const parts = sessionKey.split(":");
  const subIdx = parts.indexOf("subagent");
  if (subIdx >= 2) {
    const parentName = parts.slice(1, subIdx).join(":");

    for (const [sk, mapped] of state.sessionKeyMap) {
      if (sk.startsWith(`agent:${parentName}:`) && !sk.includes(":subagent:") && mapped.length > 0) {
        return mapped[0];
      }
    }

    for (const [id, a] of state.agents) {
      if (!a.isSubAgent && !a.isPlaceholder && (a.id === parentName || a.name === parentName)) {
        return id;
      }
    }
  }
  // Last resort: return first non-sub-agent
  for (const [id, a] of state.agents) {
    if (!a.isSubAgent && !a.isPlaceholder && a.confirmed) {
      return id;
    }
  }
  return null;
}
