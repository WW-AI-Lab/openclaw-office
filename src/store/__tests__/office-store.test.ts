import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentEventPayload } from "@/gateway/types";
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
    theme: "dark",
    bloomEnabled: true,
    operatorScopes: [],
    tokenHistory: [],
    agentCosts: {},
    runIdMap: new Map(),
    sessionKeyMap: new Map(),
  });
}

function setRunIdMap(entries: [string, string][]) {
  useOfficeStore.setState({ runIdMap: new Map(entries) });
}

describe("office-store", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initAgents", () => {
    it("initializes agents from summary list", () => {
      const { initAgents } = useOfficeStore.getState();
      initAgents([
        { id: "agent-1", name: "Coder" },
        { id: "agent-2", name: "Reviewer", identity: { name: "Rev" } },
      ]);

      const state = useOfficeStore.getState();
      // 2 real agents + 8 placeholder agents (maxSubAgents default)
      const realAgents = Array.from(state.agents.values()).filter((a) => !a.isPlaceholder);
      expect(realAgents).toHaveLength(2);
      expect(state.agents.get("agent-1")?.name).toBe("Coder");
      expect(state.agents.get("agent-2")?.name).toBe("Rev");
      expect(state.globalMetrics.totalAgents).toBe(2);
    });
  });

  describe("processAgentEvent", () => {
    it("lifecycle start → thinking status", () => {
      useOfficeStore.getState().initAgents([{ id: "a1", name: "Alpha" }]);
      setRunIdMap([["run-1", "a1"]]);

      useOfficeStore.getState().processAgentEvent({
        runId: "run-1",
        seq: 1,
        stream: "lifecycle",
        ts: Date.now(),
        data: { phase: "start" },
      });

      const agent = useOfficeStore.getState().agents.get("a1");
      expect(agent?.status).toBe("thinking");
    });

    it("tool start → tool_calling, increments count", () => {
      useOfficeStore.getState().initAgents([{ id: "a1", name: "Alpha" }]);
      setRunIdMap([["run-1", "a1"]]);

      useOfficeStore.getState().processAgentEvent({
        runId: "run-1",
        seq: 2,
        stream: "tool",
        ts: Date.now(),
        data: { phase: "start", name: "search" },
      });

      const agent = useOfficeStore.getState().agents.get("a1");
      expect(agent?.status).toBe("tool_calling");
      expect(agent?.currentTool?.name).toBe("search");
      expect(agent?.toolCallCount).toBe(1);
    });

    it("full lifecycle: idle → thinking → tool → speaking → idle", () => {
      useOfficeStore.getState().initAgents([{ id: "a1", name: "Alpha" }]);
      setRunIdMap([["run-1", "a1"]]);

      const events: AgentEventPayload[] = [
        { runId: "run-1", seq: 1, stream: "lifecycle", ts: 1, data: { phase: "start" } },
        { runId: "run-1", seq: 2, stream: "tool", ts: 2, data: { phase: "start", name: "web" } },
        { runId: "run-1", seq: 3, stream: "tool", ts: 3, data: { phase: "end", name: "web" } },
        { runId: "run-1", seq: 4, stream: "assistant", ts: 4, data: { text: "Done!" } },
        { runId: "run-1", seq: 5, stream: "lifecycle", ts: 5, data: { phase: "end" } },
      ];

      const expectedStatuses = ["thinking", "tool_calling", "thinking", "speaking", "idle"];

      for (let i = 0; i < events.length; i++) {
        useOfficeStore.getState().processAgentEvent(events[i]);
        const agent = useOfficeStore.getState().agents.get("a1");
        expect(agent?.status).toBe(expectedStatuses[i]);
      }
    });

    it("creates unconfirmed agent for unknown runId in corridor zone", () => {
      useOfficeStore.getState().processAgentEvent({
        runId: "unknown-run",
        seq: 1,
        stream: "lifecycle",
        ts: Date.now(),
        data: { phase: "start" },
      });

      const state = useOfficeStore.getState();
      const agent = state.agents.get("unknown-run");
      expect(agent).toBeDefined();
      expect(agent?.confirmed).toBe(false);
      expect(agent?.zone).toBe("corridor");
      expect(agent?.status).toBe("thinking");
    });
  });

  describe("selectAgent", () => {
    it("selects and deselects agent", () => {
      const { selectAgent } = useOfficeStore.getState();

      selectAgent("a1");
      expect(useOfficeStore.getState().selectedAgentId).toBe("a1");

      selectAgent("a1");
      expect(useOfficeStore.getState().selectedAgentId).toBeNull();
    });
  });

  describe("event history", () => {
    it("records events up to limit", () => {
      useOfficeStore.getState().initAgents([{ id: "a1", name: "A" }]);
      setRunIdMap([["r1", "a1"]]);

      for (let i = 0; i < 250; i++) {
        useOfficeStore.getState().processAgentEvent({
          runId: "r1",
          seq: i,
          stream: "lifecycle",
          ts: i,
          data: { phase: "start" },
        });
      }

      expect(useOfficeStore.getState().eventHistory.length).toBeLessThanOrEqual(200);
    });
  });

  describe("extended fields", () => {
    it("initializes parentAgentId / childAgentIds / zone / originalPosition", () => {
      useOfficeStore.getState().initAgents([{ id: "a1", name: "A" }]);
      const agent = useOfficeStore.getState().agents.get("a1")!;
      expect(agent.parentAgentId).toBeNull();
      expect(agent.childAgentIds).toEqual([]);
      expect(agent.zone).toBe("desk");
      expect(agent.originalPosition).toBeNull();
    });
  });

  describe("viewMode", () => {
    it("setViewMode switches to 3d", () => {
      useOfficeStore.getState().setViewMode("3d");
      expect(useOfficeStore.getState().viewMode).toBe("3d");
    });

    it("setViewMode switches back to 2d", () => {
      useOfficeStore.getState().setViewMode("3d");
      useOfficeStore.getState().setViewMode("2d");
      expect(useOfficeStore.getState().viewMode).toBe("2d");
    });
  });

  describe("theme", () => {
    it("defaults to dark", () => {
      expect(useOfficeStore.getState().theme).toBe("dark");
    });

    it("setTheme switches to light", () => {
      useOfficeStore.getState().setTheme("light");
      expect(useOfficeStore.getState().theme).toBe("light");
    });

    it("setTheme persists to localStorage", () => {
      const spy = vi.spyOn(Storage.prototype, "setItem");
      useOfficeStore.getState().setTheme("light");
      expect(spy).toHaveBeenCalledWith("openclaw-theme", "light");
      spy.mockRestore();
    });

    it("setTheme switches back to dark", () => {
      useOfficeStore.getState().setTheme("light");
      useOfficeStore.getState().setTheme("dark");
      expect(useOfficeStore.getState().theme).toBe("dark");
    });
  });

  describe("bloomEnabled", () => {
    it("defaults to true (normal DPR)", () => {
      expect(useOfficeStore.getState().bloomEnabled).toBe(true);
    });

    it("setBloomEnabled toggles", () => {
      useOfficeStore.getState().setBloomEnabled(false);
      expect(useOfficeStore.getState().bloomEnabled).toBe(false);
      useOfficeStore.getState().setBloomEnabled(true);
      expect(useOfficeStore.getState().bloomEnabled).toBe(true);
    });
  });

  describe("globalMetrics", () => {
    it("counts active agents correctly", () => {
      useOfficeStore.getState().initAgents([
        { id: "a1", name: "A" },
        { id: "a2", name: "B" },
        { id: "a3", name: "C" },
      ]);
      setRunIdMap([
        ["r1", "a1"],
        ["r2", "a2"],
      ]);

      useOfficeStore.getState().processAgentEvent({
        runId: "r1",
        seq: 1,
        stream: "lifecycle",
        ts: 1,
        data: { phase: "start" },
      });
      useOfficeStore.getState().processAgentEvent({
        runId: "r2",
        seq: 1,
        stream: "lifecycle",
        ts: 1,
        data: { phase: "start" },
      });

      expect(useOfficeStore.getState().globalMetrics.activeAgents).toBe(2);
      expect(useOfficeStore.getState().globalMetrics.totalAgents).toBe(3);
    });
  });
});
