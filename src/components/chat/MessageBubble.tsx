import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/shared/Avatar";
import { SvgAvatar } from "@/components/shared/SvgAvatar";
import { useOfficeStore } from "@/store/office-store";
import type { ChatDockMessage } from "@/store/console-stores/chat-dock-store";
import { MarkdownContent } from "./MarkdownContent";
import { StreamingIndicator } from "./StreamingIndicator";
import { StreamingMarkdownContent } from "./StreamingMarkdownContent";
import { ThinkingBlock } from "./ThinkingBlock";

interface MessageBubbleProps {
  message: ChatDockMessage;
  isPinned?: boolean;
  onTogglePin?: (messageId: string) => void;
  /**
   * Forwarded to MarkdownContent / StreamingMarkdownContent. When true,
   * ```` ```a2ui ```` blocks render as plain code fences instead of the
   * interactive A2uiForm — used by surfaces that already show the form
   * elsewhere (e.g. the Workbench "A2UI 调试" tab).
   */
  disableA2uiForm?: boolean;
}

function resolveAssistantName(message: ChatDockMessage, agents: ReturnType<typeof useOfficeStore.getState>["agents"]): string {
  const agentId = message.authorAgentId;
  if (!agentId) {
    return "OpenClaw";
  }
  return agents.get(agentId)?.name?.trim() || agentId;
}

function PinButton({
  isPinned,
  messageId,
  onTogglePin,
  t,
}: {
  isPinned: boolean;
  messageId: string;
  onTogglePin?: (messageId: string) => void;
  t: (key: string) => string;
}) {
  if (!onTogglePin) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onTogglePin(messageId)}
      className={`rounded px-1.5 py-0.5 text-[10px] ${
        isPinned
          ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      }`}
    >
      {isPinned ? t("message.pinned") : t("message.pin")}
    </button>
  );
}

function AssistantIdentity({
  authorName,
  authorAgentId,
}: {
  authorName: string;
  authorAgentId: string | null | undefined;
}) {
  return (
    <>
      <SvgAvatar agentId={authorAgentId ?? "openclaw"} size={32} className="shrink-0" />
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="font-medium text-gray-500 dark:text-gray-400">{authorName}</span>
        </div>
      </div>
    </>
  );
}

function ToolActivityBubble({
  message,
  authorName,
}: {
  message: ChatDockMessage;
  authorName: string;
}) {
  const { t } = useTranslation("chat");
  const [isExpanded, setIsExpanded] = useState(!message.collapsed);
  const toolCall = message.toolCalls?.[0];

  useEffect(() => {
    setIsExpanded(toolCall?.status === "running" || !message.collapsed);
  }, [message.collapsed, toolCall?.status]);

  if (!toolCall) {
    return null;
  }

  const statusClass =
    toolCall.status === "running"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200"
      : toolCall.status === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-200"
        : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300";

  return (
    <div className="group mb-6 flex justify-start">
      <div className="flex max-w-[90%] items-start gap-3">
        <AssistantIdentity authorName={authorName} authorAgentId={message.authorAgentId} />

        <div className="min-w-0 flex-1">
          <div className={`w-full max-w-md rounded-xl border px-3 py-2 shadow-sm ${statusClass}`}>
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide opacity-70">
                  <span>{t("message.toolCall")}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      toolCall.status === "running"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {t(`toolStatus.${toolCall.status}`, { defaultValue: toolCall.status })}
                  </span>
                </div>
                <div className="mt-1 truncate font-mono text-sm">{toolCall.name}</div>
              </div>
              <span className="text-xs opacity-70">
                {isExpanded ? t("message.hideDetails") : t("message.viewDetails")}
              </span>
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2 border-t border-current/10 pt-3 text-xs">
                {toolCall.args && (
                  <div>
                    <div className="mb-1 font-medium opacity-70">{t("message.toolArgs")}</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/5 p-2 dark:bg-white/5">
                      {JSON.stringify(toolCall.args, null, 2)}
                    </pre>
                  </div>
                )}
                {toolCall.result && (
                  <div>
                    <div className="mb-1 font-medium opacity-70">{t("message.result")}</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/5 p-2 dark:bg-white/5">
                      {toolCall.result}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isPinned = false,
  onTogglePin,
  disableA2uiForm = false,
}: MessageBubbleProps) {
  const { t } = useTranslation("chat");
  const agents = useOfficeStore((s) => s.agents);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const hasImages = (message.attachments ?? []).some((attachment) => attachment.dataUrl);
  const authorName = isUser ? t("message.you") : resolveAssistantName(message, agents);

  if (message.kind === "tool") {
    return <ToolActivityBubble message={message} authorName={authorName} />;
  }

  if (isSystem) {
    return (
      <div className="mb-4 flex justify-center">
        <div className="max-w-2xl rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="flex items-start justify-between gap-3">
            <MarkdownContent content={message.content} disableA2uiForm={disableA2uiForm} />
            <PinButton isPinned={isPinned} messageId={message.id} onTogglePin={onTogglePin} t={t} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group mb-6 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[90%] items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
        {isUser ? (
          <Avatar agentId="user" agentName={authorName} size={32} />
        ) : (
          <SvgAvatar agentId={message.authorAgentId ?? "openclaw"} size={32} className="shrink-0" />
        )}

        <div className="min-w-0">
          <div className={`mb-1 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 ${isUser ? "flex-row-reverse" : ""}`}>
            <span className="font-medium text-gray-500 dark:text-gray-400">{authorName}</span>
            <PinButton isPinned={isPinned} messageId={message.id} onTogglePin={onTogglePin} t={t} />
          </div>

          <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <>
                {message.thinking ? (
                  <ThinkingBlock thinking={message.thinking} isStreaming={Boolean(message.isStreaming)} />
                ) : null}
                {message.isStreaming ? (
                  <StreamingMarkdownContent
                    content={message.content}
                    isStreaming
                    disableA2uiForm={disableA2uiForm}
                  />
                ) : (
                  <MarkdownContent
                    content={message.content}
                    messageId={message.id}
                    disableA2uiForm={disableA2uiForm}
                  />
                )}
                {message.isStreaming && <StreamingIndicator />}
              </>
            )}
          </div>

          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className={`mt-3 flex flex-wrap gap-2 ${isUser ? "justify-end" : ""}`}>
              {message.toolCalls.map((toolCall) => (
                <div
                  key={toolCall.id}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white/80 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900/70"
                >
                  <span className="font-mono text-gray-600 dark:text-gray-300">{toolCall.name}</span>
                  <span className="rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    {t(`toolStatus.${toolCall.status}`, { defaultValue: toolCall.status })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hasImages && (
            <div className={`mt-3 grid max-w-sm grid-cols-2 gap-2 ${isUser ? "ml-auto" : ""}`}>
              {message.attachments?.map((attachment) =>
                attachment.dataUrl ? (
                  <img
                    key={attachment.id}
                    src={attachment.dataUrl}
                    alt={attachment.name ?? attachment.mimeType}
                    className="h-28 w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                  />
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
