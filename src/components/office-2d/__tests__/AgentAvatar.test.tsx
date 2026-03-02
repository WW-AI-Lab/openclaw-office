import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { AgentAvatar } from "@/components/office-2d/AgentAvatar";
import type { VisualAgent } from "@/gateway/types";
import { STATUS_COLORS } from "@/lib/constants";
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

  it("renders status ring with correct color", () => {
    const { container } = renderAvatar();
    const circles = container.querySelectorAll("circle");
    const ringCircle = Array.from(circles).find(
      (c) => c.getAttribute("stroke") === STATUS_COLORS.idle,
    );
    expect(ringCircle).toBeTruthy();
  });

  it("renders error status ring color", () => {
    const { container } = renderAvatar({ ...mockAgent, status: "error" });
    const circles = container.querySelectorAll("circle");
    const ringCircle = Array.from(circles).find(
      (c) => c.getAttribute("stroke") === STATUS_COLORS.error,
    );
    expect(ringCircle).toBeTruthy();
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
    const badge = container.querySelector("text");
    expect(badge?.textContent).toBe("S");
  });
});
