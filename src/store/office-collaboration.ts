import type { CollaborationLink, VisualAgent } from "@/gateway/types";
import { extractSessionNamespace } from "@/lib/session-key-utils";
import {
  detectMeetingGroups,
  applyMeetingGathering,
} from "./meeting-manager";

const LINK_TIMEOUT_MS = 60_000;
const MEETING_GATHERING_THROTTLE_MS = 500;

let meetingGatheringTimer: ReturnType<typeof setTimeout> | null = null;
let lastMeetingGroupsHash = "";

/** Callback set by the movement module to avoid circular imports. */
let scheduleMeetingReturnFn: ((agentId: string) => void) | null = null;

/** Store getter set by office-store.ts to avoid circular imports. */
let getStoreState: (() => {
  links: CollaborationLink[];
  agents: Map<string, VisualAgent>;
  agentToAgentConfig: { enabled: boolean; allow: string[] };
  moveToMeeting: (id: string, pos: { x: number; y: number }) => void;
  returnFromMeeting: (id: string) => void;
}) | null = null;

export function setStoreStateGetter(fn: typeof getStoreState): void {
  getStoreState = fn;
}

export function setScheduleMeetingReturnFn(fn: (agentId: string) => void): void {
  scheduleMeetingReturnFn = fn;
}

export function updateCollaborationLinks(
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
            const a = nsAgentList[i]!;
            const b = nsAgentList[j]!;
            const existingIdx = state.links.findIndex(
              (l) =>
                l.sessionKey === sessionKey &&
                ((l.sourceId === a && l.targetId === b) || (l.sourceId === b && l.targetId === a)),
            );
            if (existingIdx >= 0) {
              state.links[existingIdx]!.lastActivityAt = now;
              state.links[existingIdx]!.strength = Math.min(
                state.links[existingIdx]!.strength + 0.1,
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
      const link = state.links[existingIdx]!;
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
export function createPeerCollaborationLink(
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
    state.links[existingIdx]!.lastActivityAt = now;
    state.links[existingIdx]!.strength = Math.min(state.links[existingIdx]!.strength + 0.15, 1);
    state.links[existingIdx]!.isPeer = true;
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

export function createPeerCollaborationLinksForAgents(
  state: { links: CollaborationLink[]; agents: Map<string, VisualAgent> },
  agentIds: string[],
): void {
  for (let i = 0; i < agentIds.length; i += 1) {
    for (let j = i + 1; j < agentIds.length; j += 1) {
      createPeerCollaborationLink(state, agentIds[i]!, agentIds[j]!);
    }
  }
}

export function scheduleMeetingGathering(): void {
  if (meetingGatheringTimer) return;
  meetingGatheringTimer = setTimeout(() => {
    meetingGatheringTimer = null;
    if (!getStoreState) return;
    const state = getStoreState();

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
      (id, pos) => state.moveToMeeting(id, pos),
      (id) => state.returnFromMeeting(id),
      (id) => scheduleMeetingReturnFn?.(id),
    );
  }, MEETING_GATHERING_THROTTLE_MS);
}
