import type { UIEvent } from "react";
import { useTranslation } from "react-i18next";
import type { AgentStream, EventHistoryItem } from "@/gateway/types";
import { STATUS_COLORS } from "@/lib/constants";

const STREAM_ICONS: Record<AgentStream, string> = {
  lifecycle: "●",
  tool: "🔧",
  assistant: "💬",
  error: "⚠",
};

function formatTimelineTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface TimelineEventListProps {
  events: EventHistoryItem[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  emptyLabel: string;
  onSelectAgent: (agentId: string) => void;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
}

export function TimelineEventList({
  events,
  loading,
  loadingMore = false,
  hasMore = false,
  emptyLabel,
  onSelectAgent,
  onScroll,
}: TimelineEventListProps) {
  const { t } = useTranslation("layout");

  return (
    <div onScroll={onScroll} className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-400">
          {t("topbar.timeline.loading")}
        </div>
      ) : events.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-400">
          {emptyLabel}
        </div>
      ) : (
        <>
          {events.map((event, index) => (
            <button
              key={`${event.timestamp}-${event.agentId}-${event.stream}-${index}`}
              type="button"
              onClick={() => onSelectAgent(event.agentId)}
              className="flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
            >
              <div className="shrink-0 pt-0.5 text-xs text-gray-400">
                {formatTimelineTimestamp(event.timestamp)}
              </div>
              <div className="shrink-0 pt-0.5 text-sm">{STREAM_ICONS[event.stream] ?? "·"}</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: STATUS_COLORS[event.stream === "error" ? "error" : "thinking"],
                    }}
                  >
                    {event.agentName}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {event.stream}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {event.summary}
                </div>
              </div>
            </button>
          ))}

          {(loadingMore || hasMore) && (
            <div className="px-4 py-3 text-center text-xs text-gray-400">
              {loadingMore ? t("topbar.timeline.loadingMore") : t("topbar.timeline.scrollHint")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
