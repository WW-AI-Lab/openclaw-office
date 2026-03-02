import { OFFICE, ZONES, CORRIDOR_ENTRANCE } from "./constants";
import type { AgentZone } from "@/gateway/types";

export const WALK_SPEED_SVG = 120;
export const MIN_WALK_DURATION = 1.5;

const corridorW = OFFICE.corridorWidth;
const halfW = (OFFICE.width - corridorW) / 2;
const halfH = (OFFICE.height - corridorW) / 2;

const corridorCenter = {
  x: OFFICE.x + halfW + corridorW / 2,
  y: OFFICE.y + halfH + corridorW / 2,
};

/**
 * Door points: where each zone connects to the corridor (center of zone's corridor edge).
 */
const DOOR_POINTS: Record<AgentZone, { x: number; y: number }> = {
  desk: {
    x: OFFICE.x + halfW / 2,
    y: OFFICE.y + halfH + corridorW / 2,
  },
  meeting: {
    x: OFFICE.x + halfW + corridorW + halfW / 2,
    y: OFFICE.y + halfH + corridorW / 2,
  },
  hotDesk: {
    x: OFFICE.x + halfW / 2,
    y: OFFICE.y + halfH + corridorW / 2,
  },
  lounge: {
    x: OFFICE.x + halfW + corridorW + halfW / 2,
    y: OFFICE.y + halfH + corridorW / 2,
  },
  corridor: { ...CORRIDOR_ENTRANCE },
};

/**
 * Each zone connects to the corridor at specific edges.
 * desk (top-left) → bottom edge & right edge
 * meeting (top-right) → bottom edge & left edge
 * hotDesk (bottom-left) → top edge & right edge
 * lounge (bottom-right) → top edge & left edge
 */
function getZoneDoorPoint(zone: AgentZone): { x: number; y: number } {
  if (zone === "corridor") {
    return { ...CORRIDOR_ENTRANCE };
  }
  const z = ZONES[zone as keyof typeof ZONES];
  switch (zone) {
    case "desk":
      return { x: z.x + z.width / 2, y: z.y + z.height + corridorW / 2 };
    case "meeting":
      return { x: z.x + z.width / 2, y: z.y + z.height + corridorW / 2 };
    case "hotDesk":
      return { x: z.x + z.width / 2, y: z.y - corridorW / 2 };
    case "lounge":
      return { x: z.x + z.width / 2, y: z.y - corridorW / 2 };
    default:
      return { ...CORRIDOR_ENTRANCE };
  }
}

function sameCorridorArm(a: AgentZone, b: AgentZone): boolean {
  // corridor is at the bottom-right entrance, so treat it like a separate arm
  if (a === "corridor" || b === "corridor") return false;

  const verticalLeft: AgentZone[] = ["desk", "hotDesk"];
  const verticalRight: AgentZone[] = ["meeting", "lounge"];
  const horizontalTop: AgentZone[] = ["desk", "meeting"];
  const horizontalBottom: AgentZone[] = ["hotDesk", "lounge"];

  if (verticalLeft.includes(a) && verticalLeft.includes(b)) return true;
  if (verticalRight.includes(a) && verticalRight.includes(b)) return true;
  if (horizontalTop.includes(a) && horizontalTop.includes(b)) return true;
  if (horizontalBottom.includes(a) && horizontalBottom.includes(b)) return true;
  return false;
}

/**
 * Generate a waypoint path from `from` to `to` through the office corridor.
 * Path goes: from → fromDoor → (corridor waypoints) → toDoor → to
 */
export function planWalkPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromZone: AgentZone,
  toZone: AgentZone,
): Array<{ x: number; y: number }> {
  if (fromZone === toZone) {
    return [{ ...from }, { ...to }];
  }

  const fromDoor = getZoneDoorPoint(fromZone);
  const toDoor = getZoneDoorPoint(toZone);

  if (sameCorridorArm(fromZone, toZone)) {
    return [{ ...from }, fromDoor, toDoor, { ...to }];
  }

  // Different corridor arms → must go through the center
  return [{ ...from }, fromDoor, { ...corridorCenter }, toDoor, { ...to }];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Total length of a polyline path */
export function pathLength(path: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += distance(path[i - 1], path[i]);
  }
  return len;
}

/** Calculate walk duration based on path length and speed, with minimum duration guarantee */
export function calculateWalkDuration(path: Array<{ x: number; y: number }>): number {
  const len = pathLength(path);
  const naturalDuration = len / WALK_SPEED_SVG;
  return Math.max(naturalDuration, MIN_WALK_DURATION);
}

/**
 * Interpolate a position along a polyline path given progress [0, 1].
 * Progress is distance-proportional (not segment-proportional).
 */
export function interpolatePathPosition(
  path: Array<{ x: number; y: number }>,
  progress: number,
): { x: number; y: number } {
  if (path.length === 0) return { x: 0, y: 0 };
  if (progress <= 0) return { ...path[0] };
  if (progress >= 1) return { ...path[path.length - 1] };

  const totalLen = pathLength(path);
  if (totalLen === 0) return { ...path[0] };

  const targetDist = progress * totalLen;
  let accumulated = 0;

  for (let i = 1; i < path.length; i++) {
    const segLen = distance(path[i - 1], path[i]);
    if (accumulated + segLen >= targetDist) {
      const segProgress = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * segProgress,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * segProgress,
      };
    }
    accumulated += segLen;
  }

  return { ...path[path.length - 1] };
}

// Re-export for tests
export { corridorCenter, getZoneDoorPoint, DOOR_POINTS };
