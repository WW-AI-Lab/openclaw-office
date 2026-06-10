import { memo } from "react";

interface PlantProps {
  x: number;
  y: number;
}

export const Plant = memo(function Plant({ x, y }: PlantProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Soft shadow */}
      <ellipse cx={0} cy={21} rx={11} ry={3} fill="rgba(0,0,0,0.12)" />
      {/* Pot */}
      <path
        d="M -8 6 L -10 18 Q -10 22 -6 22 L 6 22 Q 10 22 10 18 L 8 6 Z"
        fill="#c0714c"
        stroke="#9a5638"
        strokeWidth={0.8}
      />
      <rect x={-9.5} y={4} width={19} height={4} rx={2} fill="#d28157" />
      {/* Leaves */}
      <ellipse cx={0} cy={-3} rx={11} ry={10} fill="#4ade80" />
      <ellipse cx={-6} cy={-9} rx={7} ry={6} fill="#22c55e" />
      <ellipse cx={6} cy={-7} rx={6.5} ry={5.5} fill="#16a34a" />
      <ellipse cx={1} cy={-12} rx={4.5} ry={4} fill="#86efac" opacity={0.9} />
    </g>
  );
});
