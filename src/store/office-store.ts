import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { parseAgentEvent } from "@/gateway/event-parser";
import { localPersistence } from "@/lib/local-persistence";

enableMapSet();
import type {
  AgentEventPayload,
  AgentSummary,
  AgentToAgentConfig,
  AgentVisualStatus,
  AgentZone,
  CollaborationLink,
  ConnectionStatus,
  EventHistoryItem,
  OfficeStore,
  PageId,
  SessionSnapshot,
  SubAgentInfo,
  ThemeMode,
  TokenSnapshot,
  VisualAgent,
} from "@/gateway/types";
import { detectPeerAgentHintsFromAssistantText } from "@/lib/assistant-collaboration-hints";
import { ZONES, CORRIDOR_ENTRANCE, A2A_TOOL_NAMES } from "@/lib/constants";
import { extractSessionNamespace, extractAgentIdFromSessionKey } from "@/lib/session-key-utils";
import { allocatePosition, allocateMeetingPositions, calculateLoungePositions } from "@/lib/position-allocator";
import { fuzzyMatchAgentIds } from "@/lib/fuzzy-match";
import {
  planWalkPath,
  calculateWalkDuration,
  interpolatePathPosition,
} from "@/lib/movement-animator";
import { applyEventToAgent, setDeferredIdleCallback } from "./agent-reducer";
import { applyMeetingGathering, detectMeetingGroups } from "./meeting-manager";
import { computeMetrics } from "./metrics-reducer";

const EVENT_HISTORY_LIMIT = 200;
const LINK_TIMEOUT_MS = 60_000;
const THEME_STORAGE_KEY = "openclaw-theme";
const CHAT_DOCK_HEIGHT_KEY = "openclaw-chat-dock-height";
const DEFAULT_CHAT_DOCK_HEIGHT = 300;
const LOUNGE_TO_HOTDESK_DEBOUNCE_MS = 300;
const HOTDESK_TO_LOUNGE_DELAY_MS = 30_000;
const MIN_HOTDESK_STAY_MS = 10_000;

const subAgentRetireTimers = new Map<string, ReturnType<typeof setTimeout>>();
const meetingRetireTimers = new Map<string, ReturnType<typeof setTimeout>>();
const MIN_MEETING_STAY_MS = 10_000;

const zoneMigrationTimers = new Map<string, ReturnType<typeof setTimeout>>();
const confirmationTimers = new Map<string, ReturnType<typeof setTimeout>>();
const removedAgentIds = new Set<string>();
const REMOVED_IDS_TTL_MS = 30_000;
const UNCONFIRMED_TIMEOUT_MS = 5_000;
let meetingGatheringTimer: ReturnType<typeof setTimeout> | null = null;
let lastMeetingGroupsHash = "";
const MEETING_GATHERING_THROTTLE_MS = 500;

function isActiveStatus(status: AgentVisualStatus): boolean {
  return status === "thinking" || status === "tool_calling" || status === "speaking" || status === "spawning";
}

function getInitialChatDockHeight(): number {
  if (typeof window === "undefined") return DEFAULT_CHAT_DOCK_HEIGHT;
  const stored = localStorage.getItem(CHAT_DOCK_HEIGHT_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!Number.isNaN(parsed) && parsed >= 150 && parsed <= 800) return parsed;
  }
  return DEFAULT_CHAT_DOCK_HEIGHT;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return "dark";
}

function createVisualAgent(
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

function positionKey(pos: { x: number; y: number }): string {
  return `${pos.x},${pos.y}`;
}

function nextPlaceholderIndex(agents: Map<string, VisualAgent>): number {
  let maxIdx = -1;
  for (const a of agents.values()) {
    if (a.id.startsWith("placeholder-")) {
      const idx = parseInt(a.id.slice("placeholder-".length), 10);
      if (!Number.isNaN(idx) && idx > maxIdx) maxIdx = idx;
    }
  }
  return maxIdx + 1;
}

function allocateNextPosition(
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
function activateFromLoungePlaceholder(
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

export const useOfficeStore = create<OfficeStore>()(
  immer((set) => ({
    agents: new Map(),
    links: [],
    globalMetrics: {
      activeAgents: 0,
      totalAgents: 0,
      totalTokens: 0,
      tokenRate: 0,
      collaborationHeat: 0,
    },
    connectionStatus: "disconnected" as ConnectionStatus,
    connectionError: null,
    selectedAgentId: null,
    eventHistory: [],
    sidebarCollapsed: false,
    lastSessionsSnapshot: null,
    theme: getInitialTheme(),
    operatorScopes: [] as string[],
    tokenHistory: [] as TokenSnapshot[],
    agentCosts: {} as Record<string, number>,
    currentPage: "office" as PageId,
    chatDockHeight: getInitialChatDockHeight(),
    maxSubAgents: 8,
    agentToAgentConfig: { enabled: false, allow: [] } as AgentToAgentConfig,
    runIdMap: new Map(),
    sessionKeyMap: new Map(),

    addAgent: (agent: VisualAgent) => {
      set((state) => {
        state.agents.set(agent.id, agent);
        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    updateAgent: (id: string, patch: Partial<VisualAgent>) => {
      set((state) => {
        const agent = state.agents.get(id);
        if (agent) {
          Object.assign(agent, patch);
          state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
        }
      });
    },

    removeAgent: (id: string) => {
      set((state) => {
        state.agents.delete(id);
        if (state.selectedAgentId === id) {
          state.selectedAgentId = null;
        }
        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    addSubAgent: (parentId: string, info: SubAgentInfo) => {
      set((state) => {
        const existingAgent = state.agents.get(info.agentId);

        if (existingAgent && !existingAgent.confirmed) {
          // Agent was created as unconfirmed by processAgentEvent — now confirm as sub-agent.
          // Cancel its confirmation timeout.
          const timer = confirmationTimers.get(info.agentId);
          if (timer) {
            clearTimeout(timer);
            confirmationTimers.delete(info.agentId);
          }
          existingAgent.confirmed = true;
          existingAgent.isSubAgent = true;
          existingAgent.parentAgentId = parentId;
          existingAgent.name = info.label || existingAgent.name;
          // Transfer status/tool/speech to a lounge placeholder position for walk animation
          activateFromLoungePlaceholder(state, existingAgent);
        } else if (existingAgent && existingAgent.confirmed) {
          // Already confirmed — could have been wrongly confirmed as main by timeout.
          // Fix: re-tag as sub-agent and relocate to lounge→hotDesk.
          const wasMisclassified = !existingAgent.isSubAgent;
          existingAgent.isSubAgent = true;
          existingAgent.parentAgentId = parentId;
          existingAgent.name = info.label || existingAgent.name;
          if (wasMisclassified) {
            // Cancel any in-flight walk to desk
            existingAgent.movement = null;
            activateFromLoungePlaceholder(state, existingAgent);
          }
        } else {
          // Not yet seen — activate a lounge placeholder or create fresh
          let placeholder: VisualAgent | undefined;
          for (const a of state.agents.values()) {
            if (a.isPlaceholder && a.zone === "lounge") {
              placeholder = a;
              break;
            }
          }

          if (placeholder) {
            const oldId = placeholder.id;
            const startPos = { ...placeholder.position };
            state.agents.delete(oldId);

            placeholder.id = info.agentId;
            placeholder.name = info.label || `Sub-${info.agentId.slice(0, 6)}`;
            placeholder.isPlaceholder = false;
            placeholder.isSubAgent = true;
            placeholder.parentAgentId = parentId;
            placeholder.runId = info.sessionKey;
            placeholder.status = "idle";
            placeholder.position = startPos;
            placeholder.confirmed = true;
            placeholder.arrivedAtHotDeskAt = null;
            placeholder.pendingRetire = false;
            placeholder.arrivedAtMeetingAt = null;
            placeholder.manualMeeting = false;
            state.agents.set(info.agentId, placeholder);
          } else {
            const occupied = new Set<string>();
            for (const a of state.agents.values()) {
              occupied.add(positionKey(a.position));
            }
            const agent = createVisualAgent(
              info.agentId,
              info.label || `Sub-${info.agentId.slice(0, 6)}`,
              true,
              occupied,
            );
            agent.parentAgentId = parentId;
            agent.runId = info.sessionKey;
            agent.zone = "hotDesk";
            state.agents.set(info.agentId, agent);
          }
        }

        const parent = state.agents.get(parentId);
        if (parent && !parent.childAgentIds.includes(info.agentId)) {
          parent.childAgentIds.push(info.agentId);
        }

        // Establish sessionKey → agentId mapping so subsequent events route correctly
        if (info.sessionKey) {
          const existing = state.sessionKeyMap.get(info.sessionKey) ?? [];
          if (!existing.includes(info.agentId)) {
            existing.push(info.agentId);
            state.sessionKeyMap.set(info.sessionKey, existing);
          }
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
      // Post-set: trigger walk animation to hotDesk (from lounge, corridor, or misclassified desk)
      const agent = useOfficeStore.getState().agents.get(info.agentId);
      if (agent && agent.zone !== "hotDesk" && agent.zone !== "meeting") {
        useOfficeStore.getState().startMovement(info.agentId, "hotDesk");
      }
    },

    removeSubAgent: (subAgentId: string) => {
      cancelRetireTimer(subAgentId);
      const existingMigration = zoneMigrationTimers.get(subAgentId);
      if (existingMigration) {
        clearTimeout(existingMigration);
        zoneMigrationTimers.delete(subAgentId);
      }

      set((state) => {
        const sub = state.agents.get(subAgentId);
        if (sub?.parentAgentId) {
          const parent = state.agents.get(sub.parentAgentId);
          if (parent) {
            parent.childAgentIds = parent.childAgentIds.filter((id) => id !== subAgentId);
          }
        }

        // Track removed IDs and associated runIds/sessionKeys to prevent ghost recreation
        removedAgentIds.add(subAgentId);
        setTimeout(() => removedAgentIds.delete(subAgentId), REMOVED_IDS_TTL_MS);

        for (const [runId, aId] of state.runIdMap) {
          if (aId === subAgentId) {
            state.runIdMap.delete(runId);
            // Also block the runId itself as a fallback agentId
            removedAgentIds.add(runId);
            setTimeout(() => removedAgentIds.delete(runId), REMOVED_IDS_TTL_MS);
          }
        }
        for (const [sk, ids] of state.sessionKeyMap) {
          const filtered = ids.filter((id) => id !== subAgentId);
          if (filtered.length === 0) state.sessionKeyMap.delete(sk);
          else state.sessionKeyMap.set(sk, filtered);
        }

        // Restore as a new placeholder in lounge
        const loungePositions = calculateLoungePositions(state.maxSubAgents);
        const loungeOccupied = new Set<string>();
        for (const a of state.agents.values()) {
          if (a.zone === "lounge" && a.id !== subAgentId) {
            loungeOccupied.add(positionKey(a.position));
          }
        }
        const freeLounge = loungePositions.find((p) => !loungeOccupied.has(positionKey(p)));

        state.agents.delete(subAgentId);
        if (state.selectedAgentId === subAgentId) {
          state.selectedAgentId = null;
        }

        // Create replacement placeholder if lounge has room
        if (freeLounge) {
          const phIdx = nextPlaceholderIndex(state.agents);
          const phId = `placeholder-${phIdx}`;
          const ph: VisualAgent = {
            id: phId,
            name: `待命-${phIdx}`,
            status: "idle",
            position: freeLounge,
            currentTool: null,
            speechBubble: null,
            lastActiveAt: Date.now(),
            toolCallCount: 0,
            toolCallHistory: [],
            runId: null,
            isSubAgent: true,
            isPlaceholder: true,
            parentAgentId: null,
            childAgentIds: [],
            zone: "lounge",
            originalPosition: null,
            movement: null,
            confirmed: true,
            arrivedAtHotDeskAt: null,
            pendingRetire: false,
            arrivedAtMeetingAt: null,
            manualMeeting: false,
          };
          state.agents.set(phId, ph);
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    retireSubAgent: (subAgentId: string) => {
      const agent = useOfficeStore.getState().agents.get(subAgentId);
      if (!agent?.isSubAgent || agent.isPlaceholder || agent.pendingRetire) return;

      set((state) => {
        const a = state.agents.get(subAgentId);
        if (a) a.pendingRetire = true;
      });

      scheduleRetireAfterMinStay(subAgentId);
    },

    moveToMeeting: (agentId: string, meetingPosition: { x: number; y: number }) => {
      set((state) => {
        const agent = state.agents.get(agentId);
        if (agent) {
          if (!agent.originalPosition) {
            agent.originalPosition = { ...agent.position };
          }
        }
      });
      // Trigger walk animation to meeting position
      useOfficeStore.getState().startMovement(agentId, "meeting", meetingPosition);
    },

    returnFromMeeting: (agentId: string) => {
      // Cancel any pending meeting return timer
      const pendingTimer = meetingRetireTimers.get(agentId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        meetingRetireTimers.delete(agentId);
      }
      const agent = useOfficeStore.getState().agents.get(agentId);
      if (!agent?.originalPosition) return;
      const returnZone = agent.isSubAgent ? "hotDesk" : "desk";
      const returnPos = { ...agent.originalPosition };
      set((state) => {
        const a = state.agents.get(agentId);
        if (a) {
          a.originalPosition = null;
          a.arrivedAtMeetingAt = null;
          a.manualMeeting = false;
        }
      });
      useOfficeStore.getState().startMovement(agentId, returnZone, returnPos);
    },

    startMovement: (agentId: string, toZone: AgentZone, targetPos?: { x: number; y: number }) => {
      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent) return;
        // Don't start if already walking to the same zone
        if (agent.movement && agent.movement.toZone === toZone) return;

        const fromZone = agent.zone;
        const to =
          targetPos ??
          allocateNextPosition(state.agents, toZone, state.maxSubAgents);
        const path = planWalkPath(agent.position, to, fromZone, toZone);
        const duration = calculateWalkDuration(path);

        agent.movement = {
          path,
          progress: 0,
          duration,
          startTime: Date.now(),
          fromZone,
          toZone,
        };
      });
    },

    tickMovement: (agentId: string, deltaTime: number) => {
      let arrivedAtHotDesk = false;
      let arrivedAtLounge = false;
      let arrivedAtMeeting = false;

      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent?.movement) return;

        const progressDelta = deltaTime / agent.movement.duration;
        agent.movement.progress = Math.min(agent.movement.progress + progressDelta, 1);
        const pos = interpolatePathPosition(agent.movement.path, agent.movement.progress);
        agent.position = pos;

        if (agent.movement.progress >= 1) {
          const finalZone = agent.movement.toZone;
          const finalPos = agent.movement.path[agent.movement.path.length - 1];
          agent.movement = null;
          agent.zone = finalZone;
          agent.position = { ...finalPos };

          if (finalZone === "hotDesk" && agent.isSubAgent) {
            agent.arrivedAtHotDeskAt = Date.now();
            arrivedAtHotDesk = true;
          }
          if (finalZone === "meeting") {
            agent.arrivedAtMeetingAt = Date.now();
            arrivedAtMeeting = true;
          }
          if (finalZone === "lounge" && agent.isSubAgent && agent.pendingRetire) {
            arrivedAtLounge = true;
          }
        }
      });

      if (arrivedAtHotDesk) {
        const agent = useOfficeStore.getState().agents.get(agentId);
        if (agent?.pendingRetire) {
          scheduleRetireAfterMinStay(agentId);
        }
      }
      if (arrivedAtMeeting) {
        // No special action needed here; arrivedAtMeetingAt is set in state
        // scheduleMeetingReturn will use it when gathering triggers departure
      }
      if (arrivedAtLounge) {
        const agent = useOfficeStore.getState().agents.get(agentId);
        if (agent?.isSubAgent && !agent.isPlaceholder && agent.pendingRetire) {
          useOfficeStore.getState().removeSubAgent(agentId);
        }
      }
    },

    completeMovement: (agentId: string) => {
      let arrivedHotDesk = false;
      let arrivedLounge = false;
      let arrivedMeeting = false;

      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent?.movement) return;
        const finalZone = agent.movement.toZone;
        const finalPos = agent.movement.path[agent.movement.path.length - 1];
        agent.movement = null;
        agent.zone = finalZone;
        agent.position = { ...finalPos };

        if (finalZone === "hotDesk" && agent.isSubAgent) {
          agent.arrivedAtHotDeskAt = Date.now();
          arrivedHotDesk = true;
        }
        if (finalZone === "meeting") {
          agent.arrivedAtMeetingAt = Date.now();
          arrivedMeeting = true;
        }
        if (finalZone === "lounge" && agent.isSubAgent && agent.pendingRetire) {
          arrivedLounge = true;
        }
      });

      if (arrivedHotDesk) {
        const agent = useOfficeStore.getState().agents.get(agentId);
        if (agent?.pendingRetire) {
          scheduleRetireAfterMinStay(agentId);
        }
      }
      if (arrivedMeeting) {
        // arrivedAtMeetingAt is set; no additional action needed here
      }
      if (arrivedLounge) {
        const agent = useOfficeStore.getState().agents.get(agentId);
        if (agent?.isSubAgent && !agent.isPlaceholder && agent.pendingRetire) {
          useOfficeStore.getState().removeSubAgent(agentId);
        }
      }
    },

    prefillLoungePlaceholders: (count: number) => {
      set((state) => {
        const loungePositions = calculateLoungePositions(count);
        for (let i = 0; i < Math.min(count, loungePositions.length); i++) {
          const phId = `placeholder-${i}`;
          if (state.agents.has(phId)) continue;
          const ph: VisualAgent = {
            id: phId,
            name: `待命-${i}`,
            status: "idle",
            position: { ...loungePositions[i] },
            currentTool: null,
            speechBubble: null,
            lastActiveAt: Date.now(),
            toolCallCount: 0,
            toolCallHistory: [],
            runId: null,
            isSubAgent: true,
            isPlaceholder: true,
            parentAgentId: null,
            childAgentIds: [],
            zone: "lounge",
            originalPosition: null,
            movement: null,
            confirmed: true,
            arrivedAtHotDeskAt: null,
            pendingRetire: false,
            arrivedAtMeetingAt: null,
            manualMeeting: false,
          };
          state.agents.set(phId, ph);
        }
      });
    },

    confirmAgent: (agentId: string, role: "main" | "sub", parentId?: string) => {
      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent || agent.confirmed) return;
        agent.confirmed = true;

        const timer = confirmationTimers.get(agentId);
        if (timer) {
          clearTimeout(timer);
          confirmationTimers.delete(agentId);
        }

        if (role === "sub") {
          agent.isSubAgent = true;
          if (parentId) agent.parentAgentId = parentId;
          activateFromLoungePlaceholder(state, agent);
        } else {
          // Confirmed as main agent — assign to desk zone
          const occupied = new Set<string>();
          for (const a of state.agents.values()) {
            if (a.zone === "desk" && a.id !== agentId) occupied.add(positionKey(a.position));
          }
          agent.position = allocatePosition(agentId, false, occupied);
          agent.zone = "desk";
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
      // Post-set: trigger walk animation from corridor to target zone
      const agent = useOfficeStore.getState().agents.get(agentId);
      if (agent && !agent.movement) {
        if (role === "sub") {
          useOfficeStore.getState().startMovement(agentId, "hotDesk");
        } else {
          useOfficeStore.getState().startMovement(agentId, "desk");
        }
      }
    },

    setSessionsSnapshot: (snapshot: SessionSnapshot) => {
      set((state) => {
        state.lastSessionsSnapshot = snapshot;
      });
    },

    initAgents: (summaries: AgentSummary[]) => {
      set((state) => {
        state.agents.clear();
        state.runIdMap.clear();
        state.sessionKeyMap.clear();

        const occupied = new Set<string>();
        for (const summary of summaries) {
          const name = summary.identity?.name ?? summary.name ?? summary.id;
          const agent = createVisualAgent(summary.id, name, false, occupied);
          occupied.add(positionKey(agent.position));
          state.agents.set(summary.id, agent);
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
      // Prefill lounge with placeholder sub-agents
      useOfficeStore.getState().prefillLoungePlaceholders(
        useOfficeStore.getState().maxSubAgents,
      );
    },

    syncMainAgents: (summaries: AgentSummary[]) => {
      set((state) => {
        const incomingIds = new Set(summaries.map((s) => s.id));
        const occupied = new Set<string>();
        for (const a of state.agents.values()) {
          occupied.add(positionKey(a.position));
        }

        for (const summary of summaries) {
          const existing = state.agents.get(summary.id);
          if (existing) {
            const name = summary.identity?.name ?? summary.name ?? summary.id;
            if (existing.name !== name) existing.name = name;
          } else {
            const name = summary.identity?.name ?? summary.name ?? summary.id;
            const agent = createVisualAgent(summary.id, name, false, occupied);
            occupied.add(positionKey(agent.position));
            state.agents.set(summary.id, agent);
          }
        }

        // Remove main agents that no longer exist in the summary,
        // but never touch sub-agents, placeholders, or unconfirmed agents.
        for (const [id, agent] of state.agents) {
          if (!agent.isSubAgent && !agent.isPlaceholder && agent.confirmed && !incomingIds.has(id)) {
            state.agents.delete(id);
            if (state.selectedAgentId === id) state.selectedAgentId = null;
          }
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    processAgentEvent: (event: AgentEventPayload) => {
      const pendingSubAgentRef: {
        value: { parentId: string; info: SubAgentInfo } | null;
      } = { value: null };
      let newUnconfirmedId: string | null = null;
      let turnAroundToHotDesk: string | null = null;
      let resolvedSubAgentForRetire: string | null = null;

      set((state) => {
        const parsed = parseAgentEvent(event);

        const dataAgentId = event.data.agentId as string | undefined;
        const parentAgentId = event.data.parentAgentId as string | undefined;
        const isSubAgentStart =
          Boolean(dataAgentId) &&
          Boolean(parentAgentId) &&
          event.stream === "lifecycle" &&
          event.data.phase === "start";

        // Early sub-agent detection from sessionKey
        const sessionKeyHintEarly = event.sessionKey ?? "";
        const isSubAgentSession =
          sessionKeyHintEarly.includes(":subagent:") && !sessionKeyHintEarly.startsWith("announce:");

        // Resolve agentId — sub-agent events use a dedicated path to avoid
        // resolving to the parent agent that shares the same name prefix.
        let agentId: string | undefined;

        if (isSubAgentSession) {
          // Sub-agent event: use sub-agent–aware resolution
          // 1) runIdMap (continuing events for a known sub-agent)
          agentId = state.runIdMap.get(event.runId);
          // 2) sessionKeyMap (already registered sub-agent)
          if (!agentId) {
            const sessionAgents = state.sessionKeyMap.get(sessionKeyHintEarly);
            if (sessionAgents && sessionAgents.length > 0) {
              agentId = sessionAgents[0];
            }
          }
          // 3) Extract UUID from "agent:<parent>:subagent:<uuid>"
          if (!agentId) {
            const subMarker = ":subagent:";
            const subIdx = sessionKeyHintEarly.indexOf(subMarker);
            if (subIdx >= 0) {
              agentId = sessionKeyHintEarly.slice(subIdx + subMarker.length);
            }
          }
          // 4) Fallback: use runId
          if (!agentId) {
            agentId = event.runId;
          }
        } else {
          // Normal (non-sub-agent) event resolution:
          // 1) runIdMap (streaming chunks for known agent)
          agentId = state.runIdMap.get(event.runId);
          // 2) explicit payload agentId
          if (!agentId && dataAgentId) {
            agentId = dataAgentId;
          }
          // 3) sessionKeyMap (only if the session is associated with a confirmed agent)
          if (!agentId && event.sessionKey) {
            const sessionAgents = state.sessionKeyMap.get(event.sessionKey);
            if (sessionAgents && sessionAgents.length > 0) {
              agentId = sessionAgents[0];
            }
          }
          // 4) sessionKey pattern: "agent:<name>:main" → resolve <name> to a known agent
          if (!agentId && event.sessionKey) {
            const skAgentMatch = event.sessionKey.match(/^agent:([^:]+):/);
            if (skAgentMatch) {
              const agentName = skAgentMatch[1];
              for (const [id, a] of state.agents) {
                if (!a.isSubAgent && !a.isPlaceholder && (a.id === agentName || a.name === agentName)) {
                  agentId = id;
                  break;
                }
              }
            }
          }
          // 5) runId itself (fallback)
          if (!agentId) {
            agentId = event.runId;
          }
        }

        // Skip events for recently removed agents (stale scheduled events)
        if (removedAgentIds.has(agentId)) {
          return;
        }

        // Skip announce events — they're broadcast notifications, not real agents
        if (event.runId.startsWith("announce:")) {
          return;
        }

        // Detect sub-agent from sessionKey pattern (real Gateway: ":subagent:" in sessionKey)
        // or from explicit payload fields (mock adapter: parentAgentId + agentId)
        const parentFromSessionKey = isSubAgentSession
          ? extractParentFromSessionKey(state, sessionKeyHintEarly)
          : null;

        if (isSubAgentStart && dataAgentId && parentAgentId && !state.agents.has(dataAgentId)) {
          // Mock adapter provides explicit sub-agent info — create via addSubAgent post-set.
          // Use the agentId as the temporary label (real gateway label arrives via
          // sessionsList poller and overwrites this in `addSubAgent`).
          pendingSubAgentRef.value = {
            parentId: parentAgentId,
            info: {
              sessionKey: event.sessionKey ?? event.runId,
              agentId: dataAgentId,
              label: dataAgentId || `Sub-${dataAgentId.slice(0, 8)}`,
              task: "",
              requesterSessionKey: event.sessionKey ?? "",
              startedAt: event.ts,
            },
          };
        } else if (!state.agents.has(agentId) && isSubAgentSession && parentFromSessionKey) {
          // Real Gateway sub-agent detected from sessionKey pattern — create via addSubAgent.
          // The sessions_spawn label is not available in the event payload; the
          // sessions.list poller will overwrite name with the real label shortly.
          pendingSubAgentRef.value = {
            parentId: parentFromSessionKey,
            info: {
              sessionKey: sessionKeyHintEarly,
              agentId,
              label: agentId || `Sub-${agentId.slice(0, 8)}`,
              task: "",
              requesterSessionKey: sessionKeyHintEarly,
              startedAt: event.ts,
            },
          };
        } else if (!state.agents.has(agentId)) {
          // Unknown agent — check if this is from an initAgents-known agent ID
          const isKnownMainAgent = isRegisteredMainAgentId(state, agentId, event.sessionKey);

          if (isKnownMainAgent) {
            const occupied = new Set<string>();
            for (const a of state.agents.values()) {
              occupied.add(positionKey(a.position));
            }
            const agent = createVisualAgent(agentId, `Agent-${agentId.slice(0, 6)}`, false, occupied, true);
            agent.runId = event.runId;
            state.agents.set(agentId, agent);
          } else {
            // Create as unconfirmed — will be confirmed by poller or timeout
            const agent = createVisualAgent(agentId, `Agent-${agentId.slice(0, 6)}`, false, new Set(), false);
            agent.runId = event.runId;
            state.agents.set(agentId, agent);
            newUnconfirmedId = agentId;
          }

        }

        state.runIdMap.set(event.runId, agentId);

        if (event.sessionKey) {
          const existing = state.sessionKeyMap.get(event.sessionKey) ?? [];
          if (!existing.includes(agentId)) {
            existing.push(agentId);
            state.sessionKeyMap.set(event.sessionKey, existing);
          }
          updateCollaborationLinks(state, event.sessionKey, agentId);

          // Trigger meeting gathering when collaboration is detected
          // (works regardless of agentToAgent config — visual-only feature)
          scheduleMeetingGathering();
        }

        // A2A 工具事件检测：当主 Agent 使用 sessions_send/sessions_spawn 等工具指派其他主 Agent 时
        // 真实 Gateway 中 peer agent 使用完全不同的 sessionKey，因此只能通过工具事件检测协作关系
        if (
          event.stream === "tool" &&
          event.data.phase === "start" &&
          typeof event.data.name === "string" &&
          A2A_TOOL_NAMES.has(event.data.name) &&
          !isSubAgentSession
        ) {
          const toolInput = event.data.input as Record<string, unknown> | undefined;
          const targetSessionKey = toolInput?.sessionKey as string | undefined;
          if (targetSessionKey && !targetSessionKey.includes(":subagent:")) {
            // Resolve target agent from targetSessionKey
            let targetAgentId: string | null = null;

            // 1. Direct sessionKeyMap lookup
            const mapped = state.sessionKeyMap.get(targetSessionKey);
            if (mapped && mapped.length > 0) {
              targetAgentId = mapped[0];
            }

            // 2. Parse "agent:<name>:..." pattern to find agent by id/name
            if (!targetAgentId) {
              const targetAgentName = extractAgentIdFromSessionKey(targetSessionKey);
              if (targetAgentName) {
                for (const [id, a] of state.agents) {
                  if (!a.isSubAgent && !a.isPlaceholder && (a.id === targetAgentName || a.name === targetAgentName)) {
                    targetAgentId = id;
                    break;
                  }
                }
              }
            }

            if (targetAgentId && targetAgentId !== agentId) {
              createPeerCollaborationLink(state, agentId, targetAgentId);
              scheduleMeetingGathering();
            }
          }
        }

        if (event.stream === "assistant" && !isSubAgentSession) {
          const assistantText =
            (typeof event.data.text === "string" && event.data.text) ||
            (typeof event.data.delta === "string" && event.data.delta) ||
            "";
          const hintedPeerIds = detectPeerAgentHintsFromAssistantText(
            assistantText,
            agentId,
            state.agents.values(),
          );
          if (hintedPeerIds.length >= 2) {
            createPeerCollaborationLinksForAgents(state, hintedPeerIds);
            scheduleMeetingGathering();
          }
        }

        const agent = state.agents.get(agentId);
        if (agent) {
          const prevStatus = agent.status;
          applyEventToAgent(agent, parsed);

          // Sub-agent receives new active work → cancel pending retire + turn around
          if (agent.isSubAgent && agent.confirmed && isActiveStatus(parsed.status)) {
            if (agent.pendingRetire) {
              agent.pendingRetire = false;
              agent.arrivedAtHotDeskAt = null;
              cancelRetireTimer(agent.id);
            }
            // Walking back to lounge? Turn around to hotDesk
            if (agent.movement?.toZone === "lounge") {
              agent.movement = null;
              turnAroundToHotDesk = agent.id;
            }
            // Still in lounge without movement? Walk to hotDesk
            if (!agent.movement && agent.zone === "lounge") {
              turnAroundToHotDesk = agent.id;
            }
          }

          // Zone migration: lounge ↔ hotDesk for confirmed sub-agents only
          if (agent.isSubAgent && agent.confirmed && agent.zone !== "meeting") {
            scheduleZoneMigration(agent.id, prevStatus, agent.status);
          }
        }

        // Capture sub-agent lifecycle:end for post-set retirement
        if (
          event.stream === "lifecycle" &&
          event.data.phase === "end" &&
          agent?.isSubAgent &&
          !agent.isPlaceholder
        ) {
          resolvedSubAgentForRetire = agentId;
        }

        // Event history
        // assistant 流式输出：同一 runId 的后续 delta 合并到已有条目，避免泛滥
        if (event.stream === "assistant") {
          const fullText = (event.data.text as string) ?? parsed.summary;
          const summary = fullText.length > 60 ? `${fullText.slice(0, 60)}...` : fullText;

          // 从末尾向前查找同 runId 的 assistant 条目（遇到该 runId 的 lifecycle 则停止）
          let mergeIdx = -1;
          for (let i = state.eventHistory.length - 1; i >= 0; i--) {
            const h = state.eventHistory[i];
            if (h.runId === event.runId) {
              if (h.stream === "assistant") {
                mergeIdx = i;
              }
              // 遇到同 runId 的任何条目就停止（lifecycle:end 意味着本 run 已结束）
              break;
            }
          }

          if (mergeIdx >= 0) {
            // 更新已有条目，不新增、不重复存储
            state.eventHistory[mergeIdx].summary = summary;
            state.eventHistory[mergeIdx].fullText = fullText;
            state.eventHistory[mergeIdx].timestamp = event.ts;
          } else {
            // 首次出现该 runId 的 assistant 事件 — 新建条目
            const historyItem: EventHistoryItem = {
              runId: event.runId,
              timestamp: event.ts,
              agentId,
              agentName: agent?.name ?? agentId,
              stream: event.stream,
              summary,
              fullText,
            };
            state.eventHistory.push(historyItem);
            if (state.eventHistory.length > EVENT_HISTORY_LIMIT) {
              state.eventHistory = state.eventHistory.slice(-EVENT_HISTORY_LIMIT);
            }
            queueMicrotask(() => {
              localPersistence.saveEvent(historyItem).catch(() => {});
            });
          }
        } else if (event.stream === "item") {
          // item 流：按 itemId 合并，避免同一工具任务产生大量重复条目
          const itemId = event.data.itemId as string | undefined;
          const summary = parsed.summary;

          // 跳过空摘要事件（无意义的中间状态）
          if (!summary) {
            // do nothing
          } else if (itemId) {
            // 查找同 runId + 同 itemId 的已有 item 条目
            let mergeIdx = -1;
            for (let i = state.eventHistory.length - 1; i >= 0; i--) {
              const h = state.eventHistory[i];
              if (h.runId === event.runId && h.stream === "item" && h.itemId === itemId) {
                mergeIdx = i;
                break;
              }
            }

            if (mergeIdx >= 0) {
              state.eventHistory[mergeIdx].summary = summary;
              state.eventHistory[mergeIdx].timestamp = event.ts;
            } else {
              const historyItem: EventHistoryItem = {
                runId: event.runId,
                timestamp: event.ts,
                agentId,
                agentName: agent?.name ?? agentId,
                stream: event.stream,
                summary,
                itemId,
              };
              state.eventHistory.push(historyItem);
              if (state.eventHistory.length > EVENT_HISTORY_LIMIT) {
                state.eventHistory = state.eventHistory.slice(-EVENT_HISTORY_LIMIT);
              }
              queueMicrotask(() => {
                localPersistence.saveEvent(historyItem).catch(() => {});
              });
            }
          } else {
            const historyItem: EventHistoryItem = {
              runId: event.runId,
              timestamp: event.ts,
              agentId,
              agentName: agent?.name ?? agentId,
              stream: event.stream,
              summary,
            };
            state.eventHistory.push(historyItem);
            if (state.eventHistory.length > EVENT_HISTORY_LIMIT) {
              state.eventHistory = state.eventHistory.slice(-EVENT_HISTORY_LIMIT);
            }
            queueMicrotask(() => {
              localPersistence.saveEvent(historyItem).catch(() => {});
            });
          }
        } else {
          // 跳过空摘要事件（unknown stream 等无意义状态不写入历史）
          if (!parsed.summary) {
            // do nothing
          } else {
            const historyItem: EventHistoryItem = {
              runId: event.runId,
              timestamp: event.ts,
              agentId,
              agentName: agent?.name ?? agentId,
              stream: event.stream,
              summary: parsed.summary,
            };
            state.eventHistory.push(historyItem);
            if (state.eventHistory.length > EVENT_HISTORY_LIMIT) {
              state.eventHistory = state.eventHistory.slice(-EVENT_HISTORY_LIMIT);
            }
            // Non-blocking persistence to IndexedDB
            queueMicrotask(() => {
              localPersistence.saveEvent(historyItem).catch(() => {});
            });
          }
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });

      // Post-set: sub-agent received new work while retreating → turn around to hotDesk
      if (turnAroundToHotDesk) {
        useOfficeStore.getState().startMovement(turnAroundToHotDesk, "hotDesk");
      }

      // Post-set: create sub-agent via addSubAgent (mock adapter path)
      const subToCreate = pendingSubAgentRef.value;
      if (subToCreate) {
        useOfficeStore.getState().addSubAgent(subToCreate.parentId, subToCreate.info);
      }

      // Schedule auto-confirmation timeout for unconfirmed agents
      if (newUnconfirmedId) {
        const id = newUnconfirmedId;
        const timer = setTimeout(() => {
          confirmationTimers.delete(id);
          const store = useOfficeStore.getState();
          const a = store.agents.get(id);
          if (a && !a.confirmed) {
            store.confirmAgent(id, "main");
          }
        }, UNCONFIRMED_TIMEOUT_MS);
        confirmationTimers.set(id, timer);
      }

      // Sub-agent lifecycle end — retire via unified state machine
      if (resolvedSubAgentForRetire) {
        useOfficeStore.getState().retireSubAgent(resolvedSubAgentForRetire);
      }
    },

    deferredSetIdle: (agentId: string) => {
      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent) return;

        agent.status = "idle";
        agent.currentTool = null;
        agent.speechBubble = null;

        if (agent.isSubAgent && agent.confirmed && agent.zone !== "meeting") {
          scheduleZoneMigration(agent.id, "thinking", "idle");
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    selectAgent: (id: string | null) => {
      set((state) => {
        state.selectedAgentId = state.selectedAgentId === id ? null : id;
      });
    },

    setConnectionStatus: (status: ConnectionStatus, error?: string) => {
      set((state) => {
        state.connectionStatus = status;
        state.connectionError = error ?? null;
      });
    },

    setSidebarCollapsed: (collapsed: boolean) => {
      set((state) => {
        state.sidebarCollapsed = collapsed;
      });
    },

    setTheme: (theme: ThemeMode) => {
      set((state) => {
        state.theme = theme;
      });
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // localStorage unavailable
      }
    },

    setOperatorScopes: (scopes: string[]) => {
      set((state) => {
        state.operatorScopes = scopes;
      });
    },

    pushTokenSnapshot: (snapshot: TokenSnapshot) => {
      set((state) => {
        const previous = state.tokenHistory[state.tokenHistory.length - 1];
        state.tokenHistory.push(snapshot);
        if (state.tokenHistory.length > 30) {
          state.tokenHistory = state.tokenHistory.slice(-30);
        }
        const elapsedMinutes = previous ? (snapshot.timestamp - previous.timestamp) / 60_000 : 0;
        const tokenRate =
          elapsedMinutes > 0 ? Math.max(0, (snapshot.total - previous.total) / elapsedMinutes) : 0;
        state.globalMetrics.totalTokens = snapshot.total;
        state.globalMetrics.tokenRate = Number.isFinite(tokenRate) ? tokenRate : 0;
      });
    },

    setAgentCosts: (costs: Record<string, number>) => {
      set((state) => {
        state.agentCosts = costs;
      });
    },

    setCurrentPage: (page: PageId) => {
      set((state) => {
        state.currentPage = page;
      });
    },

    setChatDockHeight: (height: number) => {
      set((state) => {
        state.chatDockHeight = height;
      });
      try {
        localStorage.setItem(CHAT_DOCK_HEIGHT_KEY, String(height));
      } catch {
        // localStorage unavailable
      }
    },

    setMaxSubAgents: (n: number) => {
      set((state) => {
        if (n >= 1 && n <= 50) {
          state.maxSubAgents = n;
        }
      });
    },

    setAgentToAgentConfig: (config: AgentToAgentConfig) => {
      set((state) => {
        state.agentToAgentConfig = config;
      });
    },

    initEventHistory: async () => {
      try {
        await localPersistence.open();
        const cached = await localPersistence.getEvents(EVENT_HISTORY_LIMIT);
        if (cached.length > 0) {
          set((state) => {
            state.eventHistory = cached;
          });
        }
        // Schedule cleanup for stale data
        localPersistence.cleanup().catch(() => {});
      } catch {
        // IndexedDB unavailable — pure memory mode
      }
    },

    updateMetrics: () => {
      set((state) => {
        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    requestMeeting: (agentIds: string[]) => {
      const currentState = useOfficeStore.getState();
      const allIds = Array.from(currentState.agents.entries())
        .filter(([, a]) => !a.isPlaceholder && a.confirmed)
        .map(([id]) => id);

      const matched = fuzzyMatchAgentIds(agentIds, allIds, "requestMeeting");
      const toMove = matched.filter((id) => {
        const a = currentState.agents.get(id);
        return a && a.zone !== "meeting" && a.movement?.toZone !== "meeting";
      });

      if (toMove.length === 0) return;

      const tableCenter = {
        x: ZONES.meeting.x + ZONES.meeting.width / 2,
        y: ZONES.meeting.y + ZONES.meeting.height / 2,
      };
      const seats = allocateMeetingPositions(toMove, tableCenter);

      // Mark as manual meeting first
      set((state) => {
        for (const agentId of toMove) {
          const a = state.agents.get(agentId);
          if (a) a.manualMeeting = true;
        }
      });

      // Move each agent to their allocated seat
      for (let i = 0; i < toMove.length; i++) {
        useOfficeStore.getState().moveToMeeting(toMove[i], seats[i]);
      }
    },

    dismissMeeting: (agentIds?: string[]) => {
      const currentState = useOfficeStore.getState();

      let toDismiss: string[];
      if (!agentIds || agentIds.length === 0) {
        // Dismiss all agents currently in or walking to meeting zone
        toDismiss = Array.from(currentState.agents.entries())
          .filter(
            ([, a]) => a.zone === "meeting" || a.movement?.toZone === "meeting",
          )
          .map(([id]) => id);
      } else {
        const allIds = Array.from(currentState.agents.entries())
          .filter(([, a]) => !a.isPlaceholder && a.confirmed)
          .map(([id]) => id);
        const matched = fuzzyMatchAgentIds(agentIds, allIds, "dismissMeeting");
        toDismiss = matched.filter((id) => {
          const a = currentState.agents.get(id);
          return a && (a.zone === "meeting" || a.movement?.toZone === "meeting");
        });
      }

      for (const agentId of toDismiss) {
        useOfficeStore.getState().returnFromMeeting(agentId);
      }
    },
  })),
);

setDeferredIdleCallback((agentId: string) => {
  useOfficeStore.getState().deferredSetIdle(agentId);
});

/**
 * Check if the given agentId is likely a registered main agent.
 * A main agent's sessionKey typically appears in the sessionKeyMap pointing
 * to an existing confirmed agent, or the agentId itself matches a known agent.
 * This prevents main agents with new runIds from becoming unconfirmed.
 */
function isRegisteredMainAgentId(
  state: { agents: Map<string, VisualAgent>; sessionKeyMap: Map<string, string[]> },
  agentId: string,
  sessionKey?: string,
): boolean {
  // If the sessionKey already maps to a confirmed main agent, this is likely the same agent
  // with a new runId. But the agentId is different from what we know → it's a new agent.
  // However, if the agentId looks like one of our known agent IDs, trust it.
  for (const a of state.agents.values()) {
    if (!a.isSubAgent && !a.isPlaceholder && a.confirmed && a.id === agentId) {
      return true;
    }
  }
  // If sessionKey maps to a known main agent, this could be a sub-agent sharing the same session
  if (sessionKey) {
    const mapped = state.sessionKeyMap.get(sessionKey);
    if (mapped) {
      for (const mid of mapped) {
        const ma = state.agents.get(mid);
        if (ma && !ma.isSubAgent && ma.confirmed) {
          // Session belongs to a known main agent but agentId differs → likely sub-agent
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
function extractParentFromSessionKey(
  state: { agents: Map<string, VisualAgent>; sessionKeyMap: Map<string, string[]> },
  sessionKey: string,
): string | null {
  // Parse "agent:<name>:subagent:..." → find parent agent "<name>"
  const parts = sessionKey.split(":");
  const subIdx = parts.indexOf("subagent");
  if (subIdx >= 2) {
    const parentName = parts.slice(1, subIdx).join(":");

    // Try known sessionKey patterns for the parent
    for (const [sk, mapped] of state.sessionKeyMap) {
      if (sk.startsWith(`agent:${parentName}:`) && !sk.includes(":subagent:") && mapped.length > 0) {
        return mapped[0];
      }
    }

    // Fallback: find agent whose id or name matches parentName
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

function updateCollaborationLinks(
  state: { links: CollaborationLink[]; sessionKeyMap: Map<string, string[]> },
  sessionKey: string,
  agentId: string,
): void {
  const agents = state.sessionKeyMap.get(sessionKey);
  if (!agents || agents.length < 2) {
    // Try namespace-based matching for parent↔sub-agent and same-namespace scenarios
    const ns = extractSessionNamespace(sessionKey);
    if (ns) {
      const nsAgents = new Set<string>();
      // Include the current agent being processed (e.g. a sub-agent)
      nsAgents.add(agentId);
      for (const [sk, ids] of state.sessionKeyMap) {
        if (extractSessionNamespace(sk) === ns && !sk.includes(":subagent:")) {
          for (const id of ids) nsAgents.add(id);
        }
      }
      if (nsAgents.size >= 2) {
        // Build links between all agents in the same namespace
        const nsAgentList = Array.from(nsAgents);
        const now = Date.now();
        for (let i = 0; i < nsAgentList.length; i++) {
          for (let j = i + 1; j < nsAgentList.length; j++) {
            const a = nsAgentList[i];
            const b = nsAgentList[j];
            const existingIdx = state.links.findIndex(
              (l) =>
                l.sessionKey === sessionKey &&
                ((l.sourceId === a && l.targetId === b) || (l.sourceId === b && l.targetId === a)),
            );
            if (existingIdx >= 0) {
              state.links[existingIdx].lastActivityAt = now;
              state.links[existingIdx].strength = Math.min(
                state.links[existingIdx].strength + 0.1,
                1,
              );
            } else {
              state.links.push({
                sourceId: a,
                targetId: b,
                sessionKey,
                strength: 0.3,
                lastActivityAt: now,
              });
            }
          }
        }
        state.links = state.links.filter((l) => now - l.lastActivityAt < LINK_TIMEOUT_MS);
      }
    }
    return;
  }

  const now = Date.now();
  for (const otherId of agents) {
    if (otherId === agentId) {
      continue;
    }

    const existingIdx = state.links.findIndex(
      (l) =>
        l.sessionKey === sessionKey &&
        ((l.sourceId === agentId && l.targetId === otherId) ||
          (l.sourceId === otherId && l.targetId === agentId)),
    );

    if (existingIdx >= 0) {
      const link = state.links[existingIdx];
      link.lastActivityAt = now;
      link.strength = Math.min(link.strength + 0.1, 1);
    } else {
      state.links.push({
        sourceId: agentId,
        targetId: otherId,
        sessionKey,
        strength: 0.3,
        lastActivityAt: now,
      });
    }
  }

  // Decay stale links
  state.links = state.links.filter((l) => now - l.lastActivityAt < LINK_TIMEOUT_MS);
}

/**
 * Create a direct peer collaboration link between two main agents.
 * Used when an A2A tool event (sessions_send, sessions_spawn, etc.) is detected.
 * These links bypass sessionKey matching since peer agents use different session keys.
 */
function createPeerCollaborationLink(
  state: { links: CollaborationLink[]; agents: Map<string, VisualAgent> },
  sourceId: string,
  targetId: string,
): void {
  if (sourceId === targetId) return;
  const source = state.agents.get(sourceId);
  const target = state.agents.get(targetId);
  if (!source || !target) return;
  // Only link main agents (not sub-agents) for meeting zone
  if (source.isSubAgent || target.isSubAgent) return;

  const peerSessionKey = `peer:${[sourceId, targetId].sort().join(":")}`;
  const now = Date.now();

  const existingIdx = state.links.findIndex(
    (l) =>
      (l.sourceId === sourceId && l.targetId === targetId) ||
      (l.sourceId === targetId && l.targetId === sourceId),
  );

  if (existingIdx >= 0) {
    state.links[existingIdx].lastActivityAt = now;
    state.links[existingIdx].strength = Math.min(state.links[existingIdx].strength + 0.15, 1);
    state.links[existingIdx].isPeer = true;
  } else {
    state.links.push({
      sourceId,
      targetId,
      sessionKey: peerSessionKey,
      strength: 0.5, // Start above threshold immediately
      lastActivityAt: now,
      isPeer: true,
    });
  }

  // Decay stale links
  state.links = state.links.filter((l) => now - l.lastActivityAt < LINK_TIMEOUT_MS);
}

function createPeerCollaborationLinksForAgents(
  state: { links: CollaborationLink[]; agents: Map<string, VisualAgent> },
  agentIds: string[],
): void {
  for (let i = 0; i < agentIds.length; i += 1) {
    for (let j = i + 1; j < agentIds.length; j += 1) {
      createPeerCollaborationLink(state, agentIds[i]!, agentIds[j]!);
    }
  }
}

function scheduleMeetingGathering(): void {
  if (meetingGatheringTimer) return;
  meetingGatheringTimer = setTimeout(() => {
    meetingGatheringTimer = null;
    const state = useOfficeStore.getState();

    const allowList = state.agentToAgentConfig.enabled
      ? state.agentToAgentConfig.allow
      : undefined;
    const groups = detectMeetingGroups(
      state.links,
      state.agents,
      allowList,
    );
    const hash = JSON.stringify(groups.map((g) => g.agentIds.sort()));
    if (hash === lastMeetingGroupsHash) return;
    lastMeetingGroupsHash = hash;

    applyMeetingGathering(
      state.agents,
      groups,
      (id, pos) => useOfficeStore.getState().moveToMeeting(id, pos),
      (id) => useOfficeStore.getState().returnFromMeeting(id),
      (id) => scheduleMeetingReturn(id),
    );
  }, MEETING_GATHERING_THROTTLE_MS);
}

function scheduleZoneMigration(
  agentId: string,
  prevStatus: AgentVisualStatus,
  newStatus: AgentVisualStatus,
): void {
  const existingTimer = zoneMigrationTimers.get(agentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    zoneMigrationTimers.delete(agentId);
  }

  const wasActive = isActiveStatus(prevStatus);
  const nowActive = isActiveStatus(newStatus);

  if (!wasActive && nowActive) {
    // lounge → hotDesk with debounce
    const timer = setTimeout(() => {
      zoneMigrationTimers.delete(agentId);
      migrateAgentToHotDesk(agentId);
    }, LOUNGE_TO_HOTDESK_DEBOUNCE_MS);
    zoneMigrationTimers.set(agentId, timer);
  } else if (wasActive && !nowActive && newStatus === "idle") {
    // hotDesk → lounge after sustained idle
    const timer = setTimeout(() => {
      zoneMigrationTimers.delete(agentId);
      migrateAgentToLounge(agentId);
    }, HOTDESK_TO_LOUNGE_DELAY_MS);
    zoneMigrationTimers.set(agentId, timer);
  }
}

function migrateAgentToHotDesk(agentId: string): void {
  const state = useOfficeStore.getState();
  const agent = state.agents.get(agentId);
  if (!agent || !agent.isSubAgent || agent.zone !== "lounge") return;
  if (agent.movement?.toZone === "hotDesk") return;

  useOfficeStore.getState().startMovement(agentId, "hotDesk");
}

function migrateAgentToLounge(agentId: string): void {
  const state = useOfficeStore.getState();
  const agent = state.agents.get(agentId);
  if (!agent || !agent.isSubAgent || agent.zone !== "hotDesk") return;
  if (isActiveStatus(agent.status)) return;
  if (agent.movement?.toZone === "lounge") return;
  if (agent.pendingRetire) return;

  useOfficeStore.getState().startMovement(agentId, "lounge");
}

function cancelRetireTimer(agentId: string): void {
  const timer = subAgentRetireTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    subAgentRetireTimers.delete(agentId);
  }
}

/**
 * Central retire scheduling for sub-agents.
 * Enforces: must stay at hotDesk >= MIN_HOTDESK_STAY_MS before walking back.
 *
 * Possible states when called:
 * - Still walking TO hotDesk → will be re-invoked by tickMovement on arrival
 * - At hotDesk, arrived recently → schedule timer for remaining wait
 * - At hotDesk, stayed long enough → start walk back immediately
 * - At lounge (never made it) → remove immediately
 */
function scheduleRetireAfterMinStay(agentId: string): void {
  cancelRetireTimer(agentId);

  const agent = useOfficeStore.getState().agents.get(agentId);
  if (!agent?.isSubAgent || agent.isPlaceholder || !agent.pendingRetire) return;

  // Still walking to hotDesk — tickMovement will re-invoke on arrival
  if (agent.movement?.toZone === "hotDesk") return;

  // Sitting at hotDesk — check minimum stay
  if (agent.zone === "hotDesk") {
    const arrived = agent.arrivedAtHotDeskAt ?? Date.now();
    const elapsed = Date.now() - arrived;
    const remaining = MIN_HOTDESK_STAY_MS - elapsed;

    if (remaining > 0) {
      const timer = setTimeout(() => {
        subAgentRetireTimers.delete(agentId);
        scheduleRetireAfterMinStay(agentId);
      }, remaining);
      subAgentRetireTimers.set(agentId, timer);
      return;
    }

    // Min stay satisfied → walk back to lounge (removal happens on arrival)
    useOfficeStore.getState().startMovement(agentId, "lounge");
    return;
  }

  // Agent is in lounge (hasn't walked to hotDesk yet, or walk hasn't started).
  // Instead of removing immediately, send it to hotDesk first so the user
  // sees the full walk-in → stay → walk-out animation cycle.
  if (agent.zone === "lounge" && !agent.movement) {
    useOfficeStore.getState().startMovement(agentId, "hotDesk");
    return;
  }

  // Walking to lounge already — tickMovement will handle removal on arrival
}

/**
 * Schedule a meeting return for a main agent, enforcing the minimum 10s stay.
 * Called instead of returnFromMeeting when applyMeetingGathering detects an agent should leave.
 *
 * Possible states:
 * - Still walking TO meeting → record intent, re-invoke once arrived (tickMovement sets arrivedAtMeetingAt)
 * - At meeting, arrived recently → schedule timer for remaining wait
 * - At meeting, stayed long enough → return immediately
 */
function scheduleMeetingReturn(agentId: string): void {
  // Cancel any existing timer
  const existingTimer = meetingRetireTimers.get(agentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    meetingRetireTimers.delete(agentId);
  }

  const agent = useOfficeStore.getState().agents.get(agentId);
  if (!agent) return;
  // Don't return agents that are already leaving or gone
  if (agent.zone !== "meeting" && agent.movement?.toZone !== "meeting") return;
  // Skip manual meeting agents
  if (agent.manualMeeting) return;

  // Still walking to meeting — schedule a follow-up check after expected arrival
  if (agent.movement?.toZone === "meeting") {
    const remaining = agent.movement.duration * (1 - agent.movement.progress) + MIN_MEETING_STAY_MS;
    const timer = setTimeout(() => {
      meetingRetireTimers.delete(agentId);
      scheduleMeetingReturn(agentId);
    }, remaining);
    meetingRetireTimers.set(agentId, timer);
    return;
  }

  // At meeting — check minimum stay
  if (agent.zone === "meeting") {
    const arrived = agent.arrivedAtMeetingAt ?? Date.now();
    const elapsed = Date.now() - arrived;
    const remaining = MIN_MEETING_STAY_MS - elapsed;

    if (remaining > 0) {
      const timer = setTimeout(() => {
        meetingRetireTimers.delete(agentId);
        scheduleMeetingReturn(agentId);
      }, remaining);
      meetingRetireTimers.set(agentId, timer);
      return;
    }

    // Min stay satisfied → return to original zone
    useOfficeStore.getState().returnFromMeeting(agentId);
  }
}
