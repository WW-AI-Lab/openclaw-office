import { create } from "zustand";
import type { GatewayAdapter } from "@/gateway/adapter";
import { getAdapter } from "@/gateway/adapter-provider";
import type {
  ChatAttachment,
  ChatContentBlock,
  ChatHistoryResult,
  SessionInfo,
  ToolCallInfo,
} from "@/gateway/adapter-types";
import type { AgentEventPayload, GatewayEventFrame } from "@/gateway/types";
import i18n from "@/i18n";
import { exportChatTranscriptMarkdown } from "@/lib/chat-export";
import { buildSlashHelpText, parseSlashCommand } from "@/lib/chat-slash-commands";
import { localPersistence } from "@/lib/local-persistence";
import { generateMessageId } from "@/lib/message-utils";
import { serverPersistence } from "@/lib/server-persistence";
import { extractAgentIdFromSessionKey } from "@/lib/session-key-utils";

export type MessageRole = "user" | "assistant" | "system";
export type ChatMessageKind = "message" | "tool" | "command";

export interface ChatQueueItem {
  id: string;
  text: string;
  attachments: ChatAttachment[];
  createdAt: number;
}

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

export interface SessionRuntime {
  messages: ChatDockMessage[];
  streamingMessage: Record<string, unknown> | null;
  activeRunId: string | null;
  isStreaming: boolean;
  isHistoryLoaded: boolean;
  isHistoryLoading: boolean;
  queue: ChatQueueItem[];
  hadToolEvents: boolean;
  thinkingLevel: string | null;
}

interface ChatDockState {
  messages: ChatDockMessage[];
  isStreaming: boolean;
  sessionStates: Map<string, SessionRuntime>;
  hadToolEvents: boolean;
  streamSegments: string[];
  currentSessionKey: string;
  dockExpanded: boolean;
  targetAgentId: string | null;
  sessions: SessionInfo[];
  error: string | null;
  activeRunId: string | null;
  streamingMessage: Record<string, unknown> | null;
  isHistoryLoaded: boolean;
  isHistoryLoading: boolean;
  draft: string;
  attachments: ChatAttachment[];
  queue: ChatQueueItem[];
  focusMode: boolean;
  searchQuery: string;
  pinnedMessageIds: string[];
  submittedA2uiIds: string[];
  thinkingLevel: string | null;

  sendMessage: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  abort: () => Promise<void>;
  toggleDock: () => void;
  setDockExpanded: (expanded: boolean) => void;
  switchSession: (key: string) => void;
  newSession: (agentId?: string | null) => void;
  loadSessions: () => Promise<void>;
  loadHistory: () => Promise<void>;
  initializeHistory: () => Promise<void>;
  setTargetAgent: (agentId: string) => void;
  handleChatEvent: (event: Record<string, unknown>) => void;
  handleAgentEvent: (event: AgentEventPayload) => void;
  clearError: () => void;
  initEventListeners: (
    wsClient: {
      onEvent: (name: string, handler: (frame: GatewayEventFrame) => void) => () => void;
    } | null,
  ) => () => void;
  setDraft: (draft: string) => void;
  addAttachment: (attachment: ChatAttachment) => void;
  removeAttachment: (attachmentId: string) => void;
  clearAttachments: () => void;
  clearMessages: () => Promise<void>;
  setFocusMode: (focusMode: boolean) => void;
  setSearchQuery: (query: string) => void;
  togglePinMessage: (messageId: string) => void;
  markA2uiSubmitted: (messageId: string) => void;
  exportCurrentSession: () => boolean;
}

export function createEmptySessionRuntime(): SessionRuntime {
  return {
    messages: [],
    streamingMessage: null,
    activeRunId: null,
    isStreaming: false,
    isHistoryLoaded: false,
    isHistoryLoading: false,
    queue: [],
    hadToolEvents: false,
    thinkingLevel: null,
  };
}

function runtimeFromState(state: ChatDockState): SessionRuntime {
  return {
    messages: state.messages,
    streamingMessage: state.streamingMessage,
    activeRunId: state.activeRunId,
    isStreaming: state.isStreaming,
    isHistoryLoaded: state.isHistoryLoaded,
    isHistoryLoading: state.isHistoryLoading,
    queue: state.queue,
    hadToolEvents: state.hadToolEvents,
    thinkingLevel: state.thinkingLevel,
  };
}

function applyRuntime(runtime: SessionRuntime): {
  messages: ChatDockMessage[];
  streamingMessage: Record<string, unknown> | null;
  activeRunId: string | null;
  isStreaming: boolean;
  isHistoryLoaded: boolean;
  isHistoryLoading: boolean;
  queue: ChatQueueItem[];
  hadToolEvents: boolean;
  thinkingLevel: string | null;
} {
  return {
    messages: runtime.messages,
    streamingMessage: runtime.streamingMessage,
    activeRunId: runtime.activeRunId,
    isStreaming: runtime.isStreaming,
    isHistoryLoaded: runtime.isHistoryLoaded,
    isHistoryLoading: runtime.isHistoryLoading,
    queue: runtime.queue,
    hadToolEvents: runtime.hadToolEvents,
    thinkingLevel: runtime.thinkingLevel,
  };
}

function shouldReloadHistoryForFinalEvent(hadToolEvents: boolean): boolean {
  return hadToolEvents;
}

interface ApplyChatEventContext {
  authorAgentId: string | null;
}

interface ApplyChatEventResult {
  runtime: SessionRuntime;
  persist: boolean;
  reloadHistory: boolean;
  error: string | null;
  processQueue: boolean;
}

function applyChatEventToRuntime(
  base: SessionRuntime,
  event: Record<string, unknown>,
  ctx: ApplyChatEventContext,
): ApplyChatEventResult {
  const eventState = String(event.state || "");
  const runId = String(event.runId || "");
  const message = event.message as Record<string, unknown> | undefined;

  let resolvedState = eventState;
  if (!resolvedState && message) {
    const stopReason = message.stopReason ?? message.stop_reason;
    if (stopReason) {
      resolvedState = "final";
    } else if (message.role || message.content) {
      resolvedState = "delta";
    }
  }

  switch (resolvedState) {
    case "delta": {
      if (!message) {
        return {
          runtime: base,
          persist: false,
          reloadHistory: false,
          error: null,
          processQueue: false,
        };
      }
      const isNewRun = Boolean(runId && runId !== base.activeRunId);
      return {
        runtime: {
          ...base,
          streamingMessage: message,
          activeRunId: runId || base.activeRunId,
          isStreaming: true,
          hadToolEvents: isNewRun ? false : base.hadToolEvents,
        },
        persist: false,
        reloadHistory: false,
        error: null,
        processQueue: false,
      };
    }
    case "final": {
      const assistantText = message ? extractText(message.content ?? message.text ?? "") : "";
      if (assistantText) {
        const appended = appendAssistantSegment(
          base.messages,
          assistantText,
          runId || null,
          ctx.authorAgentId,
          message,
        );
        return {
          runtime: {
            ...base,
            messages: appended,
            isStreaming: false,
            streamingMessage: null,
            activeRunId: null,
            hadToolEvents: false,
          },
          persist: true,
          reloadHistory: false,
          error: null,
          processQueue: true,
        };
      }
      return {
        runtime: {
          ...base,
          isStreaming: false,
          streamingMessage: null,
          activeRunId: null,
          hadToolEvents: false,
        },
        persist: false,
        reloadHistory: shouldReloadHistoryForFinalEvent(base.hadToolEvents),
        error: null,
        processQueue: true,
      };
    }
    case "error": {
      const errorMsg = String(event.errorMessage || i18n.t("common:errors.errorOccurred"));
      return {
        runtime: {
          ...base,
          isStreaming: false,
          streamingMessage: null,
          activeRunId: null,
        },
        persist: false,
        reloadHistory: false,
        error: errorMsg,
        processQueue: false,
      };
    }
    case "aborted": {
      return {
        runtime: {
          ...base,
          isStreaming: false,
          streamingMessage: null,
          activeRunId: null,
        },
        persist: false,
        reloadHistory: true,
        error: null,
        processQueue: true,
      };
    }
    default: {
      if (base.isStreaming && message) {
        return {
          runtime: { ...base, streamingMessage: message },
          persist: false,
          reloadHistory: false,
          error: null,
          processQueue: false,
        };
      }
      return {
        runtime: base,
        persist: false,
        reloadHistory: false,
        error: null,
        processQueue: false,
      };
    }
  }
}

function applyThinkingDeltaToStreamingMessage(
  prev: Record<string, unknown> | null,
  delta: string,
): Record<string, unknown> {
  const base: Record<string, unknown> = prev ? { ...prev } : { role: "assistant", content: "" };
  const prevThinking = typeof base.thinking === "string" ? base.thinking : "";
  return { ...base, thinking: prevThinking + delta };
}

function applyToolAgentEventSlice(
  messages: ChatDockMessage[],
  streamingMessage: Record<string, unknown> | null,
  activeRunId: string | null,
  event: AgentEventPayload,
  authorAgentId: string | null,
): { messages: ChatDockMessage[]; streamingMessage: Record<string, unknown> | null } {
  const phase = typeof event.data.phase === "string" ? event.data.phase : "";
  const name = typeof event.data.name === "string" ? event.data.name : "unknown";
  const args = event.data.args as Record<string, unknown> | undefined;
  const toolCallStatus = phase === "start" ? "running" : "done";
  const toolCall: ToolCallInfo = {
    id: `${event.runId}:${event.seq}`,
    name,
    args,
    status: toolCallStatus,
  };

  const currentStreamingText = extractText(streamingMessage?.content ?? streamingMessage?.text ?? "");
  const nextMessages =
    phase === "start"
      ? appendAssistantSegment(
          messages,
          currentStreamingText,
          activeRunId ?? event.runId,
          authorAgentId,
          streamingMessage ?? undefined,
        )
      : [...messages];
  const existingIndex = findLatestToolMessageIndex(nextMessages, event.runId, name);
  if (existingIndex >= 0) {
    const mergedMessages = [...nextMessages];
    const existing = mergedMessages[existingIndex]!;
    mergedMessages[existingIndex] = {
      ...existing,
      content:
        phase === "start"
          ? i18n.t("chat:toolActivity.calling", { name })
          : i18n.t("chat:toolActivity.finished", { name }),
      timestamp: Date.now(),
      collapsed: toolCallStatus !== "running",
      toolCalls: (existing.toolCalls ?? []).map((existingToolCall) =>
        existingToolCall.name === name
          ? {
              ...existingToolCall,
              args: args ?? existingToolCall.args,
              status: toolCallStatus,
            }
          : existingToolCall,
      ),
    };
    return {
      messages: mergedMessages,
      streamingMessage: phase === "start" ? null : streamingMessage,
    };
  }

  return {
    messages: [
      ...nextMessages,
      {
        ...buildSystemMessage(
          phase === "start"
            ? i18n.t("chat:toolActivity.calling", { name })
            : i18n.t("chat:toolActivity.finished", { name }),
          "tool",
        ),
        authorAgentId,
        runId: event.runId,
        collapsed: toolCallStatus !== "running",
        toolCalls: [toolCall],
      },
    ],
    streamingMessage: phase === "start" ? null : streamingMessage,
  };
}

function buildSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

const CHAT_PAGE_LAST_SESSION_KEY = "openclaw-office-chat-page:last-session";

function isWorkspaceChatSessionKey(sessionKey: string): boolean {
  return /^agent:[^:]+:(main|session-[^:]+)$/u.test(sessionKey);
}

function filterWorkspaceSessions(sessions: SessionInfo[]): SessionInfo[] {
  return sessions.filter((session) => isWorkspaceChatSessionKey(session.key));
}

function getStoredWorkspaceSessionKey(): string | null {
  try {
    const value = localStorage.getItem(CHAT_PAGE_LAST_SESSION_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function storeWorkspaceSessionKey(sessionKey: string): void {
  if (!isWorkspaceChatSessionKey(sessionKey)) {
    return;
  }
  try {
    localStorage.setItem(CHAT_PAGE_LAST_SESSION_KEY, sessionKey);
  } catch {
    // Ignore localStorage failures.
  }
}

function resolveSessionAgentId(sessionKey: string, sessions: SessionInfo[]): string | null {
  const session = sessions.find((item) => item.key === sessionKey);
  return session?.agentId ?? extractAgentIdFromSessionKey(sessionKey);
}

function selectPreferredSessionKey(agentId: string, sessions: SessionInfo[]): string {
  const matched = filterWorkspaceSessions(sessions)
    .filter((session) => resolveSessionAgentId(session.key, sessions) === agentId)
    .filter((session) => session.key !== buildSessionKey(agentId))
    .sort((a, b) => {
      const aTime = a.lastActiveAt ?? a.updatedAt ?? a.createdAt ?? 0;
      const bTime = b.lastActiveAt ?? b.updatedAt ?? b.createdAt ?? 0;
      return bTime - aTime;
    });
  return matched[0]?.key ?? buildSessionKey(agentId);
}

function mergeCurrentSession(
  sessions: SessionInfo[],
  currentSessionKey: string,
  targetAgentId: string | null,
): SessionInfo[] {
  const isBootstrapDefaultSession = currentSessionKey === "agent:main:main" && targetAgentId === null;
  if (isBootstrapDefaultSession) {
    return sessions;
  }
  if (sessions.some((session) => session.key === currentSessionKey)) {
    return sessions;
  }

  const now = Date.now();
  return [
    normalizeSession({
      key: currentSessionKey,
      agentId: targetAgentId ?? extractAgentIdFromSessionKey(currentSessionKey) ?? undefined,
      label: currentSessionKey,
      createdAt: now,
      lastActiveAt: now,
      messageCount: 0,
    }),
    ...sessions,
  ];
}

function touchSession(
  sessions: SessionInfo[],
  currentSessionKey: string,
  targetAgentId: string | null,
  messageCount: number,
): SessionInfo[] {
  const now = Date.now();
  const existing = sessions.find((session) => session.key === currentSessionKey);
  const nextSession = normalizeSession({
    ...existing,
    key: currentSessionKey,
    agentId: targetAgentId ?? existing?.agentId ?? extractAgentIdFromSessionKey(currentSessionKey) ?? undefined,
    label: existing?.label ?? currentSessionKey,
    createdAt: existing?.createdAt ?? now,
    lastActiveAt: now,
    updatedAt: now,
    messageCount,
  });
  return [
    nextSession,
    ...sessions.filter((session) => session.key !== currentSessionKey),
  ];
}

function persistSessions(sessions: SessionInfo[]): void {
  void localPersistence.saveSessions(sessions);
  serverPersistence.saveSessions(sessions);
}

function extractText(content: unknown): string {
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

function extractThinkingFromHistoryMessage(message: Record<string, unknown>): string | undefined {
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

function normalizeAttachment(attachment: ChatAttachment): ChatAttachment {
  return {
    id: attachment.id ?? generateMessageId(),
    name: attachment.name,
    mimeType: attachment.mimeType,
    dataUrl: attachment.dataUrl,
    content: attachment.content,
  };
}

function extractAttachments(message: Record<string, unknown>): ChatAttachment[] {
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
  // Preserve the kind field; infer "tool" when not stored but toolCalls exist on a system message
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
    // Completed tool messages in history should be collapsed by default
    collapsed: typeof message.collapsed === "boolean" ? message.collapsed : inferredKind === "tool" ? true : undefined,
    authorAgentId: typeof message.authorAgentId === "string" ? message.authorAgentId : null,
    runId: typeof message.runId === "string" ? message.runId : null,
    aborted: Boolean(message.aborted),
  };
}

/**
 * Expand assistant messages that have embedded toolCalls (Gateway native format) into separate
 * "tool" kind messages followed by the assistant message. This makes Gateway-fetched history
 * display identically to live session tool activity bubbles.
 *
 * For cached messages (live-session format), assistant messages do NOT have embedded toolCalls
 * (they come via separate agent events), so this is a no-op for those messages.
 */
function reconstructToolMessages(
  messages: ChatDockMessage[],
  authorAgentId: string | null,
): ChatDockMessage[] {
  const result: ChatDockMessage[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
      // Insert individual tool kind messages before the assistant message
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
      // Push the assistant message without embedded toolCalls to avoid double-reconstruction on cache reload
      result.push({ ...message, toolCalls: undefined });
    } else {
      result.push(message);
    }
  }
  return result;
}

function normalizeHistoryMessages(
  messages: Record<string, unknown>[],
  authorAgentId: string | null,
): ChatDockMessage[] {
  const normalized = messages.map((message) => {
    const msg = normalizeHistoryMessage(message);
    // Apply session authorAgentId as fallback for assistant and tool messages
    if ((msg.role === "assistant" || msg.kind === "tool") && !msg.authorAgentId) {
      return { ...msg, authorAgentId };
    }
    return msg;
  });
  // Reconstruct separate tool kind messages from any assistant messages that have embedded toolCalls
  // (Gateway native format). For cached live-session messages this is a no-op.
  return reconstructToolMessages(normalized, authorAgentId);
}

function findLatestToolMessageIndex(messages: ChatDockMessage[], runId: string, toolName: string): number {
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

function buildAssistantMessage(
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

function appendAssistantSegment(
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

function normalizeSession(session: SessionInfo): SessionInfo {
  return {
    ...session,
    label: session.label ?? session.key,
    lastActiveAt: session.lastActiveAt ?? session.updatedAt ?? Date.now(),
    messageCount: session.messageCount ?? 0,
  };
}

function applyMessageCountHints(
  sessions: SessionInfo[],
  messageCountHints: Map<string, number>,
): SessionInfo[] {
  if (messageCountHints.size === 0) {
    return sessions;
  }

  return sessions.map((session) => {
    const hinted = messageCountHints.get(session.key);
    if (typeof hinted !== "number" || !Number.isFinite(hinted) || hinted < 0) {
      return session;
    }

    const current =
      typeof session.messageCount === "number" && Number.isFinite(session.messageCount) && session.messageCount >= 0
        ? session.messageCount
        : 0;
    if (hinted <= current) {
      return session;
    }

    return {
      ...session,
      messageCount: hinted,
    };
  });
}

function buildSystemMessage(content: string, kind: ChatMessageKind = "command"): ChatDockMessage {
  return {
    id: generateMessageId(),
    role: "system",
    content,
    timestamp: Date.now(),
    kind,
  };
}

async function withAdapter<T>(fn: (adapter: GatewayAdapter) => Promise<T>): Promise<T> {
  const adapter = getAdapter();
  return fn(adapter);
}

// Ensure IndexedDB is opened at module load (non-blocking)
localPersistence.open().catch(() => {});

async function executeSlashCommand(
  commandText: string,
  state: ChatDockState,
  set: (partial: Partial<ChatDockState> | ((state: ChatDockState) => Partial<ChatDockState>)) => void,
  get: () => ChatDockState,
): Promise<boolean> {
  const parsed = parseSlashCommand(commandText);
  if (!parsed) {
    return false;
  }

  const { command, args } = parsed;
  const sessionKey = state.currentSessionKey;

  const appendSystemMessage = async (content: string) => {
    const systemMessage = buildSystemMessage(content);
    set((current) => ({ messages: [...current.messages, systemMessage] }));
    await localPersistence.saveMessage(sessionKey, systemMessage);
  };

  switch (command.name) {
    case "help":
      await appendSystemMessage(buildSlashHelpText());
      return true;
    case "new":
      get().newSession();
      await appendSystemMessage(i18n.t("chat:slash.feedback.newSession"));
      return true;
    case "reset":
      try {
        await withAdapter((adapter) => adapter.sessionsReset(sessionKey));
      } catch {
        // Continue with local reset for older gateways.
      }
      await get().clearMessages();
      set({
        draft: "",
        attachments: [],
        isStreaming: false,
        activeRunId: null,
        streamingMessage: null,
      });
      await appendSystemMessage(i18n.t("chat:slash.feedback.reset"));
      return true;
    case "stop":
      await get().abort();
      await appendSystemMessage(i18n.t("chat:slash.feedback.stop"));
      return true;
    case "clear":
      await get().clearMessages();
      return true;
    case "focus":
      set((current) => ({ focusMode: !current.focusMode }));
      await appendSystemMessage(
        i18n.t(get().focusMode ? "chat:slash.feedback.focusEnabled" : "chat:slash.feedback.focusDisabled"),
      );
      return true;
    case "export":
      if (get().exportCurrentSession()) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.exported"));
      } else {
        await appendSystemMessage(i18n.t("chat:slash.feedback.exportUnavailable"));
      }
      return true;
    case "agents": {
      try {
        const result = await withAdapter((adapter) => adapter.agentsList());
        const agentLines = result.agents.map((agent) => `- \`${agent.id}\` — ${agent.name}`);
        await appendSystemMessage([`**${i18n.t("chat:slash.feedback.availableAgents")}**`, "", ...agentLines].join("\n"));
      } catch (error) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.agentsLoadFailed", { error: String(error) }),
        );
      }
      return true;
    }
    case "model": {
      if (!args) {
        const activeSession = get().sessions.find((session) => session.key === sessionKey);
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.currentModel", {
            model: activeSession?.model ?? "default",
            providerSuffix: activeSession?.modelProvider
              ? i18n.t("common:format.viaValue", { value: `\`${activeSession.modelProvider}\`` })
              : "",
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { model: args }));
        set((current) => ({
          sessions: current.sessions.map((session) =>
            session.key === sessionKey ? { ...session, model: args } : session,
          ),
        }));
        await appendSystemMessage(i18n.t("chat:slash.feedback.modelSet", { model: args }));
      } catch (error) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.modelSetFailed", { error: String(error) }));
      }
      return true;
    }
    case "think": {
      if (!args) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.currentThinking", {
            level: get().thinkingLevel ?? "default",
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { thinkingLevel: args }));
        set({ thinkingLevel: args });
        await appendSystemMessage(i18n.t("chat:slash.feedback.thinkingSet", { level: args }));
      } catch (error) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.thinkingSetFailed", { error: String(error) }),
        );
      }
      return true;
    }
    case "verbose": {
      if (!args) {
        const activeSession = get().sessions.find((session) => session.key === sessionKey);
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.currentVerbose", {
            level: activeSession?.verboseLevel ?? "off",
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { verboseLevel: args }));
        await appendSystemMessage(i18n.t("chat:slash.feedback.verboseSet", { level: args }));
      } catch (error) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.verboseSetFailed", { error: String(error) }),
        );
      }
      return true;
    }
    case "fast": {
      if (!args || args === "status") {
        const activeSession = get().sessions.find((session) => session.key === sessionKey);
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.fastStatus", {
            enabled: activeSession?.fastMode
              ? i18n.t("chat:state.enabled")
              : i18n.t("chat:state.disabled"),
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { fastMode: args === "on" }));
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.fastSet", {
            enabled: args === "on" ? i18n.t("chat:state.enabled") : i18n.t("chat:state.disabled"),
          }),
        );
      } catch (error) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.fastSetFailed", { error: String(error) }));
      }
      return true;
    }
    case "compact":
      try {
        await withAdapter((adapter) => adapter.sessionsCompact(sessionKey));
        await appendSystemMessage(i18n.t("chat:slash.feedback.compactSuccess"));
      } catch (error) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.compactFailed", { error: String(error) }));
      }
      return true;
    default:
      return false;
  }
}

export const useChatDockStore = create<ChatDockState>((set, get) => {
  const sendToSessionKey = async (sessionKey: string, text: string, attachments: ChatAttachment[]) => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    const targetAgentIdForSession =
      resolveSessionAgentId(sessionKey, get().sessions) ?? extractAgentIdFromSessionKey(sessionKey);
    const userMsg: ChatDockMessage = {
      id: generateMessageId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    set((state) => {
      const map = new Map(state.sessionStates);
      const rt = map.get(sessionKey) ?? createEmptySessionRuntime();
      const nextSessions = touchSession(
        state.sessions,
        sessionKey,
        targetAgentIdForSession,
        rt.messages.length + 1,
      );
      map.set(sessionKey, {
        ...rt,
        messages: [...rt.messages, userMsg],
        isStreaming: true,
        streamingMessage: null,
      });
      return { sessionStates: map, sessions: nextSessions };
    });
    void localPersistence.saveMessage(sessionKey, userMsg);
    const msgs = get().sessionStates.get(sessionKey)?.messages ?? [];
    serverPersistence.saveMessages(sessionKey, msgs, targetAgentIdForSession);
    persistSessions(get().sessions);
    try {
      await withAdapter((adapter) =>
        adapter.chatSend({
          text: trimmed,
          sessionKey,
          attachments,
        }),
      );
    } catch (err) {
      set((state) => {
        if (state.currentSessionKey !== sessionKey) {
          const map = new Map(state.sessionStates);
          const r = map.get(sessionKey);
          if (r) map.set(sessionKey, { ...r, isStreaming: false });
          return { sessionStates: map };
        }
        return { error: String(err), isStreaming: false };
      });
    }
  };

  const reloadHistoryForBackgroundSession = async (sessionKey: string) => {
    try {
      const result = await withAdapter((adapter) => adapter.chatHistory(sessionKey));
      const authorAgentId =
        resolveSessionAgentId(sessionKey, get().sessions) ?? extractAgentIdFromSessionKey(sessionKey);
      const messages = normalizeHistoryMessages(
        result.messages as unknown as Record<string, unknown>[],
        authorAgentId,
      );
      set((state) => {
        const map = new Map(state.sessionStates);
        const rt = map.get(sessionKey) ?? createEmptySessionRuntime();
        map.set(sessionKey, {
          ...rt,
          messages,
          isHistoryLoaded: true,
          isHistoryLoading: false,
          thinkingLevel: result.thinkingLevel ?? rt.thinkingLevel,
        });
        return { sessionStates: map };
      });
      void localPersistence.saveMessages(sessionKey, messages);
      serverPersistence.saveMessagesImmediate(sessionKey, messages, authorAgentId);
    } catch {
      // Background history refresh is best-effort.
    }
  };

  const dequeueAndProcessQueue = (eventSessionKey: string) => {
    const state = get();
    if (eventSessionKey !== state.currentSessionKey) {
      const map = new Map(state.sessionStates);
      const rt = map.get(eventSessionKey);
      const next = rt?.queue[0];
      if (!next || !rt) return;
      map.set(eventSessionKey, { ...rt, queue: rt.queue.slice(1) });
      set({ sessionStates: map });
      void sendToSessionKey(eventSessionKey, next.text, next.attachments);
      return;
    }
    const head = state.queue[0];
    if (!head) return;
    set((s) => ({ queue: s.queue.slice(1) }));
    void get().sendMessage(head.text, head.attachments);
  };

  return {
  messages: [],
  isStreaming: false,
  sessionStates: new Map(),
  hadToolEvents: false,
  streamSegments: [],
  currentSessionKey: "agent:main:main",
  dockExpanded: false,
  targetAgentId: null,
  sessions: [],
  error: null,
  activeRunId: null,
  streamingMessage: null,
  isHistoryLoaded: false,
  isHistoryLoading: false,
  draft: "",
  attachments: [],
  queue: [],
  focusMode: false,
  searchQuery: "",
  pinnedMessageIds: [],
  submittedA2uiIds: [],
  thinkingLevel: null,

  sendMessage: async (text, attachments) => {
    const trimmed = text.trim();
    const outboundAttachments = attachments ?? get().attachments;
    if (!trimmed && outboundAttachments.length === 0) return;

    const slashHandled = await executeSlashCommand(trimmed, get(), set, get);
    if (slashHandled) {
      set({ draft: "", attachments: [] });
      return;
    }

    // Queue when the active session has an in-flight assistant response (top-level state is always current session).
    if (get().isStreaming) {
      set((state) => ({
        queue: [
          ...state.queue,
          {
            id: generateMessageId(),
            text: trimmed,
            attachments: outboundAttachments,
            createdAt: Date.now(),
          },
        ],
        draft: "",
        attachments: [],
      }));
      return;
    }

    const { currentSessionKey } = get();

    const userMsg: ChatDockMessage = {
      id: generateMessageId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
      attachments: outboundAttachments.length > 0 ? outboundAttachments : undefined,
    };

    const nextSessions = touchSession(
      get().sessions,
      currentSessionKey,
      get().targetAgentId,
      get().messages.length + 1,
    );

    set((state) => ({
      messages: [...state.messages, userMsg],
      sessions: nextSessions,
      isStreaming: true,
      dockExpanded: true,
      error: null,
      streamingMessage: null,
      draft: "",
      attachments: [],
    }));

    localPersistence.saveMessage(currentSessionKey, userMsg).catch(() => {});
    serverPersistence.saveMessages(currentSessionKey, get().messages, get().targetAgentId);
    persistSessions(nextSessions);

    try {
      await withAdapter((adapter) =>
        adapter.chatSend({
          text: trimmed,
          sessionKey: currentSessionKey,
          attachments: outboundAttachments,
        }),
      );
    } catch (err) {
      set({
        error: String(err),
        isStreaming: false,
      });
    }
  },

  abort: async () => {
    const { currentSessionKey } = get();
    set({
      isStreaming: false,
      streamingMessage: null,
    });

    try {
      await withAdapter((adapter) => adapter.chatAbort(currentSessionKey));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  toggleDock: () => {
    set((state) => ({ dockExpanded: !state.dockExpanded }));
  },

  setDockExpanded: (expanded) => {
    set({ dockExpanded: expanded });
  },

  switchSession: (key) => {
    const state = get();
    const savedMap = new Map(state.sessionStates);
    savedMap.set(state.currentSessionKey, runtimeFromState(state));

    const targetAgentId = resolveSessionAgentId(key, state.sessions);
    storeWorkspaceSessionKey(key);

    const restored = savedMap.get(key);
    if (restored !== undefined) {
      const applied = applyRuntime(restored);
      set({
        currentSessionKey: key,
        targetAgentId,
        ...applied,
        sessionStates: savedMap,
        hadToolEvents: restored.hadToolEvents,
        streamSegments: [],
        error: null,
        draft: "",
        attachments: [],
      });
      if (!restored.isHistoryLoaded && !restored.isHistoryLoading) {
        void get().initializeHistory();
      }
      return;
    }

    set({
      currentSessionKey: key,
      targetAgentId,
      ...applyRuntime(createEmptySessionRuntime()),
      sessionStates: savedMap,
      hadToolEvents: false,
      streamSegments: [],
      error: null,
      draft: "",
      attachments: [],
    });
    void get().initializeHistory();
  },

  newSession: (agentId) => {
    const state = get();
    const savedMap = new Map(state.sessionStates);
    savedMap.set(state.currentSessionKey, runtimeFromState(state));

    const resolvedAgentId = agentId ?? state.targetAgentId ?? "main";
    const newKey = `agent:${resolvedAgentId}:session-${Date.now()}`;
    const sessions = [
      {
        key: newKey,
        agentId: resolvedAgentId,
        label: newKey,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        messageCount: 0,
      },
      ...state.sessions.filter((session) => session.key !== newKey),
    ].map(normalizeSession);
    set({
      currentSessionKey: newKey,
      targetAgentId: resolvedAgentId,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      isHistoryLoaded: true,
      isHistoryLoading: false,
      draft: "",
      attachments: [],
      queue: [],
      thinkingLevel: null,
      hadToolEvents: false,
      streamSegments: [],
      sessionStates: savedMap,
      sessions,
    });
    storeWorkspaceSessionKey(newKey);
    void localPersistence.clearMessages(newKey);
    persistSessions(sessions);
  },

  loadSessions: async () => {
    const current = get();
    const messageCountHints = await serverPersistence.getAllMessageCounts();

    // Layer 1: Server file cache (fast, persistent)
    const serverCached = await serverPersistence.getSessions();
    if (serverCached.sessions.length > 0) {
      const normalizedServer = filterWorkspaceSessions(serverCached.sessions.map(normalizeSession));
      set({
        sessions: applyMessageCountHints(
          mergeCurrentSession(normalizedServer, current.currentSessionKey, current.targetAgentId),
          messageCountHints,
        ),
      });
    } else {
      // Layer 2: IndexedDB fallback
      const idbCached = await localPersistence.getSessions();
      if (idbCached.sessions.length > 0) {
        const normalizedIdb = filterWorkspaceSessions(idbCached.sessions.map(normalizeSession));
        set({
          sessions: applyMessageCountHints(
            mergeCurrentSession(normalizedIdb, current.currentSessionKey, current.targetAgentId),
            messageCountHints,
          ),
        });
      }
    }

    // Layer 3: Always fetch fresh from Gateway in background
    try {
      const result = await withAdapter((adapter) => adapter.sessionsList());
      const normalized = filterWorkspaceSessions(result.map(normalizeSession));
      const merged = applyMessageCountHints(
        mergeCurrentSession(normalized, get().currentSessionKey, get().targetAgentId),
        messageCountHints,
      );
      set({ sessions: merged });
      persistSessions(merged);
    } catch {
      // Sessions are optional for basic chat usage.
    }
  },

  loadHistory: async () => {
    const { currentSessionKey } = get();
    try {
      const result = await withAdapter((adapter) => adapter.chatHistory(currentSessionKey));
      const authorAgentId = resolveSessionAgentId(currentSessionKey, get().sessions) ?? get().targetAgentId;
      const messages = normalizeHistoryMessages(
        result.messages as unknown as Record<string, unknown>[],
        authorAgentId,
      );
      const nextSessions = touchSession(get().sessions, currentSessionKey, get().targetAgentId, messages.length);
      set({ messages, thinkingLevel: result.thinkingLevel ?? null, sessions: nextSessions });
      await localPersistence.saveMessages(currentSessionKey, messages);
      serverPersistence.saveMessagesImmediate(currentSessionKey, messages, authorAgentId);
      persistSessions(nextSessions);
    } catch {
      set({ messages: [] });
    }
  },

  initializeHistory: async () => {
    const { currentSessionKey } = get();
    set({ isHistoryLoading: true });

    let cacheHit = false;
    const authorAgentId = resolveSessionAgentId(currentSessionKey, get().sessions) ?? get().targetAgentId;

    // Guard: abort if a concurrent sendMessage started (e.g. one-click flowchart).
    // After each await below, the synchronous part of sendMessage has already run
    // and set isStreaming=true — overwriting messages would discard the user message.
    const shouldAbort = () =>
      get().currentSessionKey !== currentSessionKey || get().isStreaming;

    // Layer 1: Server file cache (persistent across browser reloads/devices)
    try {
      const serverCached = await serverPersistence.getMessages(currentSessionKey);
      if (shouldAbort()) { set({ isHistoryLoaded: true, isHistoryLoading: false }); return; }
      if (serverCached.length > 0) {
        const nextSessions = touchSession(get().sessions, currentSessionKey, get().targetAgentId, serverCached.length);
        set({
          messages: serverCached,
          sessions: nextSessions,
          isHistoryLoaded: true,
          isHistoryLoading: false,
        });
        persistSessions(nextSessions);
        void localPersistence.saveMessages(currentSessionKey, serverCached);
        cacheHit = true;
      }
    } catch {
      // Server cache unavailable, fall through.
    }

    // Layer 2: IndexedDB fallback (if server cache missed)
    if (!cacheHit) {
      try {
        const idbCached = await localPersistence.getMessages(currentSessionKey);
        if (shouldAbort()) { set({ isHistoryLoaded: true, isHistoryLoading: false }); return; }
        if (idbCached.length > 0) {
          const nextSessions = touchSession(get().sessions, currentSessionKey, get().targetAgentId, idbCached.length);
          set({
            messages: idbCached,
            sessions: nextSessions,
            isHistoryLoaded: true,
            isHistoryLoading: false,
          });
          persistSessions(nextSessions);
          serverPersistence.saveMessagesImmediate(currentSessionKey, idbCached, authorAgentId);
          cacheHit = true;
        }
      } catch {
        // IndexedDB unavailable.
      }
    }

    // Layer 3: Gateway RPC fetch — always run to ensure we have the latest data
    try {
      const result: ChatHistoryResult = await withAdapter((adapter) =>
        adapter.chatHistory(currentSessionKey),
      );
      if (shouldAbort()) { set({ isHistoryLoaded: true, isHistoryLoading: false }); return; }
      const gatewayMessages = normalizeHistoryMessages(
        result.messages as unknown as Record<string, unknown>[],
        authorAgentId,
      );

      if (gatewayMessages.length > 0) {
        const currentMessages = get().messages;
        // Only overwrite the rich cached messages when Gateway actually has *more* messages
        // (new messages arrived since last cache write). When Gateway has the same count or
        // fewer messages it means the cache is richer (e.g. it contains kind:"tool" messages
        // that the Gateway history flattens into plain assistant messages). Overwriting in
        // that case permanently destroys the tool activity display metadata.
        const cacheHasRichMessages = cacheHit && currentMessages.some((m) => m.kind === "tool");
        const shouldUpdate = !cacheHit || (!cacheHasRichMessages && gatewayMessages.length !== currentMessages.length);
        if (shouldUpdate) {
          const nextSessions = touchSession(get().sessions, currentSessionKey, get().targetAgentId, gatewayMessages.length);
          set({
            messages: gatewayMessages,
            sessions: nextSessions,
            isHistoryLoaded: true,
            isHistoryLoading: false,
            thinkingLevel: result.thinkingLevel ?? null,
          });
          persistSessions(nextSessions);
          // Only persist the gateway messages when we actually used them
          void localPersistence.saveMessages(currentSessionKey, gatewayMessages);
          serverPersistence.saveMessagesImmediate(currentSessionKey, gatewayMessages, authorAgentId);
        }
      } else if (!cacheHit) {
        const activeSession = get().sessions.find((session) => session.key === currentSessionKey);
        set({
          messages: [],
          isHistoryLoaded: true,
          isHistoryLoading: false,
          thinkingLevel: activeSession?.thinkingLevel ?? result.thinkingLevel ?? null,
        });
      }
    } catch {
      if (!cacheHit) {
        set({ messages: [], isHistoryLoaded: true, isHistoryLoading: false });
      }
    }

    if (!get().isHistoryLoaded) {
      set({ isHistoryLoaded: true, isHistoryLoading: false });
    }
  },

  setTargetAgent: (agentId) => {
    const state = get();
    const savedMap = new Map(state.sessionStates);
    savedMap.set(state.currentSessionKey, runtimeFromState(state));

    const storedSessionKey = getStoredWorkspaceSessionKey();
    const storedAgentId =
      storedSessionKey && isWorkspaceChatSessionKey(storedSessionKey)
        ? resolveSessionAgentId(storedSessionKey, state.sessions)
        : null;
    const sessionKey =
      storedSessionKey && storedAgentId === agentId ? storedSessionKey : selectPreferredSessionKey(agentId, state.sessions);
    if (sessionKey === buildSessionKey(agentId)) {
      set({ sessionStates: savedMap });
      get().newSession(agentId);
      return;
    }

    storeWorkspaceSessionKey(sessionKey);
    set({
      sessionStates: savedMap,
      targetAgentId: agentId,
      currentSessionKey: sessionKey,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      isHistoryLoaded: false,
      hadToolEvents: false,
      streamSegments: [],
    });
    void get().initializeHistory();
  },

  handleChatEvent: (event) => {
    const eventSessionKey =
      typeof event.sessionKey === "string" && event.sessionKey.length > 0
        ? event.sessionKey
        : get().currentSessionKey;
    const currentKey = get().currentSessionKey;
    const isCurrent = eventSessionKey === currentKey;
    const authorAgentId =
      resolveSessionAgentId(eventSessionKey, get().sessions) ??
      (isCurrent ? get().targetAgentId : extractAgentIdFromSessionKey(eventSessionKey));

    const base: SessionRuntime = isCurrent
      ? runtimeFromState(get())
      : (get().sessionStates.get(eventSessionKey) ?? createEmptySessionRuntime());

    const outcome = applyChatEventToRuntime(base, event, { authorAgentId });

    if (isCurrent) {
      set((state) => {
        const sessionsUpdate = outcome.persist
          ? touchSession(
              state.sessions,
              currentKey,
              state.targetAgentId,
              outcome.runtime.messages.length,
            )
          : state.sessions;
        return {
          ...applyRuntime(outcome.runtime),
          sessionStates: state.sessionStates,
          hadToolEvents: outcome.runtime.hadToolEvents,
          streamSegments: [],
          sessions: sessionsUpdate,
          ...(outcome.error ? { error: outcome.error } : {}),
        };
      });
      if (outcome.persist) {
        persistSessions(get().sessions);
        const { messages, targetAgentId: agentIdPersist } = get();
        void localPersistence.saveMessages(currentKey, messages);
        serverPersistence.saveMessagesImmediate(currentKey, messages, agentIdPersist);
      }
    } else {
      set((state) => {
        const map = new Map(state.sessionStates);
        map.set(eventSessionKey, outcome.runtime);
        const agentForTouch =
          resolveSessionAgentId(eventSessionKey, state.sessions) ?? extractAgentIdFromSessionKey(eventSessionKey);
        const sessionsNext = outcome.persist
          ? touchSession(state.sessions, eventSessionKey, agentForTouch, outcome.runtime.messages.length)
          : state.sessions;
        return { sessionStates: map, sessions: sessionsNext };
      });
      if (outcome.persist) {
        persistSessions(get().sessions);
        const rt = get().sessionStates.get(eventSessionKey);
        if (rt) {
          const agentForTouch =
            resolveSessionAgentId(eventSessionKey, get().sessions) ?? extractAgentIdFromSessionKey(eventSessionKey);
          void localPersistence.saveMessages(eventSessionKey, rt.messages);
          serverPersistence.saveMessages(eventSessionKey, rt.messages, agentForTouch);
        }
      }
    }

    if (outcome.reloadHistory && isCurrent) {
      void get().loadHistory();
    } else if (outcome.reloadHistory && !isCurrent) {
      void reloadHistoryForBackgroundSession(eventSessionKey);
    }

    if (outcome.processQueue) {
      dequeueAndProcessQueue(eventSessionKey);
    }
  },

  handleAgentEvent: (event) => {
    const eventSessionKey = event.sessionKey ?? get().currentSessionKey;
    const isCurrent = eventSessionKey === get().currentSessionKey;
    const authorAgentId =
      resolveSessionAgentId(eventSessionKey, get().sessions) ??
      (isCurrent ? get().targetAgentId : extractAgentIdFromSessionKey(eventSessionKey));

    if (event.stream === "thinking") {
      const delta =
        (typeof event.data.text === "string" ? event.data.text : "") ||
        (typeof event.data.thinking === "string" ? event.data.thinking : "");
      if (!delta) return;

      if (isCurrent) {
        set((state) => ({
          streamingMessage: applyThinkingDeltaToStreamingMessage(state.streamingMessage, delta),
          isStreaming: true,
        }));
      } else {
        set((state) => {
          const map = new Map(state.sessionStates);
          const rt = map.get(eventSessionKey) ?? createEmptySessionRuntime();
          map.set(eventSessionKey, {
            ...rt,
            streamingMessage: applyThinkingDeltaToStreamingMessage(rt.streamingMessage, delta),
            isStreaming: true,
          });
          return { sessionStates: map };
        });
      }
      return;
    }

    if (event.stream !== "tool") return;

    if (isCurrent) {
      set((state) => {
        const slice = applyToolAgentEventSlice(
          state.messages,
          state.streamingMessage,
          state.activeRunId,
          event,
          authorAgentId,
        );
        return {
          messages: slice.messages,
          streamingMessage: slice.streamingMessage,
          hadToolEvents: true,
        };
      });
      const { currentSessionKey: sk, messages: msgs, targetAgentId: aid } = get();
      void localPersistence.saveMessages(sk, msgs);
      serverPersistence.saveMessages(sk, msgs, aid);
    } else {
      set((state) => {
        const map = new Map(state.sessionStates);
        const rt = map.get(eventSessionKey) ?? createEmptySessionRuntime();
        const slice = applyToolAgentEventSlice(
          rt.messages,
          rt.streamingMessage,
          rt.activeRunId,
          event,
          authorAgentId,
        );
        map.set(eventSessionKey, {
          ...rt,
          messages: slice.messages,
          streamingMessage: slice.streamingMessage,
          hadToolEvents: true,
        });
        return { sessionStates: map };
      });
      const rt = get().sessionStates.get(eventSessionKey);
      if (rt) {
        const agentForTouch =
          resolveSessionAgentId(eventSessionKey, get().sessions) ?? extractAgentIdFromSessionKey(eventSessionKey);
        void localPersistence.saveMessages(eventSessionKey, rt.messages);
        serverPersistence.saveMessages(eventSessionKey, rt.messages, agentForTouch);
      }
    }
  },

  clearError: () => set({ error: null }),

  initEventListeners: (wsClient) => {
    if (!wsClient) return () => {};

    const unsubChat = wsClient.onEvent("chat", (frame: GatewayEventFrame) => {
      const payload = frame.payload as Record<string, unknown>;
      get().handleChatEvent(payload);
    });
    const unsubAgent = wsClient.onEvent("agent", (frame: GatewayEventFrame) => {
      get().handleAgentEvent(frame.payload as AgentEventPayload);
    });

    return () => {
      unsubChat();
      unsubAgent();
    };
  },

  setDraft: (draft) => set({ draft }),

  addAttachment: (attachment) =>
    set((state) => ({
      attachments: [...state.attachments, normalizeAttachment(attachment)],
    })),

  removeAttachment: (attachmentId) =>
    set((state) => ({
      attachments: state.attachments.filter((attachment) => attachment.id !== attachmentId),
    })),

  clearAttachments: () => set({ attachments: [] }),

  clearMessages: async () => {
    const { currentSessionKey } = get();
    set({ messages: [] });
    await localPersistence.clearMessages(currentSessionKey);
    void serverPersistence.clearMessages(currentSessionKey);
  },

  setFocusMode: (focusMode) => set({ focusMode }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  togglePinMessage: (messageId) =>
    set((state) => ({
      pinnedMessageIds: state.pinnedMessageIds.includes(messageId)
        ? state.pinnedMessageIds.filter((id) => id !== messageId)
        : [...state.pinnedMessageIds, messageId],
    })),

  markA2uiSubmitted: (messageId) =>
    set((state) =>
      state.submittedA2uiIds.includes(messageId)
        ? state
        : { submittedA2uiIds: [...state.submittedA2uiIds, messageId] },
    ),

  exportCurrentSession: () => exportChatTranscriptMarkdown(get().messages, get().currentSessionKey),
  };
});
