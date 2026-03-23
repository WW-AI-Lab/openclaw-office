import { ChevronDown, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/console/shared/ConfirmDialog";
import { formatRelativeTime, formatSessionName } from "@/lib/chat-session-utils";
import { GROUP_CHAT_SESSION_KEY } from "@/lib/group-chat";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import { useOfficeStore } from "@/store/office-store";

export function SessionSwitcher() {
  const { t } = useTranslation("chat");
  const sessions = useChatDockStore((s) => s.sessions);
  const currentSessionKey = useChatDockStore((s) => s.currentSessionKey);
  const switchSession = useChatDockStore((s) => s.switchSession);
  const newSession = useChatDockStore((s) => s.newSession);
  const setTargetAgent = useChatDockStore((s) => s.setTargetAgent);
  const loadSessions = useChatDockStore((s) => s.loadSessions);
  const isSessionsLoading = useChatDockStore((s) => s.isSessionsLoading);
  const deleteSession = useChatDockStore((s) => s.deleteSession);
  const dockExpanded = useChatDockStore((s) => s.dockExpanded);
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);

  const agents = useOfficeStore((s) => s.agents);
  const mainAgents = Array.from(agents.values()).filter(
    (a) => !a.isSubAgent && !a.isPlaceholder && a.confirmed,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dockExpanded || connectionStatus !== "connected") {
      return;
    }

    void loadSessions();
    const timer = window.setInterval(() => {
      void loadSessions();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [connectionStatus, dockExpanded, loadSessions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSwitch = useCallback(
    (key: string) => {
      switchSession(key);
      setIsOpen(false);
    },
    [switchSession],
  );

  const handleNewSessionWithAgent = useCallback(
    (agentId: string) => {
      setTargetAgent(agentId);
      // Allow store to update targetAgentId before creating session
      setTimeout(() => {
        newSession();
        setIsOpen(false);
      }, 0);
    },
    [setTargetAgent, newSession],
  );

  const handleQuickNewSession = useCallback(() => {
    newSession();
  }, [newSession]);

  const handleDeleteSession = useCallback(async () => {
    if (!pendingDeleteKey) {
      return;
    }

    await deleteSession(pendingDeleteKey);
    setPendingDeleteKey(null);
    setIsOpen(false);
  }, [deleteSession, pendingDeleteKey]);

  const groupLabel = t("agentSelector.mainGroupLabel");
  const displayName = formatSessionName(currentSessionKey, groupLabel);
  const sortedSessions = [...(sessions ?? [])].sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  return (
    <div className="flex items-center gap-1">
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="max-w-[140px] truncate">{displayName}</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-60 mt-1 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => handleSwitch(GROUP_CHAT_SESSION_KEY)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800 ${
                currentSessionKey === GROUP_CHAT_SESSION_KEY
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{groupLabel}</div>
                <div className="truncate text-[10px] text-gray-400">
                  {t("sessionSwitcher.groupSessionHint")}
                </div>
              </div>
              {currentSessionKey === GROUP_CHAT_SESSION_KEY && (
                <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
              )}
            </button>

            {/* Existing sessions */}
            {isSessionsLoading && (
              <div className="px-3 py-2 text-[11px] text-gray-400">
                {t("sessionSwitcher.loadingSessions")}
              </div>
            )}
            {sortedSessions.length > 0 ? (
              sortedSessions.map((session) => (
                <div
                  key={session.key}
                  className={`flex items-center gap-1 px-1 ${
                    session.key === currentSessionKey
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSwitch(session.key)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${
                      session.key === currentSessionKey
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {formatSessionName(session.key, groupLabel)}
                      </div>
                      <div className="truncate text-[10px] text-gray-400">
                        {formatRelativeTime(session.lastActiveAt)}
                        {session.messageCount > 0 && ` · ${session.messageCount} msgs`}
                      </div>
                    </div>
                    {session.key === currentSessionKey && (
                      <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDeleteKey(session.key);
                    }}
                    disabled={connectionStatus !== "connected"}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title={
                      connectionStatus === "connected"
                        ? t("sessionSwitcher.deleteSession")
                        : t("sessionSwitcher.deleteSessionConnectionRequired")
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-gray-400">
                {t("sessionSwitcher.noSessions")}
              </div>
            )}

            {/* New session section: one entry per available agent */}
            <div className="border-t border-gray-100 dark:border-gray-800">
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                {t("sessionSwitcher.newSession")}
              </div>
              {mainAgents.map((agent) => (
                <button
                  key={`new-${agent.id}`}
                  type="button"
                  onClick={() => handleNewSessionWithAgent(agent.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <Plus className="h-3.5 w-3.5 text-green-500" />
                  <span className="truncate">
                    {t("sessionSwitcher.newSessionWith", { agent: agent.name })}
                  </span>
                </button>
              ))}
              {mainAgents.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    newSession();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <Plus className="h-3.5 w-3.5 text-green-500" />
                  <span>{t("sessionSwitcher.newSession")}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick "+" button always visible in header */}
      <button
        type="button"
        onClick={handleQuickNewSession}
        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-green-600 dark:hover:bg-gray-800 dark:hover:text-green-400"
        title={t("sessionSwitcher.newSessionTooltip")}
      >
        <Plus className="h-4 w-4" />
      </button>
      <ConfirmDialog
        open={pendingDeleteKey !== null}
        title={t("sessionSwitcher.deleteSessionTitle")}
        description={t("sessionSwitcher.deleteSessionDescription", {
          session: pendingDeleteKey ? formatSessionName(pendingDeleteKey, groupLabel) : "",
        })}
        confirmLabel={t("common:actions.delete")}
        onConfirm={() => {
          void handleDeleteSession();
        }}
        onCancel={() => setPendingDeleteKey(null)}
        variant="danger"
      />
    </div>
  );
}
