import { describe, it, expect } from "vitest";
import {
  planWalkPath,
  calculateWalkDuration,
  interpolatePathPosition,
  pathLength,
  corridorCenter,
  getZoneDoorPoint,
  WALK_SPEED_SVG,
  MIN_WALK_DURATION,
} from "../movement-animator";
import { ZONES, OFFICE } from "../constants";

describe("movement-animator", () => {
  describe("getZoneDoorPoint", () => {
    it("returns door points within corridor bounds", () => {
      const corridorW = OFFICE.corridorWidth;
      const halfH = (OFFICE.height - corridorW) / 2;
      const corridorY = OFFICE.y + halfH;

      for (const zone of ["desk", "meeting", "hotDesk", "lounge"] as const) {
        const door = getZoneDoorPoint(zone);
        const z = ZONES[zone];
        expect(door.x).toBeGreaterThanOrEqual(z.x);
        expect(door.x).toBeLessThanOrEqual(z.x + z.width);

        // Door y is within corridor vertical band
        expect(door.y).toBeGreaterThanOrEqual(corridorY - 1);
        expect(door.y).toBeLessThanOrEqual(corridorY + corridorW + 1);
      }
    });
  });

  describe("planWalkPath", () => {
    it("same zone → direct path [from, to]", () => {
      const from = { x: 100, y: 100 };
      const to = { x: 200, y: 150 };
      const path = planWalkPath(from, to, "desk", "desk");
      expect(path).toHaveLength(2);
      expect(path[0]).toEqual(from);
      expect(path[1]).toEqual(to);
    });

    it("adjacent zones (desk → hotDesk) → 4 waypoints, no corridor center", () => {
      const from = { x: ZONES.desk.x + 100, y: ZONES.desk.y + 100 };
      const to = { x: ZONES.hotDesk.x + 100, y: ZONES.hotDesk.y + 100 };
      const path = planWalkPath(from, to, "desk", "hotDesk");
      expect(path).toHaveLength(4);
      expect(path[0]).toEqual(from);
      expect(path[3]).toEqual(to);
    });

    it("adjacent zones (desk → meeting) → 4 waypoints, no corridor center", () => {
      const from = { x: ZONES.desk.x + 50, y: ZONES.desk.y + 50 };
      const to = { x: ZONES.meeting.x + 50, y: ZONES.meeting.y + 50 };
      const path = planWalkPath(from, to, "desk", "meeting");
      expect(path).toHaveLength(4);
    });

    it("diagonal zones (desk → lounge) → 5 waypoints through corridor center", () => {
      const from = { x: ZONES.desk.x + 50, y: ZONES.desk.y + 50 };
      const to = { x: ZONES.lounge.x + 50, y: ZONES.lounge.y + 50 };
      const path = planWalkPath(from, to, "desk", "lounge");
      expect(path).toHaveLength(5);
      expect(path[2]).toEqual(corridorCenter);
    });

    it("diagonal zones (hotDesk → meeting) → 5 waypoints through corridor center", () => {
      const from = { x: ZONES.hotDesk.x + 50, y: ZONES.hotDesk.y + 50 };
      const to = { x: ZONES.meeting.x + 50, y: ZONES.meeting.y + 50 };
      const path = planWalkPath(from, to, "hotDesk", "meeting");
      expect(path).toHaveLength(5);
      expect(path[2]).toEqual(corridorCenter);
    });
  });

  describe("pathLength", () => {
    it("returns 0 for single point", () => {
      expect(pathLength([{ x: 0, y: 0 }])).toBe(0);
    });

    it("calculates straight line distance", () => {
      const len = pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]);
      expect(len).toBeCloseTo(5);
    });

    it("sums multi-segment path", () => {
      const len = pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]);
      expect(len).toBeCloseTo(7);
    });
  });

  describe("calculateWalkDuration", () => {
    it("uses WALK_SPEED_SVG for normal paths", () => {
      const path = [
        { x: 0, y: 0 },
        { x: 360, y: 0 },
      ];
      const dur = calculateWalkDuration(path);
      expect(dur).toBeCloseTo(360 / WALK_SPEED_SVG);
    });

    it("enforces MIN_WALK_DURATION for short paths", () => {
      const path = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];
      const dur = calculateWalkDuration(path);
      expect(dur).toBe(MIN_WALK_DURATION);
    });
  });

  describe("interpolatePathPosition", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];

    it("progress=0 returns first point", () => {
      const pos = interpolatePathPosition(path, 0);
      expect(pos).toEqual({ x: 0, y: 0 });
    });

    it("progress=1 returns last point", () => {
      const pos = interpolatePathPosition(path, 1);
      expect(pos).toEqual({ x: 100, y: 100 });
    });

    it("progress=0.5 returns midpoint of total path", () => {
      // total length = 200, so at 100 distance = end of first segment
      const pos = interpolatePathPosition(path, 0.5);
      expect(pos.x).toBeCloseTo(100);
      expect(pos.y).toBeCloseTo(0);
    });

    it("progress=0.25 returns midpoint of first segment", () => {
      // total 200, 25% = 50px along first segment
      const pos = interpolatePathPosition(path, 0.25);
      expect(pos.x).toBeCloseTo(50);
      expect(pos.y).toBeCloseTo(0);
    });

    it("progress=0.75 returns midpoint of second segment", () => {
      // total 200, 75% = 150px = 100 + 50 into second segment
      const pos = interpolatePathPosition(path, 0.75);
      expect(pos.x).toBeCloseTo(100);
      expect(pos.y).toBeCloseTo(50);
    });

    it("handles empty path", () => {
      const pos = interpolatePathPosition([], 0.5);
      expect(pos).toEqual({ x: 0, y: 0 });
    });

    it("handles single-point path", () => {
      const pos = interpolatePathPosition([{ x: 42, y: 99 }], 0.5);
      expect(pos).toEqual({ x: 42, y: 99 });
    });

    it("clamps progress below 0", () => {
      const pos = interpolatePathPosition(path, -0.5);
      expect(pos).toEqual({ x: 0, y: 0 });
    });

    it("clamps progress above 1", () => {
      const pos = interpolatePathPosition(path, 1.5);
      expect(pos).toEqual({ x: 100, y: 100 });
    });
  });
});
