import { describe, it, expect, vi } from "vitest";
import type { CollaborationLink, VisualAgent } from "@/gateway/types";
import {
  detectMeetingGroups,
  calculateMeetingSeats,
  applyMeetingGathering,
} from "../meeting-manager";

function makeAgent(id: string, zone: string = "desk"): VisualAgent {
  return {
    id,
    name: id,
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
    zone: zone as "desk" | "meeting" | "hotDesk" | "lounge",
    originalPosition: null,
    movement: null,
    confirmed: true,
  };
}

describe("meeting-manager", () => {
  describe("detectMeetingGroups", () => {
    it("returns empty when no links", () => {
      const agents = new Map([["a1", makeAgent("a1")]]);
      expect(detectMeetingGroups([], agents)).toEqual([]);
    });

    it("detects a group when 2+ agents have strong collaboration", () => {
      const agents = new Map([
        ["a1", makeAgent("a1")],
        ["a2", makeAgent("a2")],
      ]);
      const links: CollaborationLink[] = [
        {
          sourceId: "a1",
          targetId: "a2",
          sessionKey: "s1",
          strength: 0.5,
          lastActivityAt: Date.now(),
        },
      ];
      const groups = detectMeetingGroups(links, agents);
      expect(groups).toHaveLength(1);
      expect(groups[0].sessionKey).toBe("s1");
      expect(groups[0].agentIds).toContain("a1");
      expect(groups[0].agentIds).toContain("a2");
    });

    it("ignores links below strength threshold", () => {
      const agents = new Map([
        ["a1", makeAgent("a1")],
        ["a2", makeAgent("a2")],
      ]);
      const links: CollaborationLink[] = [
        {
          sourceId: "a1",
          targetId: "a2",
          sessionKey: "s1",
          strength: 0.2,
          lastActivityAt: Date.now(),
        },
      ];
      expect(detectMeetingGroups(links, agents)).toEqual([]);
    });

    it("filters by allowList when provided", () => {
      const agents = new Map([
        ["a1", makeAgent("a1")],
        ["a2", makeAgent("a2")],
        ["a3", makeAgent("a3")],
        ["a4", makeAgent("a4")],
      ]);
      const links: CollaborationLink[] = [
        {
          sourceId: "a1",
          targetId: "a2",
          sessionKey: "s1",
          strength: 0.5,
          lastActivityAt: Date.now(),
        },
        {
          sourceId: "a3",
          targetId: "a4",
          sessionKey: "s2",
          strength: 0.5,
          lastActivityAt: Date.now(),
        },
      ];
      const groups = detectMeetingGroups(links, agents, ["a1", "a2"]);
      expect(groups).toHaveLength(1);
      expect(groups[0].agentIds).toContain("a1");
      expect(groups[0].agentIds).toContain("a2");
    });

    it("returns all groups when allowList is empty", () => {
      const agents = new Map([
        ["a1", makeAgent("a1")],
        ["a2", makeAgent("a2")],
      ]);
      const links: CollaborationLink[] = [
        {
          sourceId: "a1",
          targetId: "a2",
          sessionKey: "s1",
          strength: 0.5,
          lastActivityAt: Date.now(),
        },
      ];
      const groups = detectMeetingGroups(links, agents, []);
      expect(groups).toHaveLength(1);
    });

    it("limits to 3 concurrent meetings", () => {
      const agents = new Map<string, VisualAgent>();
      const links: CollaborationLink[] = [];
      for (let i = 0; i < 8; i += 2) {
        const a = `a${i}`;
        const b = `a${i + 1}`;
        agents.set(a, makeAgent(a));
        agents.set(b, makeAgent(b));
        links.push({
          sourceId: a,
          targetId: b,
          sessionKey: `s${i}`,
          strength: 0.5,
          lastActivityAt: Date.now(),
        });
      }
      const groups = detectMeetingGroups(links, agents);
      expect(groups.length).toBeLessThanOrEqual(3);
    });
  });

  describe("calculateMeetingSeats", () => {
    it("returns positions for each agent", () => {
      const group = { sessionKey: "s1", agentIds: ["a1", "a2", "a3"] };
      const seats = calculateMeetingSeats(group, 0);
      expect(seats.size).toBe(3);
      expect(seats.has("a1")).toBe(true);
      expect(seats.has("a2")).toBe(true);
      expect(seats.has("a3")).toBe(true);
    });

    it("positions are distinct", () => {
      const group = { sessionKey: "s1", agentIds: ["a1", "a2"] };
      const seats = calculateMeetingSeats(group, 0);
      const pos1 = seats.get("a1")!;
      const pos2 = seats.get("a2")!;
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(0);
    });
  });

  describe("applyMeetingGathering", () => {
    it("moves agents to meeting and returns them when groups empty", () => {
      const a1 = makeAgent("a1");
      const a2 = makeAgent("a2");
      const agents = new Map([
        ["a1", a1],
        ["a2", a2],
      ]);
      const moveToMeeting = vi.fn();
      const returnFromMeeting = vi.fn();

      const groups = [{ sessionKey: "s1", agentIds: ["a1", "a2"] }];
      applyMeetingGathering(agents, groups, moveToMeeting, returnFromMeeting);
      expect(moveToMeeting).toHaveBeenCalledTimes(2);

      // Simulate agents now in meeting
      a1.zone = "meeting";
      a2.zone = "meeting";

      // Now with empty groups, agents should return
      applyMeetingGathering(agents, [], moveToMeeting, returnFromMeeting);
      expect(returnFromMeeting).toHaveBeenCalledWith("a1");
      expect(returnFromMeeting).toHaveBeenCalledWith("a2");
    });
  });
});
