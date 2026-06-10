import { useState, memo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { VisualAgent } from "@/gateway/types";
import { generatePawnAppearance } from "@/lib/avatar-generator";
import { STATUS_COLORS, AVATAR } from "@/lib/constants";
import { useOfficeStore } from "@/store/office-store";
import { Pawn, type PawnPose, type PawnMotion } from "./Pawn";
import {
  ThoughtEmote,
  SpeechEmote,
  ToolEmote,
  ErrorEmote,
  ZzzEmote,
  SparkleEmote,
} from "./Emotes";

const WALK_BOB_AMPLITUDE = 1.2;
const WALK_BOB_FREQ = 7;
/** Head-top anchor for emote bubbles in pawn space */
const EMOTE_Y = -32;

interface AgentAvatarProps {
  agent: VisualAgent;
}

export const AgentAvatar = memo(function AgentAvatar({ agent }: AgentAvatarProps) {
  const { t } = useTranslation("common");
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const tickMovement = useOfficeStore((s) => s.tickMovement);
  const theme = useOfficeStore((s) => s.theme);
  const [hovered, setHovered] = useState(false);
  const gRef = useRef<SVGGElement>(null);
  const pawnRef = useRef<SVGGElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastXRef = useRef<number>(agent.position.x);

  const isSelected = selectedAgentId === agent.id;
  const isPlaceholder = agent.isPlaceholder;
  const isUnconfirmed = !agent.confirmed;
  const isWalking = agent.movement !== null;
  const isGhost = isPlaceholder || isUnconfirmed;
  const isDark = theme === "dark";
  const statusColor = isGhost ? "#6b7280" : STATUS_COLORS[agent.status];
  const appearance = generatePawnAppearance(agent.id);
  const groupOpacity = isPlaceholder ? 0.35 : isUnconfirmed ? 0.6 : 1;

  const displayName =
    agent.name.length > AVATAR.nameLabelMaxChars
      ? `${agent.name.slice(0, AVATAR.nameLabelMaxChars)}…`
      : agent.name;

  // Pose: walking > seated (desk/meeting) > standing (lounge/corridor)
  const pose: PawnPose = isWalking
    ? "walk"
    : agent.zone === "desk" || agent.zone === "hotDesk" || agent.zone === "meeting"
      ? "sit"
      : "stand";

  // Motion driven by OpenClaw event status
  let motion: PawnMotion = "none";
  if (!isGhost && !isWalking) {
    if (agent.status === "error") motion = "shaking";
    else if (agent.status === "speaking") motion = "talking";
    else if (agent.status === "tool_calling" || agent.status === "thinking") motion = "typing";
  }

  // Walk animation loop via requestAnimationFrame
  const agentIdRef = useRef(agent.id);
  agentIdRef.current = agent.id;

  const animate = useCallback(
    (time: number) => {
      if (!gRef.current) return;
      const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = time;

      tickMovement(agentIdRef.current, delta);

      const state = useOfficeStore.getState();
      const a = state.agents.get(agentIdRef.current);
      if (!a) return;

      // Walk bob effect
      let bobY = 0;
      if (a.movement) {
        const elapsed = (Date.now() - a.movement.startTime) / 1000;
        bobY = Math.sin(elapsed * WALK_BOB_FREQ * Math.PI * 2) * WALK_BOB_AMPLITUDE;
      }

      gRef.current.setAttribute(
        "transform",
        `translate(${a.position.x}, ${a.position.y + bobY})`,
      );

      // Face the walking direction (mirror pawn when heading left)
      const dx = a.position.x - lastXRef.current;
      lastXRef.current = a.position.x;
      if (pawnRef.current && Math.abs(dx) > 0.05) {
        pawnRef.current.setAttribute("transform", dx < 0 ? "scale(-1, 1)" : "scale(1, 1)");
      }

      if (a.movement) {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [tickMovement],
  );

  useEffect(() => {
    if (isWalking) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    } else if (pawnRef.current) {
      // Reset mirroring once the walk completes
      pawnRef.current.setAttribute("transform", "scale(1, 1)");
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isWalking, animate]);

  return (
    <g
      ref={gRef}
      data-agent-id={agent.id}
      data-status={agent.status}
      transform={`translate(${agent.position.x}, ${agent.position.y})`}
      style={{ cursor: isPlaceholder ? "default" : "pointer" }}
      opacity={groupOpacity}
      onClick={() => !isPlaceholder && selectAgent(agent.id)}
      onMouseEnter={() => !isPlaceholder && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Selection ring under the feet (game-style) */}
      {isSelected && (
        <g
          style={{
            animation: "selection-ring 1.4s ease-in-out infinite",
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
        >
          <ellipse
            cy={17.5}
            rx={16}
            ry={5}
            fill={statusColor}
            opacity={0.22}
            style={{ filter: `drop-shadow(0 0 6px ${statusColor})` }}
          />
          <ellipse cy={17.5} rx={16} ry={5} fill="none" stroke={statusColor} strokeWidth={1.6} />
        </g>
      )}

      {/* Hover highlight */}
      {hovered && !isSelected && (
        <ellipse cy={17.5} rx={14.5} ry={4.5} fill="none" stroke={statusColor} strokeWidth={1} opacity={0.5} />
      )}

      {/* The digital person */}
      <g style={agent.status === "spawning" ? spawnStyle : undefined}>
        <g ref={pawnRef}>
          <Pawn appearance={appearance} pose={pose} motion={motion} ghost={isGhost} />
        </g>
      </g>

      {/* Emote bubble above the head — mapped from OpenClaw event status */}
      {!isGhost && !isWalking && (
        <g transform={`translate(0, ${EMOTE_Y})`}>
          {agent.status === "thinking" && <ThoughtEmote isDark={isDark} />}
          {agent.status === "speaking" && (
            <SpeechEmote text={agent.speechBubble?.text ?? ""} isDark={isDark} />
          )}
          {agent.status === "tool_calling" && agent.currentTool && (
            <ToolEmote toolName={agent.currentTool.name} isDark={isDark} />
          )}
          {agent.status === "error" && <ErrorEmote />}
          {agent.status === "offline" && <ZzzEmote isDark={isDark} />}
          {agent.status === "spawning" && <SparkleEmote />}
        </g>
      )}

      {/* Name tag with status dot */}
      <foreignObject x={-60} y={21} width={120} height={22} style={{ pointerEvents: "none" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span
            title={agent.name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              fontWeight: 600,
              color: isDark ? "#e2e8f0" : "#44403c",
              backgroundColor: isDark ? "rgba(28,25,23,0.78)" : "rgba(255,251,243,0.85)",
              backdropFilter: "blur(6px)",
              borderRadius: "7px",
              padding: "1px 7px",
              whiteSpace: "nowrap",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(120,90,60,0.18)"}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                backgroundColor: statusColor,
                flexShrink: 0,
                boxShadow: `0 0 3px ${statusColor}`,
              }}
            />
            {displayName}
            {agent.isSubAgent && (
              <span
                style={{
                  fontSize: "8px",
                  fontWeight: 700,
                  color: "#fff",
                  backgroundColor: statusColor,
                  borderRadius: "4px",
                  padding: "0 3px",
                  lineHeight: "10px",
                }}
              >
                S
              </span>
            )}
          </span>
        </div>
      </foreignObject>

      {/* Hover tooltip */}
      {hovered && (
        <foreignObject x={-80} y={-66} width={160} height={30} style={{ pointerEvents: "none" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: isDark ? "#e2e8f0" : "#374151",
                backgroundColor: isDark ? "rgba(28,25,23,0.9)" : "rgba(255,255,255,0.92)",
                backdropFilter: "blur(8px)",
                borderRadius: "8px",
                padding: "4px 10px",
                whiteSpace: "nowrap",
                boxShadow: isDark ? "0 4px 8px rgba(0,0,0,0.3)" : "0 4px 8px rgba(0,0,0,0.1)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
              }}
            >
              {agent.name} · {t(`agent.statusLabels.${agent.status}`)}
            </span>
          </div>
        </foreignObject>
      )}
    </g>
  );
});

const spawnStyle: React.CSSProperties = {
  animation: "agent-spawn 0.5s ease-out forwards",
  transformBox: "fill-box",
  transformOrigin: "center bottom",
};
