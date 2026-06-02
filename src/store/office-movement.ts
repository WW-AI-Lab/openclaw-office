import type { AgentVisualStatus, AgentZone, VisualAgent } from "@/gateway/types";

const LOUNGE_TO_HOTDESK_DEBOUNCE_MS = 300;
const HOTDESK_TO_LOUNGE_DELAY_MS = 30_000;
const MIN_HOTDESK_STAY_MS = 10_000;
const MIN_MEETING_STAY_MS = 10_000;

const subAgentRetireTimers = new Map<string, ReturnType<typeof setTimeout>>();
const meetingRetireTimers = new Map<string, ReturnType<typeof setTimeout>>();
const zoneMigrationTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function isActiveStatus(status: AgentVisualStatus): boolean {
  return status === "thinking" || status === "tool_calling" || status === "speaking" || status === "spawning";
}

/** Store getter set by office-store.ts to avoid circular imports. */
type StoreState = {
  agents: Map<string, VisualAgent>;
  startMovement: (agentId: string, toZone: AgentZone, pos?: { x: number; y: number }) => void;
  removeSubAgent: (agentId: string) => void;
  returnFromMeeting: (agentId: string) => void;
};

let getStoreState: (() => StoreState) | null = null;

export function setMovementStoreGetter(fn: () => StoreState): void {
  getStoreState = fn;
}

export function scheduleZoneMigration(
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
  if (!getStoreState) return;
  const state = getStoreState();
  const agent = state.agents.get(agentId);
  if (!agent || !agent.isSubAgent || agent.zone !== "lounge") return;
  if (agent.movement?.toZone === "hotDesk") return;

  state.startMovement(agentId, "hotDesk");
}

function migrateAgentToLounge(agentId: string): void {
  if (!getStoreState) return;
  const state = getStoreState();
  const agent = state.agents.get(agentId);
  if (!agent || !agent.isSubAgent || agent.zone !== "hotDesk") return;
  if (isActiveStatus(agent.status)) return;
  if (agent.movement?.toZone === "lounge") return;
  if (agent.pendingRetire) return;

  state.startMovement(agentId, "lounge");
}

export function cancelRetireTimer(agentId: string): void {
  const timer = subAgentRetireTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    subAgentRetireTimers.delete(agentId);
  }
}

export function cancelMigrationTimer(agentId: string): void {
  const existingTimer = zoneMigrationTimers.get(agentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    zoneMigrationTimers.delete(agentId);
  }
}

export function cancelMeetingReturnTimer(agentId: string): void {
  const existingTimer = meetingRetireTimers.get(agentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    meetingRetireTimers.delete(agentId);
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
export function scheduleRetireAfterMinStay(agentId: string): void {
  cancelRetireTimer(agentId);
  if (!getStoreState) return;

  const agent = getStoreState().agents.get(agentId);
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
    getStoreState().startMovement(agentId, "lounge");
    return;
  }

  // Agent is in lounge (hasn't walked to hotDesk yet, or walk hasn't started).
  // Instead of removing immediately, send it to hotDesk first so the user
  // sees the full walk-in → stay → walk-out animation cycle.
  if (agent.zone === "lounge" && !agent.movement) {
    getStoreState().startMovement(agentId, "hotDesk");
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
export function scheduleMeetingReturn(agentId: string): void {
  // Cancel any existing timer
  const existingTimer = meetingRetireTimers.get(agentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    meetingRetireTimers.delete(agentId);
  }

  if (!getStoreState) return;
  const agent = getStoreState().agents.get(agentId);
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
    getStoreState().returnFromMeeting(agentId);
  }
}
