import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { AgentAvatar } from "@/components/office-2d/AgentAvatar";
import type { VisualAgent } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

const mockAgent: VisualAgent = {
  id: "a1",
  name: "TestBot",
  status: "idle",
  position: { x: 200, y: 150 },
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
};

function renderAvatar(agent: VisualAgent = mockAgent) {
  return render(
    <svg>
      <AgentAvatar agent={agent} />
    </svg>,
  );
}

describe("AgentAvatar", () => {
  beforeEach(() => {
    useOfficeStore.setState({ selectedAgentId: null });
  });

  it("exposes agent status as data attribute", () => {
    const { container } = renderAvatar();
    const root = container.querySelector("[data-agent-id='a1']");
    expect(root?.getAttribute("data-status")).toBe("idle");
  });

  it("renders full-body pawn (legs, torso, head present)", () => {
    const { container } = renderAvatar();
    // Head circle + hand circles → multiple circles; torso/legs → multiple rects
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(4);
  });

  it("renders error emote on error status", () => {
    const { container } = renderAvatar({ ...mockAgent, status: "error" });
    const root = container.querySelector("[data-agent-id='a1']");
    expect(root?.getAttribute("data-status")).toBe("error");
    const errorMark = Array.from(container.querySelectorAll("path")).find(
      (p) => p.getAttribute("fill") === "#ef4444",
    );
    expect(errorMark).toBeTruthy();
  });

  it("renders thought bubble when thinking", () => {
    const { container } = renderAvatar({ ...mockAgent, status: "thinking" });
    const dots = Array.from(container.querySelectorAll("circle")).filter(
      (c) => c.getAttribute("fill") === "#3b82f6",
    );
    expect(dots.length).toBe(3);
  });

  it("renders foreignObject for name label", () => {
    const { container } = renderAvatar();
    const fos = container.querySelectorAll("foreignObject");
    expect(fos.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking triggers selectAgent", () => {
    const { container } = renderAvatar();
    const g = container.querySelector("g");
    fireEvent.click(g!);
    expect(useOfficeStore.getState().selectedAgentId).toBe("a1");
  });

  it("shows sub-agent badge when isSubAgent is true", () => {
    const { container } = renderAvatar({ ...mockAgent, isSubAgent: true });
    const spans = Array.from(container.querySelectorAll("span"));
    expect(spans.some((s) => s.textContent === "S")).toBe(true);
  });
});
