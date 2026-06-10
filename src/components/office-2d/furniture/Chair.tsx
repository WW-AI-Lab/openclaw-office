import { memo } from "react";

interface ChairProps {
  x: number;
  y: number;
  isDark?: boolean;
}

export const Chair = memo(function Chair({ x, y, isDark = false }: ChairProps) {
  const seat = isDark ? "#3f4a5c" : "#7d93ab";
  const seatHi = isDark ? "#4d5a6e" : "#93a8bf";
  const back = isDark ? "#2e3745" : "#5f7488";

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Backrest (behind the pawn — arc at the top) */}
      <path
        d="M -12 -12 Q 0 -19 12 -12"
        fill="none"
        stroke={back}
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Seat cushion */}
      <circle r={12.5} fill={seat} stroke={back} strokeWidth={1.2} />
      <circle r={8} fill={seatHi} opacity={0.6} />
    </g>
  );
});
