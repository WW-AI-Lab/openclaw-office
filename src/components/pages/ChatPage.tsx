import {
  ArrowDown,
  Download,
  Eye,
  EyeOff,
  File,
  FileText,
  Loader2,
  MessageSquareMore,
  MessageSquarePlus,
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import TextareaAutosize from "react-textarea-autosize";
import { AgentSelector } from "@/components/chat/AgentSelector";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useChatStreamingText } from "@/hooks/useChatStreamingText";
import { getSlashCommands } from "@/lib/chat-slash-commands";
import { extractAgentIdFromSessionKey, formatSessionName } from "@/lib/session-key-utils";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import { useOfficeStore } from "@/store/office-store";

function resolveAgentDisplayName(
  agentId: string | null,
  agents: ReturnType<typeof useOfficeStore.getState>["agents"],
): string | null {
  if (!agentId) return null;
  return agents.get(agentId)?.name?.trim() || agentId;
}

function formatSessionTitle(
  sessionKey: string,
  targetAgentId: string | null,
  agents: ReturnType<typeof useOfficeStore.getState>["agents"],
): string {
  const agentId = targetAgentId ?? extractAgentIdFromSessionKey(sessionKey);
  const agentName = resolveAgentDisplayName(agentId, agents);
  if (sessionKey === `agent:${agentId}:main` && agentName) {
    return agentName;
  }
  return formatSessionName(sessionKey);
}

function formatRelativeTime(ts: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("sessionSwitcher.relativeNow");
  if (mins < 60) return t("sessionSwitcher.relativeMinutes", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("sessionSwitcher.relativeHours", { count: hours });
  const days = Math.floor(hours / 24);
  return t("sessionSwitcher.relativeDays", { count: days });
}

export function ChatPage() {
  const { t } = useTranslation(["chat", "common"]);
  const slashCommands = useMemo(() => getSlashCommands(), []);
  const messages = useChatDockStore((s) => s.messages);
  const sessions = useChatDockStore((s) => s.sessions);
  const isStreaming = useChatDockStore((s) => s.isStreaming);
  const isHistoryLoading = useChatDockStore((s) => s.isHistoryLoading);
  const error = useChatDockStore((s) => s.error);
  const clearError = useChatDockStore((s) => s.clearError);
  const loadSessions = useChatDockStore((s) => s.loadSessions);
  const sendMessage = useChatDockStore((s) => s.sendMessage);
  const abort = useChatDockStore((s) => s.abort);
  const currentSessionKey = useChatDockStore((s) => s.currentSessionKey);
  const switchSession = useChatDockStore((s) => s.switchSession);
  const newSession = useChatDockStore((s) => s.newSession);
  const draft = useChatDockStore((s) => s.draft);
  const setDraft = useChatDockStore((s) => s.setDraft);
  const attachments = useChatDockStore((s) => s.attachments);
  const addAttachment = useChatDockStore((s) => s.addAttachment);
  const removeAttachment = useChatDockStore((s) => s.removeAttachment);
  const clearAttachments = useChatDockStore((s) => s.clearAttachments);
  const focusMode = useChatDockStore((s) => s.focusMode);
  const setFocusMode = useChatDockStore((s) => s.setFocusMode);
  const pinnedMessageIds = useChatDockStore((s) => s.pinnedMessageIds);
  const togglePinMessage = useChatDockStore((s) => s.togglePinMessage);
  const exportCurrentSession = useChatDockStore((s) => s.exportCurrentSession);
  const targetAgentId = useChatDockStore((s) => s.targetAgentId);

  const agents = useOfficeStore((s) => s.agents);
  const { streamingText, thinkingText } = useChatStreamingText();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !isStreaming;

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, autoScroll]);

  const pinnedMessages = useMemo(
    () => messages.filter((message) => pinnedMessageIds.includes(message.id)),
    [messages, pinnedMessageIds],
  );

  const slashMenuItems = useMemo(() => {
    const trimmed = draft.trimStart();
    if (!trimmed.startsWith("/")) {
      return [];
    }
    const withoutSlash = trimmed.slice(1);
    const [commandName = "", ...rest] = withoutSlash.split(/\s+/u);
    const active = slashCommands.find((command) => command.name === commandName);
    const argsFilter = rest.join(" ").trim().toLowerCase();
    if (active?.argOptions && rest.length > 0) {
      return active.argOptions
        .filter((option) => option.toLowerCase().startsWith(argsFilter))
        .map((option) => ({
          key: `${active.name}:${option}`,
          label: `/${active.name} ${option}`,
          description: active.description,
          value: `/${active.name} ${option}`,
        }));
    }
    return slashCommands.filter((command) => command.name.startsWith(commandName.toLowerCase())).map(
      (command) => ({
        key: command.name,
        label: `/${command.name}${command.args ? ` ${command.args}` : ""}`,
        description: command.description,
        value: `/${command.name}${command.args ? " " : ""}`,
      }),
    );
  }, [draft, slashCommands]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0)),
    [sessions],
  );

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setAutoScroll(true);
  }, []);

  const handleSend = useCallback(() => {
    if ((!draft.trim() && attachments.length === 0) || isStreaming) return;
    void sendMessage(draft, attachments);
  }, [attachments, draft, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !isComposing) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend, isComposing],
  );

  const handleAttachmentChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        addAttachment({
          id: `${file.name}-${file.lastModified}`,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
        });
      }
      event.target.value = "";
    },
    [addAttachment],
  );

  const handleSelectSlashMenuItem = useCallback(
    (value: string) => {
      setDraft(value);
    },
    [setDraft],
  );

  const handleScrollToPinned = useCallback((messageId: string) => {
    messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-0">
      <div
        className={`flex min-h-0 w-full ${
          focusMode ? "justify-center" : ""
        }`}
      >
        {!focusMode && (
          <aside className="flex w-[260px] shrink-0 flex-col border-r border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="px-3 pb-3 pt-3">
              <button
                type="button"
                onClick={() => newSession()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-[13px] font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span>{t("page.newSessionPrimary")}</span>
              </button>
            </div>

            <div className="flex items-center justify-between px-4 pb-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t("page.sessionHistory")}
              </span>
              <span className="text-[11px] tabular-nums text-gray-300 dark:text-gray-600">{sortedSessions.length}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {sortedSessions.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  {t("page.sessionEmpty")}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {sortedSessions.map((session) => {
                    const isActive = session.key === currentSessionKey;
                    const meta = t("page.sessionMeta", {
                      time: formatRelativeTime(session.lastActiveAt ?? Date.now(), t),
                      detail: t("sessionSwitcher.messageCount", {
                        count: session.messageCount ?? 0,
                      }),
                    });
                    return (
                      <button
                        key={session.key}
                        type="button"
                        onClick={() => switchSession(session.key)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isActive
                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                            : "text-gray-600 hover:bg-white/60 dark:text-gray-400 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <div className="truncate text-[13px] font-medium">
                          {session.label ? formatSessionName(session.label) : formatSessionName(session.key)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                          {meta}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}

        <section className={`flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-gray-950 ${focusMode ? "mx-auto max-w-5xl" : ""}`}>
          <div className="flex items-center justify-between border-b border-gray-100/80 px-6 py-2.5 dark:border-gray-800/80">
            <div className="flex items-center gap-3 overflow-hidden">
              <h2 className="truncate text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                {formatSessionTitle(currentSessionKey, targetAgentId, agents)}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {pinnedMessages.length > 0 && (
                <div className="mr-2 flex items-center gap-1.5">
                  {pinnedMessages.slice(0, 3).map((message) => (
                    <button
                      key={`pin-${message.id}`}
                      type="button"
                      onClick={() => handleScrollToPinned(message.id)}
                      className="max-w-[120px] truncate rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                    >
                      {message.content.slice(0, 30)}…
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => exportCurrentSession()}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                title={t("page.export")}
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setFocusMode(!focusMode)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                title={focusMode ? t("page.focusOff") : t("page.focusOn")}
              >
                {focusMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-gray-50 dark:bg-gray-900/40">
            {isHistoryLoading && (
              <div className="px-6 py-3 text-sm text-gray-400 dark:text-gray-500">
                <div className="mx-auto flex max-w-[52rem] items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("chatDialog.loadingHistory")}</span>
                </div>
              </div>
            )}

            <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto">
              <div className="mx-auto flex min-h-full w-full max-w-[52rem] flex-col px-6 py-6">
                {messages.length === 0 && !isStreaming && !thinkingText && !isHistoryLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                        <MessageSquareMore className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                        {t("page.emptyTitle")}
                      </p>
                      <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                        {t("page.emptyDescription")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        ref={(node) => {
                          messageRefs.current[message.id] = node;
                        }}
                      >
                        <MessageBubble
                          message={message}
                          isPinned={pinnedMessageIds.includes(message.id)}
                          onTogglePin={togglePinMessage}
                        />
                      </div>
                    ))}
                    {isStreaming && (streamingText || thinkingText) && (
                      <MessageBubble
                        message={{
                          id: "__streaming__",
                          role: "assistant",
                          content: streamingText,
                          timestamp: Date.now(),
                          isStreaming: true,
                          authorAgentId: targetAgentId,
                          thinking: thinkingText || undefined,
                        }}
                      />
                    )}
                    {isStreaming && !streamingText && !thinkingText && (
                      <div className="mb-5 flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{t("dock.thinkingStatus")}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {!autoScroll && (
              <button
                type="button"
                onClick={scrollToBottom}
                title={t("page.scrollToLatest")}
                className="absolute bottom-4 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-gray-500 shadow-md ring-1 ring-gray-200/80 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-700"
              >
                <ArrowDown className="h-3 w-3" />
                <span>{t("page.scrollToLatest")}</span>
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center justify-between bg-red-50 px-6 py-2 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400">
              <span className="truncate">{error}</span>
              <button type="button" onClick={clearError} className="ml-3 text-xs font-medium hover:underline">
                {t("common:actions.dismiss")}
              </button>
            </div>
          )}

          <div className="bg-white px-4 pb-5 pt-3 dark:bg-gray-950">
            <div className="mx-auto max-w-[52rem]">
              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                    >
                      {attachment.mimeType.startsWith("image/") && attachment.dataUrl ? (
                        <img
                          src={attachment.dataUrl}
                          alt={attachment.name ?? attachment.mimeType}
                          className="h-16 w-16 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 px-1 text-center">
                          {attachment.mimeType.startsWith("text/") ? (
                            <FileText className="h-6 w-6 text-blue-400" />
                          ) : (
                            <File className="h-6 w-6 text-gray-400" />
                          )}
                          <span className="line-clamp-2 text-[9px] leading-tight text-gray-500 dark:text-gray-400">
                            {attachment.name ?? attachment.mimeType}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id ?? "")}
                        className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                        title={t("page.removeAttachment")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={clearAttachments}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {t("page.clearAttachments")}
                  </button>
                </div>
              )}

              <div className="relative rounded-2xl border border-gray-200/80 bg-white transition-[border-color,box-shadow] focus-within:border-gray-300 focus-within:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)] dark:border-gray-700/80 dark:bg-gray-900 dark:focus-within:border-gray-600">
                {slashMenuItems.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    {slashMenuItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSelectSlashMenuItem(item.value)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {item.label}
                        </span>
                        <span className="text-xs text-gray-400">{item.description}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 px-3 py-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleAttachmentChange}
                    className="hidden"
                    title={t("page.addAttachment")}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-0.5 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200/60 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    title={t("page.addAttachment")}
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  <TextareaAutosize
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    maxRows={8}
                    placeholder={t("dock.placeholder")}
                    className="min-h-[2.5rem] flex-1 resize-none bg-transparent py-2 text-sm leading-6 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />

                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => void abort()}
                      className="mb-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
                      title={t("common:actions.stop")}
                    >
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!canSend}
                      title={t("common:actions.send")}
                      className={`mb-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                        canSend
                          ? "bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center px-2 pb-1.5 pt-0.5">
                  <AgentSelector className="shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
