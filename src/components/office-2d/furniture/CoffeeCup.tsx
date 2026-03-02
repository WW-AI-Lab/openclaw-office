import { memo } from "react";

interface CoffeeCupProps {
  x: number;
  y: number;
}

export const CoffeeCup = memo(function CoffeeCup({ x, y }: CoffeeCupProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Saucer */}
      <ellipse cx={0} cy={4} rx={9} ry={3} fill="#d1d5db" opacity={0.5} />
      {/* Cup body */}
      <rect
        x={-5}
        y={-4}
        width={10}
        height={10}
        rx={2}
        fill="#f5f5f4"
        stroke="#d1d5db"
        strokeWidth={0.6}
      />
      {/* Coffee surface */}
      <ellipse cx={0} cy={-2} rx={4} ry={1.5} fill="#92400e" opacity={0.7} />
      {/* Handle */}
      <path d="M 5 -1 Q 9 -1 9 3 Q 9 6 5 6" fill="none" stroke="#d1d5db" strokeWidth={1} />
      {/* Steam */}
      <path d="M -1 -7 Q 0 -10 1 -7" fill="none" stroke="#94a3b8" strokeWidth={0.5} opacity={0.4} />
    </g>
  );
});
