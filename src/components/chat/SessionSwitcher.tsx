import { ChevronDown, Plus, MessageSquare } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";

function formatSessionName(key: string): string {
  // "agent:main:main" → "main"
  const parts = key.split(":");
  if (parts.length >= 3 && parts[0] === "agent") {
    const suffix = parts.slice(2).join(":");
    if (suffix === "main") return parts[1];
    return suffix.length > 20 ? suffix.slice(0, 20) + "…" : suffix;
  }
  return key.length > 15 ? key.slice(0, 15) + "…" : key;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function SessionSwitcher() {
  const { t } = useTranslation("chat");
  const sessions = useChatDockStore((s) => s.sessions);
  const currentSessionKey = useChatDockStore((s) => s.currentSessionKey);
  const switchSession = useChatDockStore((s) => s.switchSession);
  const newSession = useChatDockStore((s) => s.newSession);
  const loadSessions = useChatDockStore((s) => s.loadSessions);
  const dockExpanded = useChatDockStore((s) => s.dockExpanded);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load sessions when dialog opens
  useEffect(() => {
    if (dockExpanded) {
      loadSessions();
    }
  }, [dockExpanded, loadSessions]);

  // Close dropdown on outside click
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

  const handleNewSession = useCallback(() => {
    newSession();
    setIsOpen(false);
  }, [newSession]);

  const displayName = formatSessionName(currentSessionKey);
  const sortedSessions = [...(sessions ?? [])].sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  return (
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
        <div className="absolute left-0 top-full z-60 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {sortedSessions.length > 0 ? (
            sortedSessions.map((session) => (
              <button
                key={session.key}
                type="button"
                onClick={() => handleSwitch(session.key)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  session.key === currentSessionKey
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{formatSessionName(session.key)}</div>
                  <div className="truncate text-[10px] text-gray-400">
                    {formatRelativeTime(session.lastActiveAt)}
                    {session.messageCount > 0 && ` · ${session.messageCount} msgs`}
                  </div>
                </div>
                {session.key === currentSessionKey && (
                  <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-400">{t("sessionSwitcher.noSessions")}</div>
          )}
          <div className="border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={handleNewSession}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("sessionSwitcher.newSession")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
