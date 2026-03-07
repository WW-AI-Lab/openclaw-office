import { describe, it, expect, beforeEach } from "vitest";
import type { SubAgentInfo } from "@/gateway/types";
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
    maxSubAgents: 8,
    agentToAgentConfig: { enabled: false, allow: [] },
    runIdMap: new Map(),
    sessionKeyMap: new Map(),
  });
}

function mkSubInfo(id: string): SubAgentInfo {
  return {
    sessionKey: `session-${id}`,
    agentId: id,
    label: `Sub-${id}`,
    task: "research",
    requesterSessionKey: "parent-session",
    startedAt: Date.now(),
  };
}

describe("office-store Sub-Agent management", () => {
  beforeEach(() => {
    resetStore();
    useOfficeStore.getState().initAgents([{ id: "parent", name: "ParentBot" }]);
  });

  it("addSubAgent creates sub-agent with correct parent relationship", () => {
    const { addSubAgent } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub1"));

    const state = useOfficeStore.getState();
    const sub = state.agents.get("sub1");
    expect(sub).toBeDefined();
    expect(sub?.isSubAgent).toBe(true);
    expect(sub?.parentAgentId).toBe("parent");
    expect(sub?.zone).toBe("lounge");

    const parent = state.agents.get("parent");
    expect(parent?.childAgentIds).toContain("sub1");
  });

  it("removeSubAgent cleans up parent-child relationship", () => {
    const { addSubAgent, removeSubAgent } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub1"));
    removeSubAgent("sub1");

    const state = useOfficeStore.getState();
    expect(state.agents.has("sub1")).toBe(false);
    expect(state.agents.get("parent")?.childAgentIds).not.toContain("sub1");
  });

  it("removeSubAgent clears selectedAgentId if selected", () => {
    const { addSubAgent, selectAgent, removeSubAgent } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub1"));
    selectAgent("sub1");
    expect(useOfficeStore.getState().selectedAgentId).toBe("sub1");

    removeSubAgent("sub1");
    expect(useOfficeStore.getState().selectedAgentId).toBeNull();
  });

  it("moveToMeeting saves original position and starts movement animation", () => {
    const { moveToMeeting, completeMovement } = useOfficeStore.getState();
    const parent = useOfficeStore.getState().agents.get("parent")!;
    const origPos = { ...parent.position };

    moveToMeeting("parent", { x: 890, y: 190 });

    const moving = useOfficeStore.getState().agents.get("parent")!;
    expect(moving.originalPosition).toEqual(origPos);
    expect(moving.movement).not.toBeNull();
    expect(moving.movement!.toZone).toBe("meeting");

    // Complete the movement to reach final state
    completeMovement("parent");
    const arrived = useOfficeStore.getState().agents.get("parent")!;
    expect(arrived.zone).toBe("meeting");
    expect(arrived.movement).toBeNull();
  });

  it("returnFromMeeting starts movement back to original zone", () => {
    const { moveToMeeting, completeMovement, returnFromMeeting } = useOfficeStore.getState();

    moveToMeeting("parent", { x: 890, y: 190 });
    completeMovement("parent");
    returnFromMeeting("parent");

    const returning = useOfficeStore.getState().agents.get("parent")!;
    expect(returning.movement).not.toBeNull();
    expect(returning.movement!.toZone).toBe("desk");

    completeMovement("parent");
    const restored = useOfficeStore.getState().agents.get("parent")!;
    expect(restored.zone).toBe("desk");
    expect(restored.movement).toBeNull();
  });

  it("setSessionsSnapshot stores snapshot", () => {
    const { setSessionsSnapshot } = useOfficeStore.getState();
    const snapshot = { sessions: [mkSubInfo("s1")], fetchedAt: Date.now() };
    setSessionsSnapshot(snapshot);

    expect(useOfficeStore.getState().lastSessionsSnapshot).toEqual(snapshot);
  });

  it("initAgents sets correct Phase 2 default field values", () => {
    const agent = useOfficeStore.getState().agents.get("parent")!;
    expect(agent.parentAgentId).toBeNull();
    expect(agent.childAgentIds).toEqual([]);
    expect(agent.zone).toBe("desk");
    expect(agent.originalPosition).toBeNull();
  });

  it("addSubAgent assigns lounge zone and lounge position", () => {
    const { addSubAgent } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub-lounge-1"));
    const sub = useOfficeStore.getState().agents.get("sub-lounge-1")!;
    expect(sub.zone).toBe("lounge");
    // Position should be within lounge zone bounds
    expect(sub.position.x).toBeGreaterThan(500);
    expect(sub.position.y).toBeGreaterThan(350);
  });

  it("returnFromMeeting returns sub-agent to hotDesk", () => {
    const { addSubAgent, updateAgent, moveToMeeting, completeMovement, returnFromMeeting } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub-meet"));
    updateAgent("sub-meet", { zone: "hotDesk" });

    moveToMeeting("sub-meet", { x: 890, y: 190 });
    completeMovement("sub-meet");
    returnFromMeeting("sub-meet");
    completeMovement("sub-meet");
    const restored = useOfficeStore.getState().agents.get("sub-meet")!;
    expect(restored.zone).toBe("hotDesk");
  });
});

describe("processAgentEvent: real Gateway sub-agent sessionKey", () => {
  beforeEach(() => {
    resetStore();
    useOfficeStore.getState().initAgents([{ id: "main", name: "main" }]);
    // Register main agent's session in sessionKeyMap via setState
    useOfficeStore.setState((state) => {
      state.sessionKeyMap.set("agent:main:session-123", ["main"]);
    });
  });

  it("creates sub-agent from sessionKey containing :subagent:", () => {
    const sessionKey = "agent:main:subagent:5533959a-1a5e-4b44-a39a-a0799f71db92";
    const runId = "d48c80c6-181a-46fa-98b9-381a67b59560";

    useOfficeStore.getState().processAgentEvent({
      runId,
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start" },
      sessionKey,
    });

    const subUuid = "5533959a-1a5e-4b44-a39a-a0799f71db92";
    const sub = useOfficeStore.getState().agents.get(subUuid);
    expect(sub).toBeDefined();
    expect(sub?.isSubAgent).toBe(true);
    expect(sub?.parentAgentId).toBe("main");
    expect(sub?.confirmed).toBe(true);

    // Main agent should NOT be modified
    const mainAgent = useOfficeStore.getState().agents.get("main");
    expect(mainAgent?.isSubAgent).toBe(false);
  });

  it("routes subsequent events to the correct sub-agent", () => {
    const sessionKey = "agent:main:subagent:abc123";
    const runId = "run-sub-1";

    // First event creates the sub-agent
    useOfficeStore.getState().processAgentEvent({
      runId,
      seq: 1,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "start" },
      sessionKey,
    });

    // Second event should route to the same sub-agent (via runIdMap)
    useOfficeStore.getState().processAgentEvent({
      runId,
      seq: 2,
      stream: "tool",
      ts: 2,
      data: { phase: "start", name: "web_search" },
      sessionKey,
    });

    const sub = useOfficeStore.getState().agents.get("abc123");
    expect(sub?.status).toBe("tool_calling");
    expect(sub?.currentTool?.name).toBe("web_search");

    // Main agent should still be idle
    const main = useOfficeStore.getState().agents.get("main");
    expect(main?.status).toBe("idle");
  });

  it("triggers walk animation from lounge to hotDesk for new sub-agent", () => {
    const sessionKey = "agent:main:subagent:walk-test-uuid";
    useOfficeStore.getState().processAgentEvent({
      runId: "run-walk",
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start" },
      sessionKey,
    });

    const sub = useOfficeStore.getState().agents.get("walk-test-uuid");
    expect(sub).toBeDefined();
    // After addSubAgent, movement should be started from lounge to hotDesk
    expect(sub?.movement).not.toBeNull();
    expect(sub?.movement?.toZone).toBe("hotDesk");
  });

  it("does not convert main agent to sub-agent", () => {
    // Simulate what was happening before the fix:
    // An event arrives with sessionKey "agent:main:subagent:xxx" and the old code
    // would resolve agentId to "main" and never create a sub-agent
    const sessionKey = "agent:main:subagent:uuid-456";
    useOfficeStore.getState().processAgentEvent({
      runId: "run-protect",
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start" },
      sessionKey,
    });

    const main = useOfficeStore.getState().agents.get("main");
    expect(main?.isSubAgent).toBe(false);
    expect(main?.zone).toBe("desk");
  });
});

describe("office-store config awareness", () => {
  beforeEach(() => {
    resetStore();
  });

  it("default maxSubAgents is 8", () => {
    expect(useOfficeStore.getState().maxSubAgents).toBe(8);
  });

  it("setMaxSubAgents updates value within range", () => {
    useOfficeStore.getState().setMaxSubAgents(12);
    expect(useOfficeStore.getState().maxSubAgents).toBe(12);
  });

  it("setMaxSubAgents rejects out-of-range values", () => {
    useOfficeStore.getState().setMaxSubAgents(0);
    expect(useOfficeStore.getState().maxSubAgents).toBe(8);
    useOfficeStore.getState().setMaxSubAgents(51);
    expect(useOfficeStore.getState().maxSubAgents).toBe(8);
  });

  it("default agentToAgentConfig is disabled", () => {
    const cfg = useOfficeStore.getState().agentToAgentConfig;
    expect(cfg.enabled).toBe(false);
    expect(cfg.allow).toEqual([]);
  });

  it("setAgentToAgentConfig updates config", () => {
    useOfficeStore.getState().setAgentToAgentConfig({
      enabled: true,
      allow: ["main", "coder"],
    });
    const cfg = useOfficeStore.getState().agentToAgentConfig;
    expect(cfg.enabled).toBe(true);
    expect(cfg.allow).toEqual(["main", "coder"]);
  });
});
