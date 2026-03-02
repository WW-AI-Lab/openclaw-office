import { describe, it, expect } from "vitest";
import { allocatePosition, adaptiveCols, calculateDeskSlots, calculateLoungePositions } from "@/lib/position-allocator";
import { ZONES } from "@/lib/constants";

describe("allocatePosition", () => {
  it("same agentId always gets same position (deterministic)", () => {
    const pos1 = allocatePosition("agent-alpha", false, new Set());
    const pos2 = allocatePosition("agent-alpha", false, new Set());
    expect(pos1).toEqual(pos2);
  });

  it("different agentIds get different positions", () => {
    const occupied = new Set<string>();
    const pos1 = allocatePosition("agent-a", false, occupied);
    occupied.add(`${pos1.x},${pos1.y}`);
    const pos2 = allocatePosition("agent-b", false, occupied);
    expect(pos1).not.toEqual(pos2);
  });

  it("sub-agents go to hot desk zone", () => {
    const pos = allocatePosition("sub-1", true, new Set());
    // Hot desk zone starts at y=380
    expect(pos.y).toBeGreaterThanOrEqual(380);
  });

  it("desk zone overflow falls back to hot desk", () => {
    const occupied = new Set<string>();
    const positions: Array<{ x: number; y: number }> = [];

    // Fill up 12 desk positions
    for (let i = 0; i < 15; i++) {
      const pos = allocatePosition(`agent-${i}`, false, occupied);
      occupied.add(`${pos.x},${pos.y}`);
      positions.push(pos);
    }

    // Some positions should be in hot desk zone (y >= 380)
    const hotDeskPositions = positions.filter((p) => p.y >= 380);
    expect(hotDeskPositions.length).toBeGreaterThan(0);
  });

  it("no collision between allocated positions", () => {
    const occupied = new Set<string>();
    const seen = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const pos = allocatePosition(`agent-${i}`, false, occupied);
      const key = `${pos.x},${pos.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      occupied.add(key);
    }
  });
});

describe("adaptiveCols", () => {
  it("returns 4 columns for typical zone width and small slot count", () => {
    expect(adaptiveCols(537, 2)).toBe(4);
    expect(adaptiveCols(537, 4)).toBe(4);
  });

  it("returns 4 columns for 8 slots", () => {
    expect(adaptiveCols(537, 8)).toBe(4);
  });

  it("increases columns when width allows and slots are many", () => {
    const cols = adaptiveCols(537, 12);
    expect(cols).toBeGreaterThanOrEqual(4);
  });

  it("limits columns based on physical width", () => {
    const cols = adaptiveCols(250, 8, 40);
    expect(cols).toBeLessThanOrEqual(Math.floor((250 - 80) / 100));
  });

  it("minimum 1 column for very narrow zones", () => {
    expect(adaptiveCols(100, 4, 40)).toBeGreaterThanOrEqual(1);
  });
});

describe("calculateDeskSlots", () => {
  it("uses horizontal-first layout (row-major)", () => {
    const slots = calculateDeskSlots(ZONES.hotDesk, 4, 8);
    expect(slots.length).toBe(8);
    // First 4 slots should be in the same row (similar Y)
    expect(slots[0].unitY).toBe(slots[1].unitY);
    expect(slots[0].unitY).toBe(slots[2].unitY);
    expect(slots[0].unitY).toBe(slots[3].unitY);
  });

  it("creates correct number of slots based on slotCount", () => {
    const slots = calculateDeskSlots(ZONES.hotDesk, 2, 12);
    expect(slots.length).toBe(12);
  });

  it("defaults to agentCount when slotCount not provided", () => {
    const slots = calculateDeskSlots(ZONES.hotDesk, 5);
    expect(slots.length).toBe(5);
  });

  it("returns empty array for 0 total", () => {
    const slots = calculateDeskSlots(ZONES.hotDesk, 0, 0);
    expect(slots.length).toBe(0);
  });
});

describe("calculateLoungePositions", () => {
  it("returns up to maxCount positions", () => {
    const positions = calculateLoungePositions(6);
    expect(positions.length).toBe(6);
  });

  it("caps at 12 positions", () => {
    const positions = calculateLoungePositions(20);
    expect(positions.length).toBe(12);
  });

  it("all positions are within lounge zone", () => {
    const lz = ZONES.lounge;
    const positions = calculateLoungePositions(12);
    for (const pos of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(lz.x);
      expect(pos.x).toBeLessThanOrEqual(lz.x + lz.width);
      expect(pos.y).toBeGreaterThanOrEqual(lz.y);
      expect(pos.y).toBeLessThanOrEqual(lz.y + lz.height);
    }
  });

  it("positions are distinct", () => {
    const positions = calculateLoungePositions(12);
    const keys = positions.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(positions.length);
  });
});
