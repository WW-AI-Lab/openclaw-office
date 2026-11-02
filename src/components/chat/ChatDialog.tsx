import { ArrowDown, Loader2, Minimize2, Paperclip, Send, Square } from "lucide-react";
import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import TextareaAutosize from "react-textarea-autosize";
import { useChatStreamingText } from "@/hooks/useChatStreamingText";
import { useOfficeStore } from "@/store/office-store";
import { useChatDockStore, type ChatDockMessage } from "@/store/console-stores/chat-dock-store";
import { AgentSelector } from "./AgentSelector";
import { MessageBubble } from "./MessageBubble";
import { SessionSwitcher } from "./SessionSwitcher";

const MIN_HEIGHT = 220;
const MAX_HEIGHT_RATIO = 0.7;
const DEFAULT_HEIGHT = 420;
const HEIGHT_STORAGE_KEY = "openclaw-chat-dialog-height";

function getStoredHeight(): number {
  try {
    const stored = localStorage.getItem(HEIGHT_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN_HEIGHT) return parsed;
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_HEIGHT;
}

export function ChatDialog() {
  const { t } = useTranslation("chat");
  const dockExpanded = useChatDockStore((s) => s.dockExpanded);
  const messages = useChatDockStore((s) => s.messages);
  const isStreaming = useChatDockStore((s) => s.isStreaming);
  const { streamingText, thinkingText } = useChatStreamingText();
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const connectionError = useOfficeStore((s) => s.connectionError);
  const isHistoryLoading = useChatDockStore((s) => s.isHistoryLoading);
  const setDockExpanded = useChatDockStore((s) => s.setDockExpanded);
  const sendMessage = useChatDockStore((s) => s.sendMessage);
  const abort = useChatDockStore((s) => s.abort);
  const error = useChatDockStore((s) => s.error);
  const clearError = useChatDockStore((s) => s.clearError);
  const targetAgentId = useChatDockStore((s) => s.targetAgentId);
  const draft = useChatDockStore((s) => s.draft);
  const setDraft = useChatDockStore((s) => s.setDraft);
  const attachments = useChatDockStore((s) => s.attachments);
  const addAttachment = useChatDockStore((s) => s.addAttachment);
  const clearAttachments = useChatDockStore((s) => s.clearAttachments);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [height, setHeight] = useState(getStoredHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const prevExpanded = useRef(false);

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !isStreaming;

  // Slide animation on expand/collapse
  useEffect(() => {
    if (dockExpanded && !prevExpanded.current) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 200);
      prevExpanded.current = true;
      return () => clearTimeout(timer);
    }
    if (!dockExpanded && prevExpanded.current) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        prevExpanded.current = false;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [dockExpanded]);

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (dockExpanded && textareaRef.current) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 220);
      return () => clearTimeout(timer);
    }
  }, [dockExpanded]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  // Escape to collapse
  useEffect(() => {
    if (!dockExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDockExpanded(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dockExpanded, setDockExpanded]);

  // Drag resize
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
    },
    [height],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartY.current - e.clientY;
      const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, dragStartHeight.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem(HEIGHT_STORAGE_KEY, String(height));
      } catch {
        // silent
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, height]);

  // Persist height on change end
  useEffect(() => {
    if (isDragging) return;
    try {
      localStorage.setItem(HEIGHT_STORAGE_KEY, String(height));
    } catch {
      // silent
    }
  }, [height, isDragging]);

  const handleSend = useCallback(() => {
    if ((!draft.trim() && attachments.length === 0) || isStreaming) return;
    void sendMessage(draft, attachments);
  }, [attachments, draft, isStreaming, sendMessage]);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        setDockExpanded(false);
      }
    },
    [handleSend, isComposing, setDockExpanded],
  );

  if (!dockExpanded && !isAnimating) return null;

  const allMessages: ChatDockMessage[] = [...messages];

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-b-0 border-gray-200/50 bg-gradient-to-b from-white to-gray-50 shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:from-gray-900 dark:to-slate-900 ${
        dockExpanded ? "animate-slide-up" : "animate-slide-down"
      }`}
      style={{
        height: `${height}px`,
        transition: isDragging ? "none" : undefined,
      }}
    >
      {/* Drag handle */}
      <div
        className="flex h-3 shrink-0 cursor-ns-resize items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
        onMouseDown={handleDragStart}
      >
        <div className="h-0.5 w-8 rounded-full bg-gray-300 dark:bg-gray-600" />
      </div>

      {/* Header: session switcher + minimize button */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-1 dark:border-gray-800">
        <SessionSwitcher />
        <button
          type="button"
          onClick={() => setDockExpanded(false)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title={t("dock.collapseDock")}
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Connection status */}
      {(connectionStatus === "disconnected" ||
        connectionStatus === "reconnecting" ||
        connectionStatus === "error") && (
        <div
          className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 text-xs ${
            connectionStatus === "reconnecting"
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          <span className="min-w-0 flex-1">
            {connectionStatus === "reconnecting"
              ? t("connection.reconnecting")
              : connectionStatus === "error"
                ? connectionError ?? t("connection.failed")
                : t("connection.disconnected")}
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-md border border-current/20 px-2 py-0.5 font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t("connection.retry")}
          </button>
        </div>
      )}

      {/* Loading state */}
      {isHistoryLoading && (
        <div className="flex shrink-0 items-center justify-center gap-2 py-3 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("chatDialog.loadingHistory")}</span>
        </div>
      )}

      {/* Messages area — flex-1 fills remaining space */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-4 py-2"
      >
        {allMessages.length === 0 && !isStreaming && !thinkingText && !isHistoryLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {t("dock.startNewChat")}
          </div>
        ) : (
          <>
            {allMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
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
              <div className="mb-3 flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400 dark:bg-gray-800">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span>{t("dock.thinkingStatus")}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Scroll to bottom button */}
        {!autoScroll && (
          <button
            type="button"
            onClick={scrollToBottom}
            title={t("chatDialog.scrollToBottom")}
            className="sticky bottom-2 left-full z-10 -mr-2 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <ArrowDown className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex shrink-0 items-center justify-between bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <span className="truncate">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input area — pinned to bottom */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-300"
              >
                {attachment.name ?? attachment.mimeType}
              </span>
            ))}
            <button
              type="button"
              onClick={clearAttachments}
              className="text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {t("page.clearAttachments")}
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <AgentSelector />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAttachmentChange}
            className="hidden"
          />
          <button
            type="button"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title={t("page.addAttachment")}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <TextareaAutosize
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={t("dock.placeholder")}
            maxRows={4}
            className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:placeholder:text-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-900"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={() => abort()}
              className="rounded-lg bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
              title={t("common:actions.stop")}
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`rounded-lg p-1.5 transition-colors ${
                canSend
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 dark:bg-gray-700"
              }`}
              title={t("common:actions.send")}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
