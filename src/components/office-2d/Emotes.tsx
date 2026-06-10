import { memo } from "react";

/**
 * Game-style emote bubbles shown above a pawn's head.
 * All emotes anchor at (0,0) = a point just above the head (y≈-30 in pawn space).
 */

const popBob: React.CSSProperties = {
  transformBox: "fill-box",
  transformOrigin: "center bottom",
  animation: "emote-pop 0.25s ease-out, emote-bob 2s ease-in-out 0.25s infinite",
};

/** Cloud-shaped thought bubble with animated dots (thinking) */
export const ThoughtEmote = memo(function ThoughtEmote({ isDark }: { isDark: boolean }) {
  const fill = isDark ? "#e2e8f0" : "#ffffff";
  const stroke = isDark ? "#94a3b8" : "#cbd5e1";
  return (
    <g style={popBob}>
      {/* Trailing thought circles */}
      <circle cx={-4} cy={-2} r={1.6} fill={fill} stroke={stroke} strokeWidth={0.6} />
      <circle cx={-7} cy={-7} r={2.4} fill={fill} stroke={stroke} strokeWidth={0.6} />
      {/* Cloud */}
      <g transform="translate(0, -16)">
        <ellipse cx={0} cy={0} rx={13} ry={8} fill={fill} stroke={stroke} strokeWidth={0.8} />
        <ellipse cx={-8} cy={-3} rx={6} ry={5} fill={fill} />
        <ellipse cx={7} cy={-3} rx={6.5} ry={5.5} fill={fill} />
        <ellipse cx={0} cy={-5} rx={7} ry={5.5} fill={fill} />
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={(i - 1) * 5}
            cy={-1}
            r={1.8}
            fill="#3b82f6"
            style={{ animation: `thinking-dots 1.2s ease-in-out ${i * 0.18}s infinite` }}
          />
        ))}
      </g>
    </g>
  );
});

/** Speech bubble with live text snippet (speaking) */
export const SpeechEmote = memo(function SpeechEmote({
  text,
  isDark,
}: {
  text: string;
  isDark: boolean;
}) {
  const snippet = text.replace(/\s+/g, " ").trim().slice(-46);
  const bg = isDark ? "rgba(226,232,240,0.96)" : "rgba(255,255,255,0.96)";
  return (
    <g style={popBob}>
      {/* Tail */}
      <path d="M -3 -3 L 0 3 L 4 -3 Z" fill={bg} stroke="#c4b5fd" strokeWidth={0.8} />
      <foreignObject x={-62} y={-40} width={124} height={38} style={{ pointerEvents: "none" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" }}>
          <div
            style={{
              fontSize: "9px",
              lineHeight: "11px",
              fontWeight: 500,
              color: "#3b2d63",
              backgroundColor: bg,
              border: "1px solid #c4b5fd",
              borderRadius: "8px",
              padding: "3px 7px",
              maxWidth: "120px",
              maxHeight: "34px",
              overflow: "hidden",
              overflowWrap: "anywhere",
              boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
            }}
          >
            {snippet || "…"}
          </div>
        </div>
      </foreignObject>
    </g>
  );
});

/** Spinning gear bubble + tool name (tool_calling) */
export const ToolEmote = memo(function ToolEmote({
  toolName,
  isDark,
}: {
  toolName: string;
  isDark: boolean;
}) {
  const bg = isDark ? "#451a03" : "#fff7ed";
  return (
    <g style={popBob}>
      <path d="M -3 -3 L 0 3 L 4 -3 Z" fill={bg} stroke="#fb923c" strokeWidth={0.8} />
      <g transform="translate(0, -13)">
        <rect
          x={-32}
          y={-10}
          width={64}
          height={17}
          rx={8.5}
          fill={bg}
          stroke="#fb923c"
          strokeWidth={1}
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.12))" }}
        />
        {/* Spinning gear */}
        <g transform="translate(-23, -1.5)">
          <g
            style={{
              animation: "gear-spin 2s linear infinite",
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          >
            <Gear />
          </g>
        </g>
        <text
          x={4}
          y={2}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={700}
          fill={isDark ? "#fdba74" : "#c2410c"}
          fontFamily="ui-monospace, monospace"
        >
          {toolName.length > 12 ? `${toolName.slice(0, 11)}…` : toolName}
        </text>
      </g>
    </g>
  );
});

function Gear() {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return (
      <rect
        key={i}
        x={-1.2}
        y={-6.2}
        width={2.4}
        height={3}
        rx={0.8}
        fill="#f97316"
        transform={`rotate(${(a * 180) / Math.PI})`}
      />
    );
  });
  return (
    <g>
      {teeth}
      <circle r={4.2} fill="#f97316" />
      <circle r={1.7} fill="#fff7ed" />
    </g>
  );
}

/** Bouncing red exclamation (error) */
export const ErrorEmote = memo(function ErrorEmote() {
  return (
    <g
      style={{
        transformBox: "fill-box",
        transformOrigin: "center bottom",
        animation: "emote-pop 0.2s ease-out, emote-bounce 0.7s ease-in-out 0.2s infinite",
      }}
    >
      <g transform="translate(0, -10)">
        <path
          d="M 0 -10 L 8.5 5 L -8.5 5 Z"
          fill="#ef4444"
          stroke="#b91c1c"
          strokeWidth={1}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}
        />
        <rect x={-1.2} y={-5.5} width={2.4} height={5.5} rx={1.2} fill="#fff" />
        <circle cx={0} cy={2.5} r={1.4} fill="#fff" />
      </g>
    </g>
  );
});

/** Floating Zzz (offline / sleeping placeholder) */
export const ZzzEmote = memo(function ZzzEmote({ isDark }: { isDark: boolean }) {
  const color = isDark ? "#94a3b8" : "#64748b";
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <text
          key={i}
          x={i * 4}
          y={-i * 5}
          fontSize={7 + i * 2}
          fontWeight={700}
          fill={color}
          fontFamily="ui-rounded, system-ui"
          style={{
            animation: `zzz-float 2.4s ease-out ${i * 0.8}s infinite`,
            transformBox: "fill-box",
          }}
        >
          z
        </text>
      ))}
    </g>
  );
});

/** Twinkling sparkles (spawning) */
export const SparkleEmote = memo(function SparkleEmote() {
  const sparkles = [
    { x: -12, y: -6, s: 1, d: 0 },
    { x: 10, y: -12, s: 0.8, d: 0.3 },
    { x: 0, y: -18, s: 1.1, d: 0.6 },
  ];
  return (
    <g>
      {sparkles.map((sp, i) => (
        <g key={i} transform={`translate(${sp.x}, ${sp.y}) scale(${sp.s})`}>
          <path
            d="M 0 -5 L 1.3 -1.3 L 5 0 L 1.3 1.3 L 0 5 L -1.3 1.3 L -5 0 L -1.3 -1.3 Z"
            fill="#22d3ee"
            style={{
              animation: `sparkle-twinkle 1.1s ease-in-out ${sp.d}s infinite`,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          />
        </g>
      ))}
    </g>
  );
});
