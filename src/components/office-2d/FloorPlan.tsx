import { useMemo } from "react";
import type { VisualAgent } from "@/gateway/types";
import {
  SVG_WIDTH,
  SVG_HEIGHT,
  OFFICE,
  ZONES,
  ZONE_COLORS,
  ZONE_COLORS_DARK,
} from "@/lib/constants";
import { calculateDeskSlots } from "@/lib/position-allocator";
import { useOfficeStore } from "@/store/office-store";
import {
  detectMeetingGroups,
  calculateMeetingSeats,
  MEETING_TABLE_CENTERS,
} from "@/store/meeting-manager";
import { AgentAvatar } from "./AgentAvatar";
import { ConnectionLine } from "./ConnectionLine";
import { DeskUnit } from "./DeskUnit";
import { MeetingTable, Sofa, Plant, CoffeeCup, Chair } from "./furniture";
import { ZoneLabel } from "./ZoneLabel";

export function FloorPlan() {
  const agents = useOfficeStore((s) => s.agents);
  const links = useOfficeStore((s) => s.links);
  const theme = useOfficeStore((s) => s.theme);

  const agentList = Array.from(agents.values());
  const isDark = theme === "dark";
  const colors = isDark ? ZONE_COLORS_DARK : ZONE_COLORS;

  const deskAgents = useMemo(
    () => agentList.filter((a) => a.zone === "desk" && !a.isSubAgent && !a.movement && a.confirmed),
    [agentList],
  );
  const hotDeskAgents = useMemo(
    () => agentList.filter((a) => a.zone === "hotDesk" && !a.movement),
    [agentList],
  );
  const loungeAgents = useMemo(
    () => agentList.filter((a) => a.zone === "lounge" && !a.movement && !a.isPlaceholder),
    [agentList],
  );
  const meetingAgents = useMemo(
    () => agentList.filter((a) => a.zone === "meeting" && !a.movement && !a.isPlaceholder),
    [agentList],
  );
  const walkingAgents = useMemo(
    () => agentList.filter((a) => a.movement !== null && !a.isPlaceholder),
    [agentList],
  );
  const corridorAgents = useMemo(
    () => agentList.filter((a) => a.zone === "corridor" && !a.movement && !a.isPlaceholder),
    [agentList],
  );

  const maxSubAgents = useOfficeStore((s) => s.maxSubAgents);

  const deskSlots = useMemo(
    () => calculateDeskSlots(ZONES.desk, deskAgents.length, Math.max(deskAgents.length, 4)),
    [deskAgents.length],
  );

  const hotDeskSlots = useMemo(
    () =>
      calculateDeskSlots(
        ZONES.hotDesk,
        hotDeskAgents.length,
        Math.max(hotDeskAgents.length, maxSubAgents),
      ),
    [hotDeskAgents.length, maxSubAgents],
  );

  // 多桌渲染：用 detectMeetingGroups 的分组结果，每组渲染一张桌子
  const meetingGroups = useMemo(
    () => detectMeetingGroups(links, agents),
    [links, agents],
  );

  // 每组的座位分配（基于 agent.position，已由 store 的 moveToMeeting + allocateMeetingPositions 分配好）
  // 这里只需要知道每组有哪些 agent + 对应的 tableCenter 用于渲染桌子和椅子
  const meetingGroupTableData = useMemo(() => {
    return meetingGroups.map((group, i) => {
      const center = MEETING_TABLE_CENTERS[i % MEETING_TABLE_CENTERS.length];
      const seatsMap = calculateMeetingSeats(group, i);
      const agentsInGroup = group.agentIds
        .map((id) => agents.get(id))
        .filter((a): a is VisualAgent => a !== undefined);
      return { group, center, seatsMap, agentsInGroup };
    });
  }, [meetingGroups, agents]);

  // 默认的单桌圆心（无会议时展示空椅装饰用）
  const defaultMeetingCenter = {
    x: ZONES.meeting.x + ZONES.meeting.width / 2,
    y: ZONES.meeting.y + ZONES.meeting.height / 2,
  };

  return (
    <div className="relative h-full w-full bg-[#ece3d0] dark:bg-[#15110c]">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="building-shadow" x="-3%" y="-3%" width="106%" height="106%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" floodOpacity={isDark ? 0.5 : 0.15} />
          </filter>
          {/* Stone tile pattern for corridor floor */}
          <pattern id="corridor-tiles" width="28" height="28" patternUnits="userSpaceOnUse">
            <rect width="28" height="28" fill={colors.corridor} />
            <rect
              x="0.5"
              y="0.5"
              width="27"
              height="27"
              fill="none"
              stroke={isDark ? "#2a2218" : "#d8cdb4"}
              strokeWidth="0.6"
              rx="2"
            />
          </pattern>
          {/* Long thin wood planks (subtle, low-contrast) */}
          <pattern id="wood-floor" width="160" height="26" patternUnits="userSpaceOnUse">
            <rect width="160" height="26" fill={colors.desk} />
            <g stroke={isDark ? "#332a1c" : "#e8d8b4"} strokeWidth="0.8">
              <line x1="0" y1="0.4" x2="160" y2="0.4" />
              <line x1="0" y1="13.4" x2="160" y2="13.4" />
            </g>
            <g stroke={isDark ? "#332a1c" : "#e8d8b4"} strokeWidth="0.6" opacity="0.7">
              <line x1="56" y1="0" x2="56" y2="13" />
              <line x1="128" y1="13" x2="128" y2="26" />
            </g>
          </pattern>
          {/* Soft carpet texture for lounge */}
          <pattern id="lounge-carpet" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill={colors.lounge} />
            <circle cx="2.5" cy="2.5" r="0.7" fill={isDark ? "#3a2f28" : "#e2d0bc"} opacity="0.6" />
            <circle cx="7.5" cy="7.5" r="0.7" fill={isDark ? "#3a2f28" : "#e2d0bc"} opacity="0.6" />
          </pattern>
        </defs>

        {/* ── Layer 0: Building shell (outer wall) ── */}
        <rect
          x={OFFICE.x}
          y={OFFICE.y}
          width={OFFICE.width}
          height={OFFICE.height}
          rx={OFFICE.cornerRadius}
          fill={colors.corridor}
          stroke={colors.wall}
          strokeWidth={OFFICE.wallThickness}
          filter="url(#building-shadow)"
        />

        {/* ── Layer 1: Corridor floor tiles ── */}
        <CorridorFloor isDark={isDark} />

        {/* ── Layer 2: Zone floor fills — wood planks for work zones, carpet for lounge ── */}
        {Object.entries(ZONES).map(([key, zone]) => (
          <rect
            key={`floor-${key}`}
            x={zone.x}
            y={zone.y}
            width={zone.width}
            height={zone.height}
            fill={key === "lounge" ? "url(#lounge-carpet)" : "url(#wood-floor)"}
          />
        ))}

        {/* ── Layer 3: Internal partition walls ── */}
        <PartitionWalls isDark={isDark} />

        {/* ── Layer 4: Door openings (overlaid on partitions) ── */}
        <DoorOpenings isDark={isDark} />

        {/* Zone labels */}
        {Object.entries(ZONES).map(([key, zone]) => (
          <ZoneLabel key={`label-${key}`} zone={zone} zoneKey={key as keyof typeof ZONES} />
        ))}

        {/* ── Layer 5: Furniture – Desk zone ── */}
        <DeskZoneFurniture deskSlots={deskSlots} deskAgents={deskAgents} />

        {/* ── Layer 5: Furniture – Meeting zone ── */}
        {meetingGroupTableData.length === 0 ? (
          // 无会议时：渲染默认单桌 + 6 空椅装饰
          <>
            <RoundRug x={defaultMeetingCenter.x} y={defaultMeetingCenter.y} radius={130} isDark={isDark} />
            <MeetingTable
              x={defaultMeetingCenter.x}
              y={defaultMeetingCenter.y}
              radius={60}
              isDark={isDark}
            />
            <MeetingChairs
              seats={[]}
              meetingAgentCount={0}
              tableCenter={defaultMeetingCenter}
              isDark={isDark}
            />
          </>
        ) : (
          // 有会议时：先铺所有地毯，再画所有桌椅（避免地毯盖住相邻桌面）
          (() => {
            const tableRadius = (agentCount: number) =>
              Math.min(
                55 + agentCount * 8,
                Math.min(ZONES.meeting.width, ZONES.meeting.height) /
                    (meetingGroupTableData.length > 1 ? 3.5 : 2.3) -
                  20,
              );
            return (
              <>
                {meetingGroupTableData.map((tableData, i) => (
                  <RoundRug
                    key={`meeting-rug-${i}`}
                    x={tableData.center.x}
                    y={tableData.center.y}
                    radius={tableRadius(tableData.agentsInGroup.length) + 22}
                    isDark={isDark}
                  />
                ))}
                {meetingGroupTableData.map((tableData, i) => (
                  <g key={`meeting-table-group-${i}`}>
                    <MeetingTable
                      x={tableData.center.x}
                      y={tableData.center.y}
                      radius={tableRadius(tableData.agentsInGroup.length)}
                      isDark={isDark}
                    />
                    <MeetingChairs
                      seats={tableData.agentsInGroup.map((a) => a.position)}
                      meetingAgentCount={tableData.agentsInGroup.length}
                      tableCenter={tableData.center}
                      isDark={isDark}
                    />
                  </g>
                ))}
              </>
            );
          })()
        )}

        {/* ── Layer 5: Furniture – Hot desk zone ── */}
        <HotDeskZoneFurniture slots={hotDeskSlots} agents={hotDeskAgents} />

        {/* ── Layer 5: Furniture – Lounge zone (incl. reception + entrance) ── */}
        <LoungeDecor isDark={isDark} />

        {/* ── Layer 5a: Lounge idle agents ── */}
        {loungeAgents.map((agent) => (
          <AgentAvatar key={`lounge-${agent.id}`} agent={agent} />
        ))}

        {/* ── Layer 5b: Main entrance door on outer wall ── */}
        <EntranceDoor isDark={isDark} />

        {/* ── Layer 6: Collaboration lines ── */}
        {links.map((link) => {
          const source = agents.get(link.sourceId);
          const target = agents.get(link.targetId);
          if (!source || !target) return null;
          return (
            <ConnectionLine
              key={`${link.sourceId}-${link.targetId}`}
              x1={source.position.x}
              y1={source.position.y}
              x2={target.position.x}
              y2={target.position.y}
              strength={link.strength}
            />
          );
        })}

        {/* ── Layer 7: Meeting agents (seated) — 使用 agent.position（已由 moveToMeeting 分配好） ── */}
        {meetingAgents.map((agent) => (
          <AgentAvatar key={agent.id} agent={agent} />
        ))}

        {/* ── Layer 7b: Unconfirmed agents at entrance (semi-transparent) ── */}
        {corridorAgents.map((agent) => (
          <AgentAvatar key={`corridor-${agent.id}`} agent={agent} />
        ))}

        {/* ── Layer 8: Walking agents (above all zones, in corridor) ── */}
        {walkingAgents.map((agent) => (
          <AgentAvatar key={`walk-${agent.id}`} agent={agent} />
        ))}
      </svg>

      {/* Speaking indicators now rendered inside AgentAvatar SVG (SpeakingIndicator) */}
    </div>
  );
}

/* ═══ Sub-components ═══ */

/** Soft round rug under meeting tables */
function RoundRug({
  x,
  y,
  radius,
  isDark,
}: {
  x: number;
  y: number;
  radius: number;
  isDark: boolean;
}) {
  const fill = isDark ? "#33405c" : "#b7c8de";
  const border = isDark ? "#42536f" : "#9db2cd";
  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.85}>
      <circle r={radius} fill={fill} />
      <circle r={radius - 5} fill="none" stroke={border} strokeWidth={2} strokeDasharray="10 6" />
    </g>
  );
}

/** Central cross-shaped corridor with tile pattern */
function CorridorFloor({ isDark }: { isDark: boolean }) {
  const cw = OFFICE.corridorWidth;
  const hCorrX = OFFICE.x;
  const hCorrY = OFFICE.y + (OFFICE.height - cw) / 2;
  const vCorrX = OFFICE.x + (OFFICE.width - cw) / 2;
  const vCorrY = OFFICE.y;

  return (
    <g>
      {/* Horizontal corridor */}
      <rect x={hCorrX} y={hCorrY} width={OFFICE.width} height={cw} fill="url(#corridor-tiles)" />
      {/* Vertical corridor */}
      <rect x={vCorrX} y={vCorrY} width={cw} height={OFFICE.height} fill="url(#corridor-tiles)" />
      {/* Corridor center guide lines */}
      <line
        x1={hCorrX}
        y1={hCorrY + cw / 2}
        x2={hCorrX + OFFICE.width}
        y2={hCorrY + cw / 2}
        stroke={isDark ? "#3a3122" : "#cdbf9f"}
        strokeWidth={0.5}
        strokeDasharray="8 6"
        opacity={0.6}
      />
      <line
        x1={vCorrX + cw / 2}
        y1={vCorrY}
        x2={vCorrX + cw / 2}
        y2={vCorrY + OFFICE.height}
        stroke={isDark ? "#3a3122" : "#cdbf9f"}
        strokeWidth={0.5}
        strokeDasharray="8 6"
        opacity={0.6}
      />
    </g>
  );
}

/** Internal partition walls between zones — double-line architectural style */
function PartitionWalls({ isDark }: { isDark: boolean }) {
  const wallColor = isDark ? "#5a4730" : "#8a6f4e";
  const fillColor = isDark ? "#473823" : "#b59a72";
  const wallW = 4;
  const cw = OFFICE.corridorWidth;
  const midX = OFFICE.x + (OFFICE.width - cw) / 2;
  const midY = OFFICE.y + (OFFICE.height - cw) / 2;

  // Render walls as filled rectangles for a proper architectural look
  const walls = [
    // Vertical walls (left of corridor)
    { x: midX - wallW / 2, y: OFFICE.y, w: wallW, h: midY - OFFICE.y },
    { x: midX - wallW / 2, y: midY + cw, w: wallW, h: OFFICE.y + OFFICE.height - midY - cw },
    // Vertical walls (right of corridor)
    { x: midX + cw - wallW / 2, y: OFFICE.y, w: wallW, h: midY - OFFICE.y },
    { x: midX + cw - wallW / 2, y: midY + cw, w: wallW, h: OFFICE.y + OFFICE.height - midY - cw },
    // Horizontal walls (above corridor)
    { x: OFFICE.x, y: midY - wallW / 2, w: midX - OFFICE.x, h: wallW },
    { x: midX + cw, y: midY - wallW / 2, w: OFFICE.x + OFFICE.width - midX - cw, h: wallW },
    // Horizontal walls (below corridor)
    { x: OFFICE.x, y: midY + cw - wallW / 2, w: midX - OFFICE.x, h: wallW },
    { x: midX + cw, y: midY + cw - wallW / 2, w: OFFICE.x + OFFICE.width - midX - cw, h: wallW },
  ];

  return (
    <g>
      {walls.map((w, i) => (
        <rect
          key={`wall-${i}`}
          x={w.x}
          y={w.y}
          width={w.w}
          height={w.h}
          fill={fillColor}
          stroke={wallColor}
          strokeWidth={0.5}
        />
      ))}
    </g>
  );
}

/** Door openings cut into partition walls */
function DoorOpenings({ isDark }: { isDark: boolean }) {
  const cw = OFFICE.corridorWidth;
  const midX = OFFICE.x + (OFFICE.width - cw) / 2;
  const midY = OFFICE.y + (OFFICE.height - cw) / 2;
  const doorWidth = 40;
  const doorColor = isDark ? ZONE_COLORS_DARK.corridor : ZONE_COLORS.corridor;
  const arcColor = isDark ? "#7a6448" : "#a98f68";

  // Door positions: where walls meet corridor, centered on each wall segment
  const doors = [
    // Top wall doors (into corridor)
    { cx: (OFFICE.x + midX) / 2, cy: midY, horizontal: true },
    { cx: (midX + cw + OFFICE.x + OFFICE.width) / 2, cy: midY, horizontal: true },
    // Bottom wall doors
    { cx: (OFFICE.x + midX) / 2, cy: midY + cw, horizontal: true },
    { cx: (midX + cw + OFFICE.x + OFFICE.width) / 2, cy: midY + cw, horizontal: true },
    // Left wall doors
    { cx: midX, cy: (OFFICE.y + midY) / 2, horizontal: false },
    { cx: midX + cw, cy: (OFFICE.y + midY) / 2, horizontal: false },
    // Right wall doors (below corridor)
    { cx: midX, cy: (midY + cw + OFFICE.y + OFFICE.height) / 2, horizontal: false },
    { cx: midX + cw, cy: (midY + cw + OFFICE.y + OFFICE.height) / 2, horizontal: false },
  ];

  return (
    <g>
      {doors.map((d, i) => {
        const half = doorWidth / 2;
        if (d.horizontal) {
          return (
            <g key={`door-${i}`}>
              {/* Erase wall segment */}
              <rect x={d.cx - half} y={d.cy - 3} width={doorWidth} height={6} fill={doorColor} />
              {/* Door swing arc */}
              <path
                d={`M ${d.cx - half} ${d.cy} A ${half} ${half} 0 0 1 ${d.cx + half} ${d.cy}`}
                fill="none"
                stroke={arcColor}
                strokeWidth={0.8}
                strokeDasharray="3 2"
                opacity={0.5}
              />
            </g>
          );
        }
        return (
          <g key={`door-${i}`}>
            <rect x={d.cx - 3} y={d.cy - half} width={6} height={doorWidth} fill={doorColor} />
            <path
              d={`M ${d.cx} ${d.cy - half} A ${half} ${half} 0 0 1 ${d.cx} ${d.cy + half}`}
              fill="none"
              stroke={arcColor}
              strokeWidth={0.8}
              strokeDasharray="3 2"
              opacity={0.5}
            />
          </g>
        );
      })}
    </g>
  );
}

function DeskZoneFurniture({
  deskSlots,
  deskAgents,
}: {
  deskSlots: Array<{ unitX: number; unitY: number }>;
  deskAgents: VisualAgent[];
}) {
  const agentBySlot = useMemo(() => {
    const map = new Map<number, VisualAgent>();
    for (const agent of deskAgents) {
      let hash = 0;
      for (let i = 0; i < agent.id.length; i++) {
        hash = ((hash << 5) - hash + agent.id.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(hash) % deskSlots.length;
      let slot = idx;
      while (map.has(slot)) {
        slot = (slot + 1) % deskSlots.length;
      }
      map.set(slot, agent);
    }
    return map;
  }, [deskAgents, deskSlots.length]);

  return (
    <g>
      {deskSlots.map((slot, i) => (
        <DeskUnit
          key={`desk-${i}`}
          x={slot.unitX}
          y={slot.unitY}
          agent={agentBySlot.get(i) ?? null}
        />
      ))}
    </g>
  );
}

function HotDeskZoneFurniture({
  slots,
  agents,
}: {
  slots: Array<{ unitX: number; unitY: number }>;
  agents: VisualAgent[];
}) {
  return (
    <g>
      {slots.map((slot, i) => (
        <DeskUnit key={`hotdesk-${i}`} x={slot.unitX} y={slot.unitY} agent={agents[i] ?? null} />
      ))}
    </g>
  );
}

function MeetingChairs({
  seats,
  meetingAgentCount,
  tableCenter,
  isDark,
}: {
  seats: Array<{ x: number; y: number }>;
  meetingAgentCount: number;
  tableCenter: { x: number; y: number };
  isDark: boolean;
}) {
  if (meetingAgentCount > 0) {
    return (
      <g>
        {seats.map((s, i) => (
          <Chair key={`mc-${i}`} x={s.x} y={s.y} isDark={isDark} />
        ))}
      </g>
    );
  }

  const emptyCount = 6;
  const emptyRadius = 100;
  return (
    <g>
      {Array.from({ length: emptyCount }, (_, i) => {
        const angle = (2 * Math.PI * i) / emptyCount - Math.PI / 2;
        return (
          <Chair
            key={`mc-empty-${i}`}
            x={Math.round(tableCenter.x + Math.cos(angle) * emptyRadius)}
            y={Math.round(tableCenter.y + Math.sin(angle) * emptyRadius)}
            isDark={isDark}
          />
        );
      })}
    </g>
  );
}

function LoungeDecor({ isDark }: { isDark: boolean }) {
  const lz = ZONES.lounge;
  const cx = lz.x + lz.width / 2;

  const wallColor = isDark ? "#42351f" : "#8a6f4e";
  const deskColor = isDark ? "#5d4a35" : "#c79f6a";
  const deskTop = isDark ? "#6e5a42" : "#e2b97f";
  const logoTextColor = isDark ? "#d8c39a" : "#fff7e6";
  const logoBg = isDark ? "#42351f" : "#7a5f3e";

  // Logo backdrop wall — centered horizontally, at ~55% from top
  const bgWallW = 200;
  const bgWallH = 36;
  const bgWallY = lz.y + lz.height * 0.52;

  // Reception desk — arc in front of logo wall
  const deskW = 160;
  const deskH = 24;
  const deskY = bgWallY + bgWallH + 14;

  return (
    <g>
      {/* ── Upper lounge area: sofas & coffee ── */}
      <Sofa x={lz.x + 100} y={lz.y + 60} rotation={0} isDark={isDark} />
      <Sofa x={lz.x + 280} y={lz.y + 60} rotation={0} isDark={isDark} />
      <Sofa x={lz.x + 100} y={lz.y + 140} rotation={180} isDark={isDark} />
      <CoffeeCup x={lz.x + 190} y={lz.y + 100} />
      <CoffeeCup x={lz.x + 100} y={lz.y + 100} />
      <Sofa x={lz.x + 440} y={lz.y + 100} rotation={90} isDark={isDark} />

      {/* ── Logo backdrop wall ── */}
      <rect
        x={cx - bgWallW / 2}
        y={bgWallY}
        width={bgWallW}
        height={bgWallH}
        rx={4}
        fill={logoBg}
      />
      {/* Wall top accent strip */}
      <rect
        x={cx - bgWallW / 2}
        y={bgWallY}
        width={bgWallW}
        height={3}
        rx={1.5}
        fill={isDark ? "#8a6f4e" : "#caa873"}
      />
      {/* "OpenClaw" logo text */}
      <text
        x={cx}
        y={bgWallY + bgWallH / 2 + 5}
        textAnchor="middle"
        fill={logoTextColor}
        fontSize={14}
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.12em"
      >
        OpenClaw
      </text>

      {/* ── Reception desk (rounded front) ── */}
      <rect
        x={cx - deskW / 2}
        y={deskY}
        width={deskW}
        height={deskH}
        rx={12}
        fill={deskColor}
        stroke={wallColor}
        strokeWidth={1}
      />
      {/* Desk surface highlight */}
      <rect
        x={cx - deskW / 2 + 4}
        y={deskY + 3}
        width={deskW - 8}
        height={deskH - 6}
        rx={9}
        fill={deskTop}
        opacity={0.5}
      />

      {/* Decorative plants flanking reception */}
      <Plant x={cx - bgWallW / 2 - 30} y={bgWallY + bgWallH / 2} />
      <Plant x={cx + bgWallW / 2 + 30} y={bgWallY + bgWallH / 2} />

      {/* Side plants near entrance */}
      <Plant x={lz.x + 40} y={lz.y + lz.height - 50} />
      <Plant x={lz.x + lz.width - 40} y={lz.y + lz.height - 50} />
    </g>
  );
}

/** Main entrance door cut into the bottom outer wall of lounge zone */
function EntranceDoor({ isDark }: { isDark: boolean }) {
  const lz = ZONES.lounge;
  const doorCX = lz.x + lz.width / 2;
  const doorY = OFFICE.y + OFFICE.height;
  const doorW = 70;
  const half = doorW / 2;

  const bgColor = isDark ? ZONE_COLORS_DARK.lounge : ZONE_COLORS.lounge;
  const arcColor = isDark ? "#7a6448" : "#a98f68";
  const matColor = isDark ? "#52453a" : "#c0714c";
  const textColor = isDark ? "#7a6448" : "#a98f68";

  return (
    <g>
      {/* Erase outer wall segment to create door opening */}
      <rect
        x={doorCX - half - 2}
        y={doorY - OFFICE.wallThickness - 1}
        width={doorW + 4}
        height={OFFICE.wallThickness + 4}
        fill={bgColor}
      />
      {/* Door frame posts */}
      <rect x={doorCX - half - 3} y={doorY - 10} width={3} height={12} rx={1} fill={arcColor} />
      <rect x={doorCX + half} y={doorY - 10} width={3} height={12} rx={1} fill={arcColor} />
      {/* Double-door swing arcs */}
      <path
        d={`M ${doorCX - half} ${doorY} A ${half} ${half} 0 0 0 ${doorCX} ${doorY - half}`}
        fill="none"
        stroke={arcColor}
        strokeWidth={0.8}
        strokeDasharray="4 3"
        opacity={0.5}
      />
      <path
        d={`M ${doorCX + half} ${doorY} A ${half} ${half} 0 0 1 ${doorCX} ${doorY - half}`}
        fill="none"
        stroke={arcColor}
        strokeWidth={0.8}
        strokeDasharray="4 3"
        opacity={0.5}
      />
      {/* Welcome mat */}
      <rect
        x={doorCX - 30}
        y={doorY - 18}
        width={60}
        height={12}
        rx={3}
        fill={matColor}
        opacity={0.5}
      />
      {/* "ENTRANCE" label outside */}
      <text
        x={doorCX}
        y={doorY + 14}
        textAnchor="middle"
        fill={textColor}
        fontSize={9}
        fontWeight={600}
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.15em"
      >
        ENTRANCE
      </text>
    </g>
  );
}
