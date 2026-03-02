import {
  ZONES,
  DESK_GRID_COLS,
  DESK_GRID_ROWS,
  DESK_MAX_AGENTS,
  HOT_DESK_GRID_COLS,
  HOT_DESK_GRID_ROWS,
  SCALE_X_2D_TO_3D,
  SCALE_Z_2D_TO_3D,
  MEETING_SEAT_RADIUS,
  DESK_UNIT,
  MIN_DESK_WIDTH,
} from "./constants";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

function gridPositions(
  zone: { x: number; y: number; width: number; height: number },
  cols: number,
  rows: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const cellW = zone.width / (cols + 1);
  const cellH = zone.height / (rows + 1);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: Math.round(zone.x + cellW * (col + 1)),
        y: Math.round(zone.y + cellH * (row + 1)),
      });
    }
  }
  return positions;
}

const deskPositions = gridPositions(ZONES.desk, DESK_GRID_COLS, DESK_GRID_ROWS);
const hotDeskPositions = gridPositions(ZONES.hotDesk, HOT_DESK_GRID_COLS, HOT_DESK_GRID_ROWS);

function posKey(pos: { x: number; y: number }): string {
  return `${pos.x},${pos.y}`;
}

export function allocatePosition(
  agentId: string,
  isSubAgent: boolean,
  occupied: Set<string>,
): { x: number; y: number } {
  if (!isSubAgent) {
    const hash = hashString(agentId);
    const startIdx = hash % DESK_MAX_AGENTS;

    for (let i = 0; i < DESK_MAX_AGENTS; i++) {
      const idx = (startIdx + i) % DESK_MAX_AGENTS;
      const pos = deskPositions[idx];
      if (!occupied.has(posKey(pos))) {
        return pos;
      }
    }
  }

  // Fallback / SubAgent → Hot Desk Zone
  for (const pos of hotDeskPositions) {
    if (!occupied.has(posKey(pos))) {
      return pos;
    }
  }

  // All full — offset slightly from zone origin
  const fallbackZone = isSubAgent ? ZONES.hotDesk : ZONES.desk;
  return {
    x: fallbackZone.x + 30 + (hashString(agentId) % (fallbackZone.width - 60)),
    y: fallbackZone.y + 30 + (hashString(agentId) % (fallbackZone.height - 60)),
  };
}

/** Map 2D SVG coordinates to 3D world coordinates: x→x, y→z, ground plane y=0 */
export function position2dTo3d(pos: { x: number; y: number }): [number, number, number] {
  return [pos.x * SCALE_X_2D_TO_3D, 0, pos.y * SCALE_Z_2D_TO_3D];
}

/** Allocate equi-angular positions around a meeting table center */
export function allocateMeetingPositions(
  agentIds: string[],
  tableCenter: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const count = agentIds.length;
  if (count === 0) {
    return [];
  }

  return agentIds.map((_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: Math.round(tableCenter.x + (Math.cos(angle) * MEETING_SEAT_RADIUS) / SCALE_X_2D_TO_3D),
      y: Math.round(tableCenter.y + (Math.sin(angle) * MEETING_SEAT_RADIUS) / SCALE_Z_2D_TO_3D),
    };
  });
}

// --- Desk-unit layout for the new flat office ---

export interface DeskSlot {
  unitX: number;
  unitY: number;
}

/**
 * Adaptive column count: horizontal-first strategy.
 * Fills as many columns as the zone width allows (min desk width = 100px),
 * defaulting to at least 4 columns, then grows rows as needed.
 */
export function adaptiveCols(
  zoneWidth: number,
  slotCount: number,
  padX = 40,
): number {
  const availW = zoneWidth - padX * 2;
  const maxCols = Math.max(1, Math.floor(availW / MIN_DESK_WIDTH));
  return Math.min(maxCols, Math.max(slotCount, 4));
}

/**
 * Calculate desk-unit positions inside a zone.
 * Returns an array of (x,y) center-points for DeskUnit placement.
 * `slotCount` is the total number of slots to create (>= agentCount to show empty desks).
 * Uses horizontal-first layout: fills columns first, then expands rows.
 */
export function calculateDeskSlots(
  zone: { x: number; y: number; width: number; height: number },
  agentCount: number,
  slotCount?: number,
): DeskSlot[] {
  const total = slotCount ?? agentCount;
  if (total === 0) {
    return [];
  }
  const padX = 40;
  const padY = 50;
  const cols = adaptiveCols(zone.width, total, padX);
  const rows = Math.ceil(total / cols);
  const availW = zone.width - padX * 2;
  const availH = zone.height - padY * 2;
  const cellW = Math.min(DESK_UNIT.width, availW / cols);
  const cellH = Math.min(DESK_UNIT.height, availH / Math.max(rows, 1));

  const slots: DeskSlot[] = [];
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    slots.push({
      unitX: Math.round(zone.x + padX + cellW * (col + 0.5)),
      unitY: Math.round(zone.y + padY + cellH * (row + 0.5)),
    });
  }
  return slots;
}

/**
 * Deterministic assignment: map an agentId to a stable slot index.
 * Ensures the same agent always ends up at the same desk.
 */
export function agentSlotIndex(agentId: string, totalSlots: number): number {
  return hashString(agentId) % totalSlots;
}

/**
 * Pre-defined anchor points in the lounge zone for idle sub-agents.
 * Positioned near sofas and coffee tables, avoiding overlap with decorative elements.
 */
export function calculateLoungePositions(maxCount: number): Array<{ x: number; y: number }> {
  const lz = ZONES.lounge;
  const anchors = [
    { x: lz.x + 60, y: lz.y + 40 },
    { x: lz.x + 160, y: lz.y + 40 },
    { x: lz.x + 260, y: lz.y + 40 },
    { x: lz.x + 360, y: lz.y + 40 },
    { x: lz.x + 60, y: lz.y + 120 },
    { x: lz.x + 160, y: lz.y + 120 },
    { x: lz.x + 260, y: lz.y + 120 },
    { x: lz.x + 360, y: lz.y + 120 },
    { x: lz.x + 440, y: lz.y + 60 },
    { x: lz.x + 440, y: lz.y + 130 },
    { x: lz.x + 100, y: lz.y + 180 },
    { x: lz.x + 280, y: lz.y + 180 },
  ];
  return anchors.slice(0, Math.min(maxCount, anchors.length));
}

/** Meeting-zone seat positions (SVG coords, circular layout) */
export function calculateMeetingSeatsSvg(
  agentCount: number,
  tableCenter: { x: number; y: number },
  seatRadius: number,
): Array<{ x: number; y: number }> {
  if (agentCount === 0) {
    return [];
  }
  return Array.from({ length: agentCount }, (_, i) => {
    const angle = (2 * Math.PI * i) / agentCount - Math.PI / 2;
    return {
      x: Math.round(tableCenter.x + Math.cos(angle) * seatRadius),
      y: Math.round(tableCenter.y + Math.sin(angle) * seatRadius),
    };
  });
}
