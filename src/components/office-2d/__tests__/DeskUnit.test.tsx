import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DeskUnit } from "@/components/office-2d/DeskUnit";
import type { VisualAgent } from "@/gateway/types";

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

describe("DeskUnit", () => {
  it("renders desk furniture when agent is null (empty desk)", () => {
    const { container } = render(
      <svg>
        <DeskUnit x={100} y={100} agent={null} />
      </svg>,
    );
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });

  it("renders agent avatar when agent is provided", () => {
    const { container } = render(
      <svg>
        <DeskUnit x={100} y={100} agent={mockAgent} />
      </svg>,
    );
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(2);
  });
});
