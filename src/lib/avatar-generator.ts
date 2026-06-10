export const PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export interface AvatarInfo {
  backgroundColor: string;
  textColor: string;
  initial: string;
}

export function generateAvatar(agentId: string, agentName?: string): AvatarInfo {
  const hash = hashString(agentId);
  const backgroundColor = PALETTE[hash % PALETTE.length];
  const textColor = luminance(backgroundColor) > 0.5 ? "#000000" : "#ffffff";

  const displayName = agentName ?? agentId;
  const initial = displayName.charAt(0).toUpperCase() || "?";

  return { backgroundColor, textColor, initial };
}

/** Deterministic hex color for 3D MeshStandardMaterial */
export function generateAvatar3dColor(agentId: string): string {
  const hash = hashString(agentId);
  return PALETTE[hash % PALETTE.length];
}

// --- SVG Avatar ---

export type FaceShape = "round" | "square" | "oval";
export type HairStyle = "short" | "spiky" | "side-part" | "curly" | "buzz";
export type EyeStyle = "dot" | "line" | "wide";

const FACE_SHAPES: FaceShape[] = ["round", "square", "oval"];
const HAIR_STYLES: HairStyle[] = ["short", "spiky", "side-part", "curly", "buzz"];
const EYE_STYLES: EyeStyle[] = ["dot", "line", "wide"];
const SKIN_COLORS = ["#fde2c8", "#f5c5a0", "#d4956b", "#a0714f", "#6b4226", "#ffe0bd"];
const HAIR_COLORS = ["#2c1b0e", "#5a3214", "#c2884a", "#e8c068"];

export interface SvgAvatarData {
  faceShape: FaceShape;
  hairStyle: HairStyle;
  eyeStyle: EyeStyle;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
}

export function generateSvgAvatar(agentId: string): SvgAvatarData {
  const h = hashString(agentId);
  const bits = (offset: number, count: number) => (h >>> offset) % count;

  return {
    faceShape: FACE_SHAPES[bits(0, FACE_SHAPES.length)],
    hairStyle: HAIR_STYLES[bits(3, HAIR_STYLES.length)],
    eyeStyle: EYE_STYLES[bits(6, EYE_STYLES.length)],
    skinColor: SKIN_COLORS[bits(8, SKIN_COLORS.length)],
    hairColor: HAIR_COLORS[bits(11, HAIR_COLORS.length)],
    shirtColor: PALETTE[h % PALETTE.length],
  };
}

// --- Game-style full-body pawn appearance ---

const PANTS_COLORS = ["#3a4a63", "#52525b", "#5b4636", "#334155", "#4a3f63", "#6b3f4a"];
const SHOE_COLORS = ["#3f3f46", "#7c2d12", "#1e293b", "#525252"];

/** Saturated, friendly shirt colors that read well at small sizes */
const SHIRT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
];

export interface PawnAppearance {
  hairStyle: HairStyle;
  eyeStyle: EyeStyle;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  shoeColor: string;
}

export function generatePawnAppearance(agentId: string): PawnAppearance {
  const h = hashString(agentId);
  const bits = (offset: number, count: number) => (h >>> offset) % count;

  return {
    hairStyle: HAIR_STYLES[bits(3, HAIR_STYLES.length)],
    eyeStyle: EYE_STYLES[bits(6, EYE_STYLES.length)],
    skinColor: SKIN_COLORS[bits(8, SKIN_COLORS.length)],
    hairColor: HAIR_COLORS[bits(11, HAIR_COLORS.length)],
    shirtColor: SHIRT_COLORS[h % SHIRT_COLORS.length],
    pantsColor: PANTS_COLORS[bits(14, PANTS_COLORS.length)],
    shoeColor: SHOE_COLORS[bits(17, SHOE_COLORS.length)],
  };
}
