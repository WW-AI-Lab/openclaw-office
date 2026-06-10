import type { CollaborationLink, VisualAgent } from "@/gateway/types";
import { ZONES } from "@/lib/constants";
import { allocateMeetingPositions } from "@/lib/position-allocator";

const STRENGTH_THRESHOLD = 0.3;
const MAX_CONCURRENT_MEETINGS = 3;

interface MeetingGroup {
  sessionKey: string;
  agentIds: string[];
}

/** Multiple meeting table center positions (up to 3 groups) — shared with FloorPlan rendering */
export const MEETING_TABLE_CENTERS = [
  { x: ZONES.meeting.x + ZONES.meeting.width / 2, y: ZONES.meeting.y + ZONES.meeting.height / 2 },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.2,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.28,
  },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.8,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.72,
  },
];

/**
 * Detect collaboration groups that should trigger meeting zone gathering.
 * Groups agents by sessionKey where 2+ agents are collaborating with strength > threshold.
 * When allowList is provided, only agents in the list can participate.
 * Sub-agents are always excluded from meeting groups.
 */
export function detectMeetingGroups(
  links: CollaborationLink[],
  agents: Map<string, VisualAgent>,
  allowList?: string[],
): MeetingGroup[] {
  const allowSet = allowList && allowList.length > 0 ? new Set(allowList) : null;
  const sessionAgents = new Map<string, Set<string>>();

  for (const link of links) {
    if (link.strength < STRENGTH_THRESHOLD) {
      continue;
    }
    const sourceAgent = agents.get(link.sourceId);
    const targetAgent = agents.get(link.targetId);
    if (!sourceAgent || !targetAgent) {
      continue;
    }
    // 只有主 Agent 才能进入会议室，sub-agent 继续走 hotDesk 流程
    if (sourceAgent.isSubAgent || targetAgent.isSubAgent) {
      continue;
    }
    if (allowSet && (!allowSet.has(link.sourceId) || !allowSet.has(link.targetId))) {
      continue;
    }

    let set = sessionAgents.get(link.sessionKey);
    if (!set) {
      set = new Set();
      sessionAgents.set(link.sessionKey, set);
    }
    set.add(link.sourceId);
    set.add(link.targetId);
  }

  const groups: MeetingGroup[] = [];
  for (const [sessionKey, agentSet] of sessionAgents) {
    if (agentSet.size >= 2) {
      groups.push({ sessionKey, agentIds: Array.from(agentSet) });
    }
    if (groups.length >= MAX_CONCURRENT_MEETINGS) {
      break;
    }
  }

  return groups;
}

/**
 * Calculate seat positions for a meeting group.
 * Returns a map of agentId → meeting position.
 */
export function calculateMeetingSeats(
  group: MeetingGroup,
  tableIndex: number,
): Map<string, { x: number; y: number }> {
  const center = MEETING_TABLE_CENTERS[tableIndex % MEETING_TABLE_CENTERS.length];
  const positions = allocateMeetingPositions(group.agentIds, center);
  const result = new Map<string, { x: number; y: number }>();

  group.agentIds.forEach((id, i) => {
    result.set(id, positions[i]);
  });

  return result;
}

/**
 * Apply meeting gathering: move agents to meeting positions and save originals.
 * Called from a store action or effect.
 * 
 * @param scheduleMeetingReturn - Called instead of returnFromMeeting to enforce minimum 10s stay.
 *   If null, returnFromMeeting is called directly (for immediate forced returns).
 */
export function applyMeetingGathering(
  agents: Map<string, VisualAgent>,
  groups: MeetingGroup[],
  moveToMeeting: (agentId: string, pos: { x: number; y: number }) => void,
  returnFromMeeting: (agentId: string) => void,
  scheduleMeetingReturn?: (agentId: string) => void,
): void {
  const inMeeting = new Set<string>();

  groups.forEach((group, tableIndex) => {
    const seats = calculateMeetingSeats(group, tableIndex);
    for (const [agentId, pos] of seats) {
      const agent = agents.get(agentId);
      if (agent && agent.zone !== "meeting" && agent.movement?.toZone !== "meeting") {
        moveToMeeting(agentId, pos);
      }
      inMeeting.add(agentId);
    }
  });

  // Return agents no longer in any meeting — respect minimum stay
  for (const agent of agents.values()) {
    if (agent.zone === "meeting" && !inMeeting.has(agent.id) && !agent.manualMeeting) {
      if (scheduleMeetingReturn) {
        scheduleMeetingReturn(agent.id);
      } else {
        returnFromMeeting(agent.id);
      }
    }
  }
}
