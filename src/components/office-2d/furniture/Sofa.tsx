import { memo } from "react";

interface SofaProps {
  x: number;
  y: number;
  rotation?: number;
  isDark?: boolean;
}

export const Sofa = memo(function Sofa({ x, y, rotation = 0, isDark = false }: SofaProps) {
  const cushion = isDark ? "#7a4438" : "#e2725b";
  const cushionHi = isDark ? "#8a5244" : "#ea8a76";
  const frame = isDark ? "#52302a" : "#c05743";
  const pillow = isDark ? "#9a6253" : "#f4b09e";

  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
      {/* Sofa frame */}
      <rect x={-55} y={-22} width={110} height={44} rx={12} fill={frame} />
      {/* Seat cushions */}
      <rect x={-49} y={-15} width={47} height={32} rx={7} fill={cushion} />
      <rect x={2} y={-15} width={47} height={32} rx={7} fill={cushion} />
      <rect x={-49} y={-15} width={47} height={10} rx={5} fill={cushionHi} opacity={0.55} />
      <rect x={2} y={-15} width={47} height={10} rx={5} fill={cushionHi} opacity={0.55} />
      {/* Pillows */}
      <rect x={-40} y={-9} width={16} height={16} rx={5} fill={pillow} transform="rotate(-10 -32 -1)" />
      <rect x={24} y={-9} width={16} height={16} rx={5} fill={pillow} transform="rotate(10 32 -1)" />
      {/* Backrest */}
      <rect x={-53} y={-26} width={106} height={9} rx={4.5} fill={frame} />
    </g>
  );
});
