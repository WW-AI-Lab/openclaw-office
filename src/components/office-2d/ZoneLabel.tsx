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
  const textColor = isDark ? "#8a7355" : "#a98f68";

  return (
    <text
      x={zone.x + 14}
      y={zone.y + 22}
      fill={textColor}
      fontSize={11}
      fontWeight={600}
      fontFamily="system-ui, sans-serif"
      letterSpacing="0.05em"
    >
      {t(`zones.${zoneKey}`)}
    </text>
  );
}
