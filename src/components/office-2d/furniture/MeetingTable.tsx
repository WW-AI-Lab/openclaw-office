import { memo } from "react";

interface MeetingTableProps {
  x: number;
  y: number;
  radius?: number;
  isDark?: boolean;
}

export const MeetingTable = memo(function MeetingTable({
  x,
  y,
  radius = 80,
  isDark = false,
}: MeetingTableProps) {
  const gradId = `mt-grad-${x}-${y}`;
  const surface = isDark ? "#5d4a35" : "#dfb27a";
  const surfaceCenter = isDark ? "#6e5a42" : "#eccb98";
  const edge = isDark ? "#42351f" : "#b98a4c";

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0%" stopColor={surfaceCenter} />
          <stop offset="100%" stopColor={surface} />
        </radialGradient>
      </defs>
      {/* Table top */}
      <circle
        r={radius}
        fill={`url(#${gradId})`}
        stroke={edge}
        strokeWidth={2.5}
        style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.18))" }}
      />
      {/* Wood grain rings */}
      <circle r={radius * 0.66} fill="none" stroke={edge} strokeWidth={0.8} opacity={0.35} />
      <circle r={radius * 0.4} fill="none" stroke={edge} strokeWidth={0.8} opacity={0.25} />

      {/* Center decor: open laptop + papers */}
      <g transform="translate(0, -2)">
        <rect
          x={-22}
          y={2}
          width={16}
          height={11}
          rx={1.5}
          fill={isDark ? "#d6d3d1" : "#fffbeb"}
          stroke={isDark ? "#78716c" : "#d6c9a8"}
          strokeWidth={0.6}
          transform="rotate(10 -14 7)"
        />
        <rect
          x={4}
          y={-10}
          width={17}
          height={12}
          rx={2}
          fill={isDark ? "#1c1917" : "#44403c"}
          transform="rotate(-8 12 -4)"
        />
        <rect
          x={6}
          y={-8}
          width={13}
          height={8}
          rx={1}
          fill={isDark ? "#334155" : "#7dd3fc"}
          transform="rotate(-8 12 -4)"
          opacity={0.9}
        />
      </g>
    </g>
  );
});
