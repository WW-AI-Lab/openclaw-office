import type {
  ChatAttachment,
  ChatContentBlock,
  ToolCallInfo,
} from "@/gateway/adapter-types";
import i18n from "@/i18n";
import { generateMessageId } from "@/lib/message-utils";

export type MessageRole = "user" | "assistant" | "system";
export type ChatMessageKind = "message" | "tool" | "command";

export interface ChatDockMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
  toolCalls?: ToolCallInfo[];
  kind?: ChatMessageKind;
  runId?: string | null;
  aborted?: boolean;
  authorAgentId?: string | null;
  collapsed?: boolean;
  thinking?: string;
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is Extract<ChatContentBlock, { type: "text" }> =>
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "text" &&
          typeof block.text === "string",
      )
      .map((block) => block.text)
      .join("\n");
  }
  return "";
}

export function extractThinkingFromHistoryMessage(message: Record<string, unknown>): string | undefined {
  if (typeof message.thinking === "string" && message.thinking.trim()) {
    return message.thinking.trim();
  }
  const content = message.content;
  if (Array.isArray(content)) {
    const blocks = content as Array<{ type?: string; text?: string; thinking?: string }>;
    const parts = blocks
      .filter((b) => b.type === "thinking" && (b.text || b.thinking))
      .map((b) => b.text || b.thinking || "");
    if (parts.length > 0) return parts.join("\n");
  }
  return undefined;
}

function normalizeRole(role: unknown): MessageRole {
  return role === "user" || role === "assistant" || role === "system" ? role : "assistant";
}

function isAttachmentLike(value: unknown): value is ChatAttachment {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as ChatAttachment).mimeType === "string",
  );
}

export function normalizeAttachment(attachment: ChatAttachment): ChatAttachment {
  return {
    id: attachment.id ?? generateMessageId(),
    name: attachment.name,
    mimeType: attachment.mimeType,
    dataUrl: attachment.dataUrl,
    content: attachment.content,
  };
}

export function extractAttachments(message: Record<string, unknown>): ChatAttachment[] {
  if (Array.isArray(message.attachments)) {
    return message.attachments.filter(isAttachmentLike).map(normalizeAttachment);
  }
  if (Array.isArray(message.content)) {
    return message.content
      .flatMap((block) => {
        if (!block || typeof block !== "object") return [];
        const record = block as Record<string, unknown>;
        if (record.type !== "image") return [];
        return [
          normalizeAttachment({
            id: String(record.id ?? generateMessageId()),
            mimeType:
              typeof record.mimeType === "string"
                ? record.mimeType
                : typeof record.media_type === "string"
                  ? record.media_type
                  : "image/png",
            dataUrl:
              typeof record.dataUrl === "string"
                ? record.dataUrl
                : typeof record.url === "string"
                  ? record.url
                  : undefined,
          }),
        ];
      })
      .filter(Boolean);
  }
  return [];
}

function normalizeHistoryMessage(message: Record<string, unknown>): ChatDockMessage {
  const toolCalls = Array.isArray(message.toolCalls) ? (message.toolCalls as ToolCallInfo[]) : undefined;
  const storedKind = typeof message.kind === "string" ? (message.kind as ChatMessageKind) : undefined;
  const inferredKind: ChatMessageKind | undefined =
    storedKind ?? (toolCalls && toolCalls.length > 0 && message.role === "system" ? "tool" : undefined);

  return {
    id: String(message.id ?? generateMessageId()),
    role: normalizeRole(message.role),
    content: extractText(message.content ?? message.text ?? ""),
    timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
    attachments: extractAttachments(message),
    toolCalls,
    kind: inferredKind,
    thinking: extractThinkingFromHistoryMessage(message),
    collapsed: typeof message.collapsed === "boolean" ? message.collapsed : inferredKind === "tool" ? true : undefined,
    authorAgentId: typeof message.authorAgentId === "string" ? message.authorAgentId : null,
    runId: typeof message.runId === "string" ? message.runId : null,
    aborted: Boolean(message.aborted),
  };
}

/**
 * Expand assistant messages that have embedded toolCalls (Gateway native format) into separate
 * "tool" kind messages followed by the assistant message.
 */
function reconstructToolMessages(
  messages: ChatDockMessage[],
  authorAgentId: string | null,
): ChatDockMessage[] {
  const result: ChatDockMessage[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        result.push({
          id: `${message.id}:tool:${toolCall.id}`,
          role: "system",
          content: i18n.t("chat:toolActivity.finished", { name: toolCall.name }),
          timestamp: message.timestamp,
          kind: "tool",
          collapsed: true,
          toolCalls: [toolCall],
          runId: message.runId ?? null,
          authorAgentId: message.authorAgentId ?? authorAgentId,
        });
      }
      result.push({ ...message, toolCalls: undefined });
    } else {
      result.push(message);
    }
  }
  return result;
}

export function normalizeHistoryMessages(
  messages: Record<string, unknown>[],
  authorAgentId: string | null,
): ChatDockMessage[] {
  const normalized = messages.map((message) => {
    const msg = normalizeHistoryMessage(message);
    if ((msg.role === "assistant" || msg.kind === "tool") && !msg.authorAgentId) {
      return { ...msg, authorAgentId };
    }
    return msg;
  });
  return reconstructToolMessages(normalized, authorAgentId);
}

export function findLatestToolMessageIndex(messages: ChatDockMessage[], runId: string, toolName: string): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message?.kind === "tool" &&
      message.runId === runId &&
      message.toolCalls?.some((toolCall) => toolCall.name === toolName)
    ) {
      return index;
    }
  }
  return -1;
}

export function buildAssistantMessage(
  content: string,
  runId: string | null,
  authorAgentId: string | null,
  source?: Record<string, unknown>,
): ChatDockMessage {
  const thinking = source ? extractThinkingFromHistoryMessage(source) : undefined;
  return {
    id: String(source?.id ?? generateMessageId()),
    role: "assistant",
    content,
    timestamp: Date.now(),
    attachments: source ? extractAttachments(source) : undefined,
    toolCalls: Array.isArray(source?.toolCalls) ? (source.toolCalls as ToolCallInfo[]) : undefined,
    runId,
    aborted: Boolean(source?.aborted),
    authorAgentId,
    thinking,
  };
}

function getAssistantRunContent(messages: ChatDockMessage[], runId: string): string {
  return messages
    .filter((message) => message.role === "assistant" && message.runId === runId)
    .map((message) => message.content)
    .join("\n");
}

export function appendAssistantSegment(
  messages: ChatDockMessage[],
  content: string,
  runId: string | null,
  authorAgentId: string | null,
  source?: Record<string, unknown>,
): ChatDockMessage[] {
  if (!content.trim()) {
    return messages;
  }

  if (runId) {
    const existingContent = getAssistantRunContent(messages, runId);
    const normalizedContent =
      existingContent && content.startsWith(existingContent)
        ? content.slice(existingContent.length).replace(/^\n+/u, "")
        : content;
    if (!normalizedContent.trim()) {
      return messages;
    }
    return [...messages, buildAssistantMessage(normalizedContent, runId, authorAgentId, source)];
  }

  return [...messages, buildAssistantMessage(content, runId, authorAgentId, source)];
}

export function buildSystemMessage(content: string, kind: ChatMessageKind = "command"): ChatDockMessage {
  return {
    id: generateMessageId(),
    role: "system",
    content,
    timestamp: Date.now(),
    kind,
  };
}
