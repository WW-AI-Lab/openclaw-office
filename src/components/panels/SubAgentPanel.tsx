import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/shared/Avatar";
import type { AgentVisualStatus } from "@/gateway/types";
import { STATUS_COLORS } from "@/lib/constants";
import { useOfficeStore } from "@/store/office-store";

export function SubAgentPanel() {
  const { t } = useTranslation();
  const agents = useOfficeStore((s) => s.agents);
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  const subAgents = Array.from(agents.values()).filter((a) => a.isSubAgent);

  if (subAgents.length === 0) {
    return (
      <div className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">
        {t("empty.noSubAgents")}
      </div>
    );
  }

  return (
    <div>
      {subAgents.map((sub) => {
        const parent = sub.parentAgentId ? agents.get(sub.parentAgentId) : null;
        const runtime = formatRuntime(sub.lastActiveAt, t);

        return (
          <button
            key={sub.id}
            onClick={() => selectAgent(sub.id)}
            className="flex w-full items-start gap-2 border-b border-gray-50 px-3 py-2 text-left transition-colors hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950"
          >
            <Avatar agentId={sub.id} agentName={sub.name} size={24} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                  {sub.name}
                </span>
                <span
                  className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium text-white"
                  style={{
                    backgroundColor: STATUS_COLORS[sub.status as AgentVisualStatus],
                  }}
                >
                  {t(`agent.statusLabels.${sub.status}`)}
                </span>
              </div>
              {parent && (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAgent(parent.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      selectAgent(parent.id);
                    }
                  }}
                  className="cursor-pointer text-[10px] text-blue-500 hover:underline"
                >
                  ← {parent.name}
                </span>
              )}
              {sub.speechBubble && (
                <div className="mt-0.5 truncate text-[10px] text-gray-400">
                  {sub.speechBubble.text.slice(0, 80)}
                </div>
              )}
              <div className="text-[10px] text-gray-400">{runtime}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatRuntime(
  startTs: number,
  t: (key: string, opts?: Record<string, number>) => string,
): string {
  const elapsed = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
  if (elapsed < 60) {
    return t("time.running", { seconds: elapsed });
  }
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return t("time.runningMinutes", { minutes, seconds });
}
