import { Maximize2, Send, Square, Paperclip } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import TextareaAutosize from "react-textarea-autosize";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import { AgentSelector } from "./AgentSelector";

export function ChatDockBar() {
  const { t } = useTranslation("chat");
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useChatDockStore((s) => s.sendMessage);
  const abort = useChatDockStore((s) => s.abort);
  const isStreaming = useChatDockStore((s) => s.isStreaming);
  const dockExpanded = useChatDockStore((s) => s.dockExpanded);
  const setDockExpanded = useChatDockStore((s) => s.setDockExpanded);
  const error = useChatDockStore((s) => s.error);
  const clearError = useChatDockStore((s) => s.clearError);

  const canSend = input.trim().length > 0 && !isStreaming;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    setInput("");
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, isComposing],
  );

  // When dialog is expanded, show only a minimal expand bar
  if (dockExpanded) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {error && (
        <div className="flex items-center justify-between bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
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

      <div className="flex items-end gap-2 px-3 py-2">
        {/* Left: Agent selector + expand toggle */}
        <div className="flex items-center gap-1">
          <AgentSelector />
          <button
            type="button"
            onClick={() => setDockExpanded(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title={t("dock.expandDock")}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Attachment button */}
        <button
          type="button"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title={t("dock.attachmentWip")}
          onClick={() => {
            // Phase B: UI placeholder only
          }}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* Input */}
        <TextareaAutosize
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setDockExpanded(true)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={t("dock.placeholder")}
          maxRows={4}
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:placeholder:text-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-900"
        />

        {/* Send / Stop button */}
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
  );
}
