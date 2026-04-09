import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MOCK_PROJECTION_BOOTSTRAP } from "@/mock/projection-bootstrap";
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
    eventHistory: [],
    sidebarCollapsed: false,
    lastSessionsSnapshot: null,
    projectionPanels: [],
    theme: "dark",
    operatorScopes: [],
    tokenHistory: [],
    agentCosts: {},
    currentPage: "office",
    chatDockHeight: 300,
    maxSubAgents: 8,
    agentToAgentConfig: { enabled: false, allow: [] },
    runIdMap: new Map(),
    sessionKeyMap: new Map(),
  });
}

describe("projection bootstrap packet", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("seeds office state from the framework bootstrap packet", () => {
    useOfficeStore.getState().applyProjectionBootstrap(MOCK_PROJECTION_BOOTSTRAP);

    const state = useOfficeStore.getState();
    expect(state.agents.size).toBe(6);
    expect(state.links).toHaveLength(6);
    expect(state.eventHistory).toHaveLength(2);
    expect(state.globalMetrics.totalAgents).toBe(6);
    expect(state.globalMetrics.activeAgents).toBe(1);
    expect(state.projectionPanels).toHaveLength(4);
    expect(state.agents.get("ceo-agent")?.zone).toBe("meeting");
    expect(state.agents.get("engai-agent")?.parentAgentId).toBe("ceo-agent");
    expect(state.projectionPanels[0]?.panelId).toBe("decision-drift");
    expect(state.projectionPanels[3]?.panelId).toBe("handoff-chain");
  });
});

