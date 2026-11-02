import { Maximize2, Send, Square, Paperclip } from "lucide-react";
import { useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import TextareaAutosize from "react-textarea-autosize";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import { AgentSelector } from "./AgentSelector";

export function ChatDockBar() {
  const { t } = useTranslation("chat");
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = useChatDockStore((s) => s.sendMessage);
  const abort = useChatDockStore((s) => s.abort);
  const isStreaming = useChatDockStore((s) => s.isStreaming);
  const dockExpanded = useChatDockStore((s) => s.dockExpanded);
  const setDockExpanded = useChatDockStore((s) => s.setDockExpanded);
  const error = useChatDockStore((s) => s.error);
  const clearError = useChatDockStore((s) => s.clearError);
  const draft = useChatDockStore((s) => s.draft);
  const setDraft = useChatDockStore((s) => s.setDraft);
  const attachments = useChatDockStore((s) => s.attachments);
  const addAttachment = useChatDockStore((s) => s.addAttachment);
  const clearAttachments = useChatDockStore((s) => s.clearAttachments);

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !isStreaming;

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
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title={t("page.addAttachment")}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* Input */}
        <TextareaAutosize
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setDockExpanded(true)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={t("dock.placeholder")}
          maxRows={4}
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#00D4AA] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,212,170,0.1)] dark:border-gray-700/50 dark:bg-gray-800 dark:placeholder:text-gray-500 dark:focus:border-[#00D4AA] dark:focus:bg-gray-900"
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            type="button"
            onClick={() => abort()}
            className="rounded-lg bg-red-500 p-1.5 text-white transition-all hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/20"
            title={t("common:actions.stop")}
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`rounded-lg p-1.5 transition-all ${
              canSend
                ? "bg-[#00D4AA] text-white hover:bg-[#00E4BA] hover:shadow-lg hover:shadow-[#00D4AA]/20"
                : "bg-gray-200 text-gray-400 dark:bg-gray-700"
            }`}
            title={t("common:actions.send")}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3 pb-2">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-300"
              >
                {attachment.name ?? attachment.mimeType}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={clearAttachments}
            className="text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {t("page.clearAttachments")}
          </button>
        </div>
      )}
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
