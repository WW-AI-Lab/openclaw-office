import { ArrowDown } from "lucide-react";
import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatDockStore, type ChatDockMessage } from "@/store/console-stores/chat-dock-store";
import { MarkdownContent } from "./MarkdownContent";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";

interface ChatTimelineDrawerProps {
  height: number;
  onHeightChange: (height: number) => void;
}

function extractStreamingText(streamingMessage: Record<string, unknown> | null): string {
  if (!streamingMessage) return "";
  const content = streamingMessage.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type?: string; text?: string }>)
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!)
      .join("\n");
  }
  return "";
}

export function ChatTimelineDrawer({ height, onHeightChange }: ChatTimelineDrawerProps) {
  const { t } = useTranslation("chat");
  const dockExpanded = useChatDockStore((s) => s.dockExpanded);
  const messages = useChatDockStore((s) => s.messages);
  const isStreaming = useChatDockStore((s) => s.isStreaming);
  const streamingMessage = useChatDockStore((s) => s.streamingMessage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const streamingText = extractStreamingText(streamingMessage);

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
      const newHeight = Math.max(
        150,
        Math.min(window.innerHeight * 0.4, dragStartHeight.current + delta),
      );
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onHeightChange]);

  if (!dockExpanded) return null;

  const allMessages: ChatDockMessage[] = [...messages];

  return (
    <div
      className="flex flex-col border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{
        height: `${height}px`,
        transition: isDragging ? "none" : "height 200ms ease-out",
      }}
    >
      {/* Drag handle */}
      <div
        className="flex h-3 cursor-ns-resize items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
        onMouseDown={handleDragStart}
      >
        <div className="h-0.5 w-8 rounded-full bg-gray-300 dark:bg-gray-600" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-2">
        {allMessages.length === 0 && !isStreaming ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {t("dock.startNewChat")}
          </div>
        ) : (
          <>
            {allMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && streamingText && (
              <div className="mb-3 flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  <MarkdownContent content={streamingText} />
                  <StreamingIndicator />
                </div>
              </div>
            )}
            {isStreaming && !streamingText && (
              <div className="mb-3 flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400 dark:bg-gray-800">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span>{t("dock.thinkingStatus")}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-14 right-6 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <ArrowDown className="h-4 w-4 text-gray-500" />
        </button>
      )}
    </div>
  );
}
