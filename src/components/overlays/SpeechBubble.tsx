import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import type { VisualAgent } from "@/gateway/types";
import { SVG_WIDTH, SVG_HEIGHT } from "@/lib/constants";

interface SpeechBubbleOverlayProps {
  agent: VisualAgent;
}

export function SpeechBubbleOverlay({ agent }: SpeechBubbleOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const speechText = agent.speechBubble?.text ?? "";

  useEffect(() => {
    setDismissed(false);
    setVisible(true);
  }, [speechText]);

  useEffect(() => {
    if (dismissed) {
      setVisible(false);
      return;
    }

    if (agent.status !== "speaking") {
      const textLength = speechText.length;
      const readDelayMs = Math.min(30000, Math.max(12000, 9000 + textLength * 30));
      const timer = setTimeout(() => setVisible(false), readDelayMs);
      return () => clearTimeout(timer);
    }

    setVisible(true);
  }, [agent.status, dismissed, speechText]);

  if (!agent.speechBubble || !visible || dismissed) {
    return null;
  }

  const leftPct = (agent.position.x / SVG_WIDTH) * 100;
  const topPct = (agent.position.y / SVG_HEIGHT) * 100;

  const nearLeft = leftPct < 25;
  const nearRight = leftPct > 75;

  let translateX = "-50%";
  let arrowAlign: "center" | "left" | "right" = "center";
  if (nearLeft) {
    translateX = "-10%";
    arrowAlign = "left";
  } else if (nearRight) {
    translateX = "-90%";
    arrowAlign = "right";
  }

  return (
    <div
      ref={bubbleRef}
      className="pointer-events-none absolute"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(${translateX}, -100%) translateY(-52px)`,
        opacity: agent.status === "speaking" ? 1 : 0,
        transition: "opacity 500ms ease",
        zIndex: 20,
      }}
    >
      <div className="pointer-events-auto min-w-[320px] w-[min(54vw,520px)] max-w-[min(94vw,560px)] max-h-[40vh] overflow-y-auto rounded-2xl border border-slate-300/80 bg-white px-4 py-3.5 text-[14px] leading-7 text-slate-900 shadow-2xl [overflow-wrap:anywhere] dark:border-slate-600/90 dark:bg-slate-900 dark:text-slate-100">
        <div className="mb-2 flex items-start justify-end">
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              setVisible(false);
            }}
            className="rounded-md px-1.5 py-0.5 text-sm leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            aria-label="Close message"
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="[&_p]:my-0 [&_p+*]:mt-2.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
          <Markdown>{agent.speechBubble.text}</Markdown>
        </div>
      </div>
      <div
        className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-200 dark:border-t-gray-700"
        style={{
          marginLeft: arrowAlign === "left" ? "16px" : arrowAlign === "right" ? "auto" : "auto",
          marginRight:
            arrowAlign === "right" ? "16px" : arrowAlign === "center" ? "auto" : undefined,
          ...(arrowAlign === "center" ? { margin: "0 auto" } : {}),
        }}
      />
    </div>
  );
}
