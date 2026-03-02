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
  ViewMode,
  VisualAgent,
} from "@/gateway/types";
import { ZONES, CORRIDOR_ENTRANCE } from "@/lib/constants";
import { allocatePosition, calculateLoungePositions } from "@/lib/position-allocator";
import {
  planWalkPath,
  calculateWalkDuration,
  interpolatePathPosition,
} from "@/lib/movement-animator";
import { applyEventToAgent } from "./agent-reducer";
import { applyMeetingGathering, detectMeetingGroups } from "./meeting-manager";
import { computeMetrics } from "./metrics-reducer";

const EVENT_HISTORY_LIMIT = 200;
const LINK_TIMEOUT_MS = 60_000;
const THEME_STORAGE_KEY = "openclaw-theme";
const CHAT_DOCK_HEIGHT_KEY = "openclaw-chat-dock-height";
const DEFAULT_CHAT_DOCK_HEIGHT = 300;
const LOUNGE_TO_HOTDESK_DEBOUNCE_MS = 500;
const HOTDESK_TO_LOUNGE_DELAY_MS = 30_000;

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

function getInitialBloom(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.devicePixelRatio >= 1.5;
}

function createVisualAgent(
  id: string,
  name: string,
  isSubAgent: boolean,
  occupied: Set<string>,
  confirmed = true,
): VisualAgent {
  if (!confirmed) {
    // Unconfirmed agent: place at corridor entrance, not assigned to any zone yet
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
    zone: "desk" as const,
    originalPosition: null,
    movement: null,
    confirmed: true,
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
    viewMode: "2d" as ViewMode,
    eventHistory: [],
    sidebarCollapsed: false,
    lastSessionsSnapshot: null,
    theme: getInitialTheme(),
    bloomEnabled: getInitialBloom(),
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
          // Already confirmed (e.g. second poll cycle) — just update parent/name
          if (!existingAgent.isSubAgent) existingAgent.isSubAgent = true;
          existingAgent.parentAgentId = parentId;
          existingAgent.name = info.label || existingAgent.name;
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
      // Post-set: trigger walk animation lounge → hotDesk
      const agent = useOfficeStore.getState().agents.get(info.agentId);
      if (agent && (agent.zone === "lounge" || agent.zone === "corridor") && !agent.movement) {
        useOfficeStore.getState().startMovement(info.agentId, "hotDesk");
      }
    },

    removeSubAgent: (subAgentId: string) => {
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
          };
          state.agents.set(phId, ph);
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
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
      const agent = useOfficeStore.getState().agents.get(agentId);
      if (!agent?.originalPosition) return;
      const returnZone = agent.isSubAgent ? "hotDesk" : "desk";
      const returnPos = { ...agent.originalPosition };
      set((state) => {
        const a = state.agents.get(agentId);
        if (a) {
          a.originalPosition = null;
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
        }
      });
    },

    completeMovement: (agentId: string) => {
      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent?.movement) return;
        const finalZone = agent.movement.toZone;
        const finalPos = agent.movement.path[agent.movement.path.length - 1];
        agent.movement = null;
        agent.zone = finalZone;
        agent.position = { ...finalPos };
      });
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

    processAgentEvent: (event: AgentEventPayload) => {
      const pendingSubAgentRef: {
        value: { parentId: string; info: SubAgentInfo } | null;
      } = { value: null };
      let newUnconfirmedId: string | null = null;

      set((state) => {
        const parsed = parseAgentEvent(event);

        const dataAgentId = event.data.agentId as string | undefined;
        const parentAgentId = event.data.parentAgentId as string | undefined;
        const isSubAgentStart =
          Boolean(dataAgentId) &&
          Boolean(parentAgentId) &&
          event.stream === "lifecycle" &&
          event.data.phase === "start";

        // Resolve agentId:
        // 1) runIdMap (streaming chunks for known agent)
        // 2) explicit payload agentId
        // 3) sessionKeyMap (only if the session is associated with a confirmed agent)
        // 4) runId itself (fallback)
        let agentId = state.runIdMap.get(event.runId);
        if (!agentId && dataAgentId) {
          agentId = dataAgentId;
        }
        if (!agentId && event.sessionKey) {
          const sessionAgents = state.sessionKeyMap.get(event.sessionKey);
          if (sessionAgents && sessionAgents.length > 0) {
            agentId = sessionAgents[0];
          }
        }
        if (!agentId) {
          agentId = event.runId;
        }

        // Skip events for recently removed agents (stale scheduled events)
        if (removedAgentIds.has(agentId)) {
          return;
        }

        if (isSubAgentStart && dataAgentId && parentAgentId && !state.agents.has(dataAgentId)) {
          // Mock adapter provides explicit sub-agent info — create via addSubAgent post-set
          pendingSubAgentRef.value = {
            parentId: parentAgentId,
            info: {
              sessionKey: event.sessionKey ?? event.runId,
              agentId: dataAgentId,
              label: `Sub-${dataAgentId.slice(0, 8)}`,
              task: "",
              requesterSessionKey: event.sessionKey ?? "",
              startedAt: event.ts,
            },
          };
        } else if (!state.agents.has(agentId)) {
          // Unknown agent — check if this is from an initAgents-known agent ID
          // (i.e. a confirmed main agent whose ID we know from agents.list).
          // If the agentId matches a known main agent name pattern, create as confirmed.
          // Otherwise create as UNCONFIRMED in the corridor — poller will confirm.
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

          if (state.agentToAgentConfig.enabled) {
            scheduleMeetingGathering();
          }
        }

        const agent = state.agents.get(agentId);
        if (agent) {
          const prevStatus = agent.status;
          applyEventToAgent(agent, parsed);

          // Zone migration: lounge ↔ hotDesk for confirmed sub-agents only
          if (agent.isSubAgent && agent.confirmed && agent.zone !== "meeting") {
            scheduleZoneMigration(agent.id, prevStatus, agent.status);
          }
        }

        // Event history
        const historyItem: EventHistoryItem = {
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

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });

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

      // Sub-agent lifecycle end via explicit payload (mock adapter)
      if (
        event.stream === "lifecycle" &&
        event.data.phase === "end" &&
        event.data.agentId
      ) {
        const endId = event.data.agentId as string;
        const sub = useOfficeStore.getState().agents.get(endId);
        if (sub?.isSubAgent && !sub.isPlaceholder) {
          useOfficeStore.getState().removeSubAgent(endId);
        }
      }
    },

    selectAgent: (id: string | null) => {
      set((state) => {
        state.selectedAgentId = state.selectedAgentId === id ? null : id;
      });
    },

    setViewMode: (mode: ViewMode) => {
      set((state) => {
        state.viewMode = mode;
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

    setBloomEnabled: (enabled: boolean) => {
      set((state) => {
        state.bloomEnabled = enabled;
      });
    },

    setOperatorScopes: (scopes: string[]) => {
      set((state) => {
        state.operatorScopes = scopes;
      });
    },

    pushTokenSnapshot: (snapshot: TokenSnapshot) => {
      set((state) => {
        state.tokenHistory.push(snapshot);
        if (state.tokenHistory.length > 30) {
          state.tokenHistory = state.tokenHistory.slice(-30);
        }
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
  })),
);

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

function updateCollaborationLinks(
  state: { links: CollaborationLink[]; sessionKeyMap: Map<string, string[]> },
  sessionKey: string,
  agentId: string,
): void {
  const agents = state.sessionKeyMap.get(sessionKey);
  if (!agents || agents.length < 2) {
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

function scheduleMeetingGathering(): void {
  if (meetingGatheringTimer) return;
  meetingGatheringTimer = setTimeout(() => {
    meetingGatheringTimer = null;
    const state = useOfficeStore.getState();
    if (!state.agentToAgentConfig.enabled) return;

    const groups = detectMeetingGroups(
      state.links,
      state.agents,
      state.agentToAgentConfig.allow,
    );
    const hash = JSON.stringify(groups.map((g) => g.agentIds.sort()));
    if (hash === lastMeetingGroupsHash) return;
    lastMeetingGroupsHash = hash;

    applyMeetingGathering(
      state.agents,
      groups,
      (id, pos) => useOfficeStore.getState().moveToMeeting(id, pos),
      (id) => useOfficeStore.getState().returnFromMeeting(id),
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

  useOfficeStore.getState().startMovement(agentId, "lounge");
}
