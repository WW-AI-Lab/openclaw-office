import { Clock3, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatSessionName } from "@/lib/chat-session-utils";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import { ChatAttachmentList } from "./ChatAttachmentList";
import { MarkdownContent } from "./MarkdownContent";

function formatTimestamp(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(timestamp);
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export function ChatHistoryDialog() {
  const { t } = useTranslation(["chat", "common"]);
  const open = useChatDockStore((state) => state.historyDialogOpen);
  const title = useChatDockStore((state) => state.historyDialogTitle);
  const subtitle = useChatDockStore((state) => state.historyDialogSubtitle);
  const messages = useChatDockStore((state) => state.historyMessages);
  const historyMode = useChatDockStore((state) => state.historyMode);
  const isLoading = useChatDockStore((state) => state.isHistoryDialogLoading);
  const closeHistoryDialog = useChatDockStore((state) => state.closeHistoryDialog);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHistoryDialog();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeHistoryDialog, open]);

  const groupLabel = t("chat:agentSelector.mainGroupLabel");
  const emptyText =
    historyMode === "agent" ? t("chat:history.emptyAgent") : t("chat:history.emptySession");

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={closeHistoryDialog}
      role="presentation"
    >
      <div
        className="flex max-h-[88vh] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t("chat:history.fallbackTitle")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-blue-500" />
              <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title ?? t("chat:history.fallbackTitle")}
              </h3>
            </div>
            {subtitle && (
              <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={closeHistoryDialog}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title={t("common:actions.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("chat:history.loading")}</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              {emptyText}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={`${message.id}-${message.sourceSessionKey ?? "current"}-${message.timestamp}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                        isUser
                          ? "bg-blue-600 text-white"
                          : "bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      }`}
                    >
                      <div
                        className={`mb-2 flex flex-wrap items-center gap-2 text-[11px] ${
                          isUser ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        <span className="font-semibold">
                          {isUser ? t("chat:history.roles.user") : t("chat:history.roles.assistant")}
                        </span>
                        <span>{formatTimestamp(message.timestamp)}</span>
                        {historyMode === "agent" && message.sourceSessionKey && (
                          <span className="rounded-full border border-current/20 px-2 py-0.5">
                            {formatSessionName(message.sourceSessionKey, groupLabel)}
                          </span>
                        )}
                      </div>

                      {isUser ? (
                        <>
                          {message.content.trim() && (
                            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                          )}
                          {message.attachments && message.attachments.length > 0 && (
                            <ChatAttachmentList attachments={message.attachments} />
                          )}
                        </>
                      ) : (
                        <MarkdownContent content={message.content} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
