import { memo } from "react";

interface DeskProps {
  x: number;
  y: number;
  isDark?: boolean;
  /** Agent at this desk is actively working — monitor lights up */
  active?: boolean;
}

export const Desk = memo(function Desk({ x, y, isDark = false, active = false }: DeskProps) {
  const surface = isDark ? "#5d4a35" : "#e2b97f";
  const surfaceHi = isDark ? "#6b5740" : "#ecc893";
  const edge = isDark ? "#42351f" : "#b98a4c";
  const plank = isDark ? "#4f3f2b" : "#d3a96c";
  const monitorFrame = isDark ? "#1c1917" : "#44403c";
  const screenOff = isDark ? "#334155" : "#64748b";

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Desk top — warm wood */}
      <rect
        x={-50}
        y={-6}
        width={100}
        height={60}
        rx={7}
        fill={surface}
        stroke={edge}
        strokeWidth={1.5}
      />
      {/* Wood plank lines */}
      <line x1={-46} y1={14} x2={46} y2={14} stroke={plank} strokeWidth={1} opacity={0.8} />
      <line x1={-46} y1={34} x2={46} y2={34} stroke={plank} strokeWidth={1} opacity={0.8} />
      {/* Top highlight strip */}
      <rect x={-46} y={-3} width={92} height={4} rx={2} fill={surfaceHi} opacity={0.7} />
      {/* Desk front edge (depth) */}
      <path d="M -50 54 L -50 58 Q -50 64 -44 64 L 44 64 Q 50 64 50 58 L 50 54" fill={edge} />

      {/* Monitor */}
      <g transform="translate(0, 14)">
        {/* Stand */}
        <rect x={-4} y={12} width={8} height={4} rx={1.5} fill={monitorFrame} />
        <rect x={-9} y={15} width={18} height={3} rx={1.5} fill={monitorFrame} />
        {/* Screen */}
        <rect x={-19} y={-12} width={38} height={25} rx={3} fill={monitorFrame} />
        <rect
          x={-16.5}
          y={-9.5}
          width={33}
          height={20}
          rx={1.5}
          fill={active ? (isDark ? "#0c4a6e" : "#0ea5e9") : screenOff}
          style={active ? { animation: "monitor-glow 1.6s ease-in-out infinite" } : undefined}
        />
        {/* Code lines on active screen */}
        {active && (
          <g opacity={0.9}>
            <rect x={-13} y={-6} width={14} height={2} rx={1} fill="#a5f3fc" />
            <rect x={-13} y={-2} width={20} height={2} rx={1} fill="#67e8f9" opacity={0.7} />
            <rect x={-10} y={2} width={12} height={2} rx={1} fill="#a5f3fc" opacity={0.5} />
            <rect x={-13} y={6} width={17} height={2} rx={1} fill="#67e8f9" opacity={0.65} />
          </g>
        )}
      </g>

      {/* Keyboard */}
      <rect
        x={-15}
        y={37}
        width={30}
        height={11}
        rx={2.5}
        fill={isDark ? "#292524" : "#d6d3d1"}
        stroke={isDark ? "#1c1917" : "#a8a29e"}
        strokeWidth={0.7}
      />
      <g stroke={isDark ? "#44403c" : "#a8a29e"} strokeWidth={0.6} opacity={0.8}>
        <line x1={-11} y1={40} x2={11} y2={40} />
        <line x1={-11} y1={43} x2={11} y2={43} />
      </g>

      {/* Coffee mug on the desk corner */}
      <g transform="translate(32, 42)">
        <circle r={4.5} fill={isDark ? "#7c2d12" : "#dc8a5d"} stroke={edge} strokeWidth={0.8} />
        <circle r={2.6} fill={isDark ? "#451a03" : "#92400e"} />
        <path
          d="M 4 -2 Q 8 -1 4 2"
          fill="none"
          stroke={isDark ? "#7c2d12" : "#dc8a5d"}
          strokeWidth={1.4}
        />
      </g>

      {/* Small notepad */}
      <rect
        x={-40}
        y={38}
        width={13}
        height={10}
        rx={1.5}
        fill={isDark ? "#d6d3d1" : "#fffbeb"}
        stroke={isDark ? "#78716c" : "#d6c9a8"}
        strokeWidth={0.6}
        transform="rotate(-8 -33 43)"
      />
    </g>
  );
});
