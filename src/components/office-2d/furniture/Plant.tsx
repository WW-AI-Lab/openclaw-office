import { memo } from "react";

interface PlantProps {
  x: number;
  y: number;
  isDark?: boolean;
  glow?: boolean;
}

export const Plant = memo(function Plant({ x, y, isDark = false, glow = false }: PlantProps) {
  // 现代简约花盆
  const potColor = isDark ? "#334155" : "#f5f5f4";
  const soilColor = isDark ? "#1e293b" : "#78716c";
  // 叶子 - 更鲜艳的绿色
  const leafLight = isDark ? "#00D4AA" : "#86efac";
  const leafDark = isDark ? "#00A080" : "#4ade80";

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow effect */}
      {glow && (
        <ellipse
          cx={0}
          cy={0}
          rx={20}
          ry={25}
          fill={leafLight}
          opacity={0.08}
          style={{ filter: `blur(8px)` }}
        />
      )}
      {/* Soft shadow */}
      <ellipse cx={0} cy={21} rx={11} ry={3} fill="rgba(0,0,0,0.12)" />
      {/* Pot */}
      <path
        d="M -8 6 L -10 18 Q -10 22 -6 22 L 6 22 Q 10 22 10 18 L 8 6 Z"
        fill={potColor}
        stroke={isDark ? "#475569" : "#d6d3d1"}
        strokeWidth={1}
      />
      <rect x={-9.5} y={4} width={19} height={4} rx={2} fill={potColor} opacity={0.8} />
      {/* Soil */}
      <ellipse cx={0} cy={18} rx={8} ry={2} fill={soilColor} />

      {/* Leaves — simple three-leaf arrangement with optional glow */}
      <ellipse cx={0} cy={-2} rx={12} ry={10} fill={leafDark} opacity={glow ? 0.9 : 0.85} />
      <ellipse cx={-6} cy={-8} rx={8} ry={6} fill={leafLight} opacity={glow ? 0.85 : 0.7} />
      <ellipse cx={6} cy={-6} rx={7} ry={5} fill={leafDark} opacity={glow ? 0.8 : 0.6} />

      {/* Highlight detail */}
      <circle cx={-4} cy={-4} r={3} fill={leafLight} opacity={glow ? 0.5 : 0.3} />
    </g>
  );
});