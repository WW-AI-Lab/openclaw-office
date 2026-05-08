import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Send, Square, ArrowDown } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useChatStreamingText } from "@/hooks/useChatStreamingText";
import { useChatDockStore, type ChatDockMessage } from "@/store/console-stores/chat-dock-store";
import { useSkillWorkbenchStore, extractLatestMermaid } from "@/store/console-stores/skill-workbench-store";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { WorkbenchMode } from "./WorkbenchToolbar";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface WorkbenchChatProps {
  mode: WorkbenchMode;
}

export const WorkbenchChat = memo(function WorkbenchChat({ mode }: WorkbenchChatProps) {
  const { t } = useTranslation("console");
  const messages = useChatDockStore((s) => s.messages);
  const isStreaming = useChatDockStore((s) => s.isStreaming);
  const sendMessage = useChatDockStore((s) => s.sendMessage);
  const abort = useChatDockStore((s) => s.abort);
  const draft = useChatDockStore((s) => s.draft);
  const setDraft = useChatDockStore((s) => s.setDraft);
  const attachments = useChatDockStore((s) => s.attachments);
  const addAttachment = useChatDockStore((s) => s.addAttachment);
  const removeAttachment = useChatDockStore((s) => s.removeAttachment);
  const setMermaidSource = useSkillWorkbenchStore((s) => s.setMermaidSource);
  const pendingAutoSendMessage = useSkillWorkbenchStore((s) => s.pendingAutoSendMessage);
  const setPendingAutoSendMessage = useSkillWorkbenchStore((s) => s.setPendingAutoSendMessage);
  const { streamingText } = useChatStreamingText();

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isComposing, setIsComposing] = useState(false);

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !isStreaming;
  const placeholder =
    mode === "edit"
      ? t("skillWorkbench.chat.inputPlaceholderEdit")
      : t("skillWorkbench.chat.inputPlaceholder");

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  // Auto-send pending message (from one-click flowchart generation in SkillBrowser).
  // Called from within the mounted WorkbenchChat so isStreaming propagates correctly.
  useEffect(() => {
    if (!pendingAutoSendMessage) return;
    const msg = pendingAutoSendMessage;
    setPendingAutoSendMessage(null);
    void sendMessage(msg);
  }, [pendingAutoSendMessage, sendMessage, setPendingAutoSendMessage]);

  // Mermaid detection & sync
  useEffect(() => {
    const msgsForExtract = messages
      .filter((m): m is ChatDockMessage & { role: "assistant"; content: string } => m.role === "assistant" && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }));

    const mermaid = extractLatestMermaid(msgsForExtract, streamingText || null);
    if (mermaid) {
      setMermaidSource(mermaid);
    }
  }, [messages, streamingText, setMermaidSource]);

  const handleSend = useCallback(() => {
    if ((!draft.trim() && attachments.length === 0) || isStreaming) return;
    void sendMessage(draft, attachments);
  }, [attachments, draft, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
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

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Message list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-gray-400 dark:text-gray-500">
              {t("skillWorkbench.chat.emptyState")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}

        {!autoScroll && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 rounded-full bg-white p-1.5 shadow-lg dark:bg-gray-800"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div
                key={att.id ?? idx}
                className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
              >
                <span className="max-w-[120px] truncate">{att.name ?? att.mimeType}</span>
                <button
                  onClick={() => removeAttachment(att.id ?? "")}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
            title={t("skillWorkbench.chat.addAttachment")}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleAttachmentChange}
            className="hidden"
          />

          {/* Textarea */}
          <TextareaAutosize
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={isStreaming ? t("skillWorkbench.chat.generating") : placeholder}
            maxRows={6}
            disabled={isStreaming}
            className="min-h-[36px] flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-blue-600 dark:focus:ring-blue-800"
          />

          {/* Send/Stop */}
          {isStreaming ? (
            <button
              onClick={() => void abort()}
              className="shrink-0 rounded-md bg-red-500 p-2 text-white hover:bg-red-600"
              title={t("skillWorkbench.chat.stop")}
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="shrink-0 rounded-md bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:opacity-50"
              title={t("skillWorkbench.chat.send")}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
