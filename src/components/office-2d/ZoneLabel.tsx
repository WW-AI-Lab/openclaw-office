import { useTranslation } from "react-i18next";
import { ZONES } from "@/lib/constants";
import { useOfficeStore } from "@/store/office-store";

interface ZoneLabelProps {
  zone: { x: number; y: number; width: number; height: number; label: string };
  zoneKey: keyof typeof ZONES;
}

export function ZoneLabel({ zone, zoneKey }: ZoneLabelProps) {
  const { t } = useTranslation("common");
  const theme = useOfficeStore((s) => s.theme);
  const isDark = theme === "dark";
  const labelText = t(`zones.${zoneKey}`);
  const labelX = zone.x + zone.width - 10;
  const labelY = zone.y + 22;

  // Tag dimensions
  const tagPaddingH = 8;
  const tagHeight = 20;
  // Approximate text width (Chinese chars are ~11px at fontSize 12)
  const textWidth = labelText.length * 12 + 4;
  const tagWidth = textWidth + tagPaddingH * 2;
  const tagX = labelX - tagWidth;

  return (
    <g>
      {/* Tag background */}
      <rect
        x={tagX}
        y={labelY - tagHeight / 2 - 2}
        width={tagWidth}
        height={tagHeight}
        rx={4}
        fill={isDark ? "rgba(0, 212, 170, 0.15)" : "rgba(0, 212, 170, 0.12)"}
      />
      {/* Tag text */}
      <text
        x={tagX + tagWidth / 2}
        y={labelY + 1}
        textAnchor="middle"
        fill={isDark ? "#00D4AA" : "#00D4AA"}
        fontSize={11}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="0.02em"
      >
        {labelText}
      </text>
    </g>
  );
}
