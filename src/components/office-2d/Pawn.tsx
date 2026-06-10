import { memo } from "react";
import type { PawnAppearance } from "@/lib/avatar-generator";

export type PawnPose = "stand" | "sit" | "walk";
export type PawnMotion = "none" | "typing" | "talking" | "shaking";

interface PawnProps {
  appearance: PawnAppearance;
  pose: PawnPose;
  motion?: PawnMotion;
  /** 1 = facing right/front, -1 = mirrored (walking left) */
  facing?: 1 | -1;
  /** Ghost rendering for placeholders / unconfirmed agents */
  ghost?: boolean;
}

const OUTLINE = "rgba(30, 20, 10, 0.3)";

/** Darken a hex color by a factor (0–1) for sleeves/shading */
function shade(hex: string, factor: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

/**
 * Game-style chibi character ("digital person").
 * Anchor (0,0) sits at the hips; feet rest at y≈16, hair top at y≈-29.
 */
export const Pawn = memo(function Pawn({
  appearance,
  pose,
  motion = "none",
  facing = 1,
  ghost = false,
}: PawnProps) {
  const isWalking = pose === "walk";
  const isTyping = motion === "typing" && pose === "sit";
  const isTalking = motion === "talking";
  const isShaking = motion === "shaking";

  const skin = ghost ? "#9ca3af" : appearance.skinColor;
  const hair = ghost ? "#6b7280" : appearance.hairColor;
  const shirt = ghost ? "#9ca3af" : appearance.shirtColor;
  const pants = ghost ? "#6b7280" : appearance.pantsColor;
  const shoes = ghost ? "#4b5563" : appearance.shoeColor;
  const sleeve = shade(shirt, 0.82);

  return (
    <g>
      {/* Ground shadow (never shakes/flips) */}
      <ellipse cx={0} cy={17.5} rx={11.5} ry={3} fill="rgba(0,0,0,0.18)" />

      <g
        style={
          isShaking
            ? {
                animation: "pawn-shake 0.45s linear infinite",
                transformBox: "fill-box",
                transformOrigin: "center",
              }
            : undefined
        }
      >
        <g transform={facing === -1 ? "scale(-1, 1)" : undefined}>
          {/* ── Legs ── */}
          <Leg side={-1} pose={pose} walking={isWalking} pants={pants} shoes={shoes} />
          <Leg side={1} pose={pose} walking={isWalking} pants={pants} shoes={shoes} />

          {/* ── Torso (breathes when idle) ── */}
          <g
            style={
              !isWalking && !isShaking
                ? {
                    animation: "pawn-breathe 3.2s ease-in-out infinite",
                    transformBox: "fill-box",
                    transformOrigin: "center bottom",
                  }
                : undefined
            }
          >
            <rect
              x={-8}
              y={-11}
              width={16}
              height={15.5}
              rx={6}
              fill={shirt}
              stroke={OUTLINE}
              strokeWidth={1}
            />
            {/* Shirt collar hint */}
            <path
              d="M -3 -10.6 L 0 -7.8 L 3 -10.6"
              fill="none"
              stroke={shade(shirt, 0.7)}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          </g>

          {/* ── Arms ── */}
          <Arm
            side={-1}
            walking={isWalking}
            typing={isTyping}
            sleeve={sleeve}
            skin={skin}
          />
          <Arm
            side={1}
            walking={isWalking}
            typing={isTyping}
            sleeve={sleeve}
            skin={skin}
          />

          {/* ── Head ── */}
          <g>
            <circle cx={0} cy={-19} r={8.5} fill={skin} stroke={OUTLINE} strokeWidth={1} />
            <Hair style={appearance.hairStyle} color={hair} />
            {/* Eyes with blink */}
            <g
              style={{
                animation: "pawn-blink 4.2s ease-in-out infinite",
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            >
              <Eyes style={appearance.eyeStyle} />
            </g>
            {/* Mouth */}
            {isTalking ? (
              <ellipse
                cx={0}
                cy={-14.6}
                rx={1.8}
                ry={1.6}
                fill="#7c2d12"
                style={{
                  animation: "pawn-mouth-talk 0.35s ease-in-out infinite",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />
            ) : (
              <path
                d="M -1.8 -14.6 Q 0 -13.2 1.8 -14.6"
                fill="none"
                stroke="#7c2d12"
                strokeWidth={1}
                strokeLinecap="round"
              />
            )}
          </g>
        </g>
      </g>
    </g>
  );
});

/* ── Body parts ── */

function Leg({
  side,
  pose,
  walking,
  pants,
  shoes,
}: {
  side: -1 | 1;
  pose: PawnPose;
  walking: boolean;
  pants: string;
  shoes: string;
}) {
  const hipX = side * 3.5;
  const legH = pose === "sit" ? 7 : 11;
  const shoeY = pose === "sit" ? 5 : 8.5;

  return (
    <g transform={`translate(${hipX}, 3)`}>
      <g
        style={
          walking
            ? {
                animation: `pawn-swing 0.5s ease-in-out infinite alternate`,
                animationDelay: side === 1 ? "-0.5s" : "0s",
                transformBox: "fill-box",
                transformOrigin: "center top",
              }
            : undefined
        }
      >
        <rect
          x={-2.5}
          y={-1}
          width={5}
          height={legH}
          rx={2.4}
          fill={pants}
          stroke={OUTLINE}
          strokeWidth={0.8}
        />
        <rect x={-3} y={shoeY} width={6} height={4.5} rx={2} fill={shoes} />
      </g>
    </g>
  );
}

function Arm({
  side,
  walking,
  typing,
  sleeve,
  skin,
}: {
  side: -1 | 1;
  walking: boolean;
  typing: boolean;
  sleeve: string;
  skin: string;
}) {
  const shoulderX = side * 8.5;
  // Typing: arms angled forward toward the keyboard
  const baseRotate = typing ? side * -28 : 0;

  let animStyle: React.CSSProperties | undefined;
  if (walking) {
    animStyle = {
      animation: "pawn-swing 0.5s ease-in-out infinite alternate",
      animationDelay: side === 1 ? "0s" : "-0.5s",
      transformBox: "fill-box",
      transformOrigin: "center top",
    };
  } else if (typing) {
    animStyle = {
      animation: "pawn-type 0.28s ease-in-out infinite",
      animationDelay: side === 1 ? "-0.14s" : "0s",
      transformBox: "fill-box",
      transformOrigin: "center top",
    };
  }

  return (
    <g transform={`translate(${shoulderX}, -8) rotate(${baseRotate})`}>
      <g style={animStyle}>
        <rect
          x={-2}
          y={-1}
          width={4}
          height={8.5}
          rx={2}
          fill={sleeve}
          stroke={OUTLINE}
          strokeWidth={0.8}
        />
        <circle cx={0} cy={8.6} r={2.4} fill={skin} stroke={OUTLINE} strokeWidth={0.7} />
      </g>
    </g>
  );
}

function Hair({ style, color }: { style: PawnAppearance["hairStyle"]; color: string }) {
  switch (style) {
    case "short":
      return (
        <path
          d="M -8.3 -20 Q -8.3 -28.5 0 -28.5 Q 8.3 -28.5 8.3 -20 Q 4 -23.5 0 -23.5 Q -4 -23.5 -8.3 -20 Z"
          fill={color}
        />
      );
    case "spiky":
      return (
        <g fill={color}>
          <path d="M -8.3 -20 Q -8.3 -27.5 0 -27.5 Q 8.3 -27.5 8.3 -20 Q 4 -23 0 -23 Q -4 -23 -8.3 -20 Z" />
          <polygon points="-6,-25.5 -5,-30.5 -3,-26.5" />
          <polygon points="-1.5,-26.5 0,-31.5 1.5,-26.5" />
          <polygon points="3,-26.5 5,-30.5 6,-25.5" />
        </g>
      );
    case "side-part":
      return (
        <g fill={color}>
          <path d="M -8.3 -19.5 Q -8.5 -28.5 -1 -28.5 Q 8.3 -28.5 8.3 -19.5 Q 6.5 -24.5 2 -25 Q -3 -25.5 -8.3 -19.5 Z" />
          <path d="M 4 -27.5 Q 8.8 -26 8.5 -21 L 6.2 -23.5 Z" />
        </g>
      );
    case "curly":
      return (
        <g fill={color}>
          <circle cx={-5.5} cy={-24} r={3.4} />
          <circle cx={0} cy={-26.5} r={3.6} />
          <circle cx={5.5} cy={-24} r={3.4} />
          <circle cx={-7.8} cy={-20} r={2.6} />
          <circle cx={7.8} cy={-20} r={2.6} />
        </g>
      );
    case "buzz":
      return (
        <path
          d="M -8 -21 Q -8 -27.5 0 -27.5 Q 8 -27.5 8 -21 Q 4 -24 0 -24 Q -4 -24 -8 -21 Z"
          fill={color}
          opacity={0.72}
        />
      );
    default:
      return null;
  }
}

function Eyes({ style }: { style: PawnAppearance["eyeStyle"] }) {
  const ey = -19.5;
  const gap = 3.2;
  switch (style) {
    case "dot":
      return (
        <g>
          <circle cx={-gap} cy={ey} r={1.3} fill="#1f2937" />
          <circle cx={gap} cy={ey} r={1.3} fill="#1f2937" />
        </g>
      );
    case "line":
      return (
        <g stroke="#1f2937" strokeWidth={1.1} strokeLinecap="round">
          <line x1={-gap - 1.6} y1={ey} x2={-gap + 1.6} y2={ey} />
          <line x1={gap - 1.6} y1={ey} x2={gap + 1.6} y2={ey} />
        </g>
      );
    case "wide":
      return (
        <g>
          <ellipse cx={-gap} cy={ey} rx={1.9} ry={2.2} fill="#fff" stroke="#1f2937" strokeWidth={0.6} />
          <circle cx={-gap} cy={ey + 0.3} r={1} fill="#1f2937" />
          <ellipse cx={gap} cy={ey} rx={1.9} ry={2.2} fill="#fff" stroke="#1f2937" strokeWidth={0.6} />
          <circle cx={gap} cy={ey + 0.3} r={1} fill="#1f2937" />
        </g>
      );
    default:
      return null;
  }
}
