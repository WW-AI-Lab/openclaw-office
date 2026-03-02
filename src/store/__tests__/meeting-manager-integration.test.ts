import { describe, it, expect, beforeEach } from "vitest";
import type { AgentEventPayload } from "@/gateway/types";
import { detectMeetingGroups, applyMeetingGathering } from "@/store/meeting-manager";
import { useOfficeStore } from "@/store/office-store";

function resetStore() {
  useOfficeStore.setState({
    agents: new Map(),
    links: [],
    globalMetrics: {
      activeAgents: 0,
      totalAgents: 0,
      totalTokens: 0,
      tokenRate: 0,
      collaborationHeat: 0,
    },
    connectionStatus: "disconnected",
    connectionError: null,
    selectedAgentId: null,
    viewMode: "2d",
    eventHistory: [],
    sidebarCollapsed: false,
    lastSessionsSnapshot: null,
    runIdMap: new Map(),
    sessionKeyMap: new Map(),
  });
}

describe("meeting-manager integration", () => {
  beforeEach(resetStore);

  it("collaboration events trigger meeting gathering and return", () => {
    useOfficeStore.getState().initAgents([
      { id: "a1", name: "Alpha" },
      { id: "a2", name: "Beta" },
    ]);
    useOfficeStore.setState({
      runIdMap: new Map([
        ["r1", "a1"],
        ["r2", "a2"],
      ]),
    });

    // Agent a1 starts
    useOfficeStore.getState().processAgentEvent({
      runId: "r1",
      seq: 1,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "start" },
      sessionKey: "shared-session",
    } as AgentEventPayload);

    // Agent a2 starts in same session
    useOfficeStore.getState().processAgentEvent({
      runId: "r2",
      seq: 1,
      stream: "lifecycle",
      ts: 2,
      data: { phase: "start" },
      sessionKey: "shared-session",
    } as AgentEventPayload);

    // Now links should have been created
    const state = useOfficeStore.getState();
    expect(state.links.length).toBeGreaterThan(0);

    // Detect meeting groups
    const groups = detectMeetingGroups(state.links, state.agents);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].agentIds).toContain("a1");
    expect(groups[0].agentIds).toContain("a2");

    // Save original positions
    const a1OrigPos = { ...state.agents.get("a1")!.position };
    const a2OrigPos = { ...state.agents.get("a2")!.position };

    // Apply gathering
    applyMeetingGathering(
      state.agents,
      groups,
      (id, pos) => useOfficeStore.getState().moveToMeeting(id, pos),
      (id) => useOfficeStore.getState().returnFromMeeting(id),
    );

    // Movement is now animation-driven: agents should have movement state
    const afterGather = useOfficeStore.getState();
    const a1m = afterGather.agents.get("a1")!;
    const a2m = afterGather.agents.get("a2")!;
    expect(a1m.originalPosition).toEqual(a1OrigPos);
    expect(a2m.originalPosition).toEqual(a2OrigPos);
    expect(a1m.movement?.toZone).toBe("meeting");
    expect(a2m.movement?.toZone).toBe("meeting");

    // Complete the walking animation
    useOfficeStore.getState().completeMovement("a1");
    useOfficeStore.getState().completeMovement("a2");

    const arrived = useOfficeStore.getState();
    expect(arrived.agents.get("a1")!.zone).toBe("meeting");
    expect(arrived.agents.get("a2")!.zone).toBe("meeting");

    // Collaboration ends — empty groups
    applyMeetingGathering(
      arrived.agents,
      [],
      (id, pos) => useOfficeStore.getState().moveToMeeting(id, pos),
      (id) => useOfficeStore.getState().returnFromMeeting(id),
    );

    // Complete the return walk
    useOfficeStore.getState().completeMovement("a1");
    useOfficeStore.getState().completeMovement("a2");

    const afterReturn = useOfficeStore.getState();
    expect(afterReturn.agents.get("a1")!.zone).toBe("desk");
    expect(afterReturn.agents.get("a2")!.zone).toBe("desk");
  });
});
