import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import type { VisualAgent } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";
import { SubAgentPanel } from "../SubAgentPanel";

function makeAgent(overrides: Partial<VisualAgent> & { id: string; name: string }): VisualAgent {
  return {
    status: "idle",
    position: { x: 100, y: 100 },
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
    zone: "desk",
    originalPosition: null,
    movement: null,
    confirmed: true,
    ...overrides,
  };
}

beforeEach(() => {
  useOfficeStore.setState({
    agents: new Map(),
    selectedAgentId: null,
  });
});

describe("SubAgentPanel", () => {
  it("renders empty hint when no sub-agents exist", () => {
    const parent = makeAgent({ id: "p1", name: "main" });
    useOfficeStore.setState({ agents: new Map([["p1", parent]]) });

    render(<SubAgentPanel />);
    expect(screen.getByText("无 Sub-Agent")).toBeDefined();
  });

  it("renders sub-agent cards when sub-agents exist", () => {
    const parent = makeAgent({ id: "p1", name: "main", childAgentIds: ["s1"] });
    const sub = makeAgent({
      id: "s1",
      name: "Sub-abc123",
      isSubAgent: true,
      parentAgentId: "p1",
      zone: "hotDesk",
    });
    useOfficeStore.setState({
      agents: new Map([
        ["p1", parent],
        ["s1", sub],
      ]),
    });

    render(<SubAgentPanel />);
    expect(screen.getByText("Sub-abc123")).toBeDefined();
    const parentLink = screen.getByText("← main");
    expect(parentLink).toBeDefined();
    expect(parentLink.getAttribute("role")).toBe("link");
  });

  it("selects sub-agent on card click", async () => {
    const parent = makeAgent({ id: "p1", name: "main", childAgentIds: ["s1"] });
    const sub = makeAgent({
      id: "s1",
      name: "Sub-test",
      isSubAgent: true,
      parentAgentId: "p1",
    });
    useOfficeStore.setState({
      agents: new Map([
        ["p1", parent],
        ["s1", sub],
      ]),
    });

    render(<SubAgentPanel />);
    const card = screen.getByText("Sub-test").closest("button");
    card?.click();

    expect(useOfficeStore.getState().selectedAgentId).toBe("s1");
  });
});
