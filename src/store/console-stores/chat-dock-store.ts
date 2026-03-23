import { create } from "zustand";
import type { GatewayAdapter } from "@/gateway/adapter";
import { getAdapter } from "@/gateway/adapter-provider";
import type { SessionInfo } from "@/gateway/adapter-types";
import { RpcError } from "@/gateway/rpc-client";
import type { GatewayEventFrame } from "@/gateway/types";
import i18n from "@/i18n";
import {
  buildOutboundChatMessage,
  buildTransportAttachments,
  type ChatAttachment,
} from "@/lib/chat-attachments";
import { formatSessionName } from "@/lib/chat-session-utils";
import {
  getMainAutomationStatus,
  MAIN_AUTOMATION_CONTINUE_PROMPT,
  MAIN_AUTOMATION_MAX_AUTO_CONTINUES,
  prepareMainAutomationMessage,
} from "@/lib/main-auto-orchestration";
import {
  GROUP_CHAT_SESSION_KEY,
  GROUP_CHAT_TARGET_ID,
  buildGroupRelaySessionKey,
  extractAgentIdFromSessionKey,
  isGroupSessionKey,
  isGroupTargetAgentId,
  parseGroupMentions,
  type MentionableAgent,
} from "@/lib/group-chat";
import { localPersistence } from "@/lib/local-persistence";
import { generateMessageId } from "@/lib/message-utils";
import { useConsoleSettingsStore } from "@/store/console-stores/settings-store";
import { useOfficeStore } from "@/store/office-store";

export type MessageRole = "user" | "assistant";

export interface ChatDockMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
  senderLabel?: string;
  senderAgentId?: string;
  sourceSessionKey?: string;
}

interface ChatDockState {
  messages: ChatDockMessage[];
  draftInput: string;
  pendingAttachments: ChatAttachment[];
  isStreaming: boolean;
  currentSessionKey: string;
  dockExpanded: boolean;
  targetAgentId: string | null;
  sessions: SessionInfo[];
  isSessionsLoading: boolean;
  error: string | null;
  activeRunId: string | null;
  streamingMessage: Record<string, unknown> | null;
  pendingSessionKeys: string[];
  runIdSessionKeys: Record<string, string>;
  streamBuffers: Record<string, string>;
  autoContinueSessions: Record<string, number>;
  isHistoryLoaded: boolean;
  isHistoryLoading: boolean;
  historyDialogOpen: boolean;
  historyDialogTitle: string | null;
  historyDialogSubtitle: string | null;
  historyMessages: ChatDockMessage[];
  historyMode: "session" | "agent" | null;
  isHistoryDialogLoading: boolean;

  sendMessage: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  toggleDock: () => void;
  setDockExpanded: (expanded: boolean) => void;
  switchSession: (key: string) => void;
  newSession: () => void;
  loadSessions: () => Promise<void>;
  loadHistory: () => Promise<void>;
  initializeHistory: () => Promise<void>;
  clearCurrentMessages: () => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;
  openSessionHistory: (sessionKey?: string) => Promise<void>;
  openAgentHistory: (agentId: string) => Promise<void>;
  closeHistoryDialog: () => void;
  setDraftInput: (value: string) => void;
  addPendingAttachments: (attachments: ChatAttachment[]) => void;
  removePendingAttachment: (attachmentId: string) => void;
  clearPendingAttachments: () => void;
  setTargetAgent: (agentId: string) => void;
  handleChatEvent: (event: Record<string, unknown>, frameSessionKey?: string) => void;
  clearError: () => void;
  setError: (value: string | null) => void;
  initEventListeners: (
    wsClient: {
      onEvent: (name: string, handler: (frame: GatewayEventFrame) => void) => () => void;
    } | null,
  ) => () => void;
}

function buildSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

function buildFreshSessionKey(agentId: string): string {
  return `agent:${agentId}:session-${Date.now()}`;
}

const MAIN_AUTOMATION_TEAM_AGENT_IDS = new Set([
  "main",
  "architect",
  "backend",
  "frontend",
  "qa",
  "devops",
]);

function isStableMainAgent(agentId: string): boolean {
  const agent = useOfficeStore.getState().agents.get(agentId);
  return Boolean(agent && agent.confirmed && !agent.isPlaceholder && !agent.isSubAgent);
}

function getMentionableAgents(): MentionableAgent[] {
  return Array.from(useOfficeStore.getState().agents.values())
    .filter((agent) => agent.confirmed && !agent.isPlaceholder && !agent.isSubAgent)
    .map((agent) => ({ id: agent.id, name: agent.name }));
}

function getAgentLabel(agentId: string | null | undefined): string | null {
  if (!agentId) {
    return null;
  }

  return useOfficeStore.getState().agents.get(agentId)?.name ?? agentId;
}

function getFallbackTargetAgentId(): string | null {
  const candidates = Array.from(useOfficeStore.getState().agents.values()).filter(
    (agent) => agent.confirmed && !agent.isPlaceholder && !agent.isSubAgent,
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.find((agent) => agent.id === "main")?.id ?? candidates[0].id;
}

function resolveTargetAgentId(agentId: string): string | null {
  if (isGroupTargetAgentId(agentId)) {
    return GROUP_CHAT_TARGET_ID;
  }
  if (isStableMainAgent(agentId)) {
    return agentId;
  }
  return getFallbackTargetAgentId();
}

function pickLatestAgentSessionKey(agentId: string, sessions: SessionInfo[]): string {
  const prefix = `agent:${agentId}:`;
  const matched = sessions
    .filter((session) => session.key.startsWith(prefix))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return matched[0]?.key ?? buildSessionKey(agentId);
}

function withSourceSessionKey(messages: ChatDockMessage[], sessionKey: string): ChatDockMessage[] {
  return messages.map((message) => ({
    ...message,
    sourceSessionKey: message.sourceSessionKey ?? sessionKey,
  }));
}

function sortMessagesByTimestamp(messages: ChatDockMessage[]): ChatDockMessage[] {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp);
}

function mergeMessagesWithCached(
  primaryMessages: ChatDockMessage[],
  cachedMessages: ChatDockMessage[],
): ChatDockMessage[] {
  const cachedById = new Map(cachedMessages.map((message) => [message.id, message]));
  const mergedPrimary = primaryMessages.map((message) => {
    const cached = cachedById.get(message.id);
    if (!cached) {
      return message;
    }

    return {
      ...message,
      attachments: message.attachments ?? cached.attachments,
      sourceSessionKey: message.sourceSessionKey ?? cached.sourceSessionKey,
    };
  });
  const primaryIds = new Set(primaryMessages.map((message) => message.id));
  const extras = cachedMessages.filter((message) => !primaryIds.has(message.id));
  return sortMessagesByTimestamp([...mergedPrimary, ...extras]);
}

function getSessionDisplayName(sessionKey: string, sessions: SessionInfo[]): string {
  const groupLabel = i18n.t("chat:agentSelector.mainGroupLabel");
  const session = sessions.find((item) => item.key === sessionKey);
  return session?.label?.trim() || formatSessionName(sessionKey, groupLabel);
}

function getTargetAgentIdForSessionKey(sessionKey: string): string | null {
  if (isGroupSessionKey(sessionKey)) {
    return GROUP_CHAT_TARGET_ID;
  }

  const agentId = extractAgentIdFromSessionKey(sessionKey);
  return agentId && isStableMainAgent(agentId) ? agentId : null;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type?: string; text?: string }>)
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!)
      .join("\n");
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toChatDockMessages(rawMessages: Array<Record<string, unknown> | { id: string; role: string; content: string; timestamp: number }>): ChatDockMessage[] {
  return rawMessages.flatMap((message) => {
    const role = message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : null;
    if (!role) {
      return [];
    }

    const content = typeof message.content === "string" ? message.content : extractText(message.content);
    const attachments = Array.isArray((message as { attachments?: unknown }).attachments)
      ? ((message as { attachments?: ChatAttachment[] }).attachments as ChatAttachment[])
      : undefined;

    if (role === "assistant" && !content.trim() && (!attachments || attachments.length === 0)) {
      return [];
    }

    return [{
      id: String(message.id ?? generateMessageId()),
      role,
      content,
      timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
      attachments,
    }];
  });
}

function getMessageIdentityKey(message: ChatDockMessage): string {
  return `${message.sourceSessionKey ?? ""}::${message.id}`;
}

function mergeConversationMessages(
  currentMessages: ChatDockMessage[],
  incomingMessages: ChatDockMessage[],
): ChatDockMessage[] {
  const merged = new Map<string, ChatDockMessage>();

  for (const message of currentMessages) {
    merged.set(getMessageIdentityKey(message), message);
  }

  for (const message of incomingMessages) {
    merged.set(getMessageIdentityKey(message), message);
  }

  return sortMessagesByTimestamp(Array.from(merged.values()));
}

function haveConversationMessagesChanged(
  previousMessages: ChatDockMessage[],
  nextMessages: ChatDockMessage[],
): boolean {
  if (previousMessages.length !== nextMessages.length) {
    return true;
  }

  for (let index = 0; index < previousMessages.length; index += 1) {
    const previous = previousMessages[index];
    const next = nextMessages[index];

    if (
      getMessageIdentityKey(previous) !== getMessageIdentityKey(next) ||
      previous.content !== next.content ||
      previous.timestamp !== next.timestamp ||
      previous.senderLabel !== next.senderLabel ||
      previous.senderAgentId !== next.senderAgentId
    ) {
      return true;
    }
  }

  return false;
}

function getNewConversationMessages(
  previousMessages: ChatDockMessage[],
  nextMessages: ChatDockMessage[],
): ChatDockMessage[] {
  const previousKeys = new Set(previousMessages.map(getMessageIdentityKey));
  return nextMessages.filter((message) => !previousKeys.has(getMessageIdentityKey(message)));
}

function annotateRelatedSessionMessages(
  messages: ChatDockMessage[],
  sourceSessionKey: string,
): ChatDockMessage[] {
  const senderAgentId = extractAgentIdFromSessionKey(sourceSessionKey);
  const senderLabel = getAgentLabel(senderAgentId);

  return messages
    .filter((message) => message.role === "assistant")
    .map((message) => ({
      ...message,
      senderAgentId: senderAgentId ?? undefined,
      senderLabel: senderLabel ?? senderAgentId ?? undefined,
      sourceSessionKey,
    }));
}

function getLatestAssistantMessageForSession(
  messages: ChatDockMessage[],
  sessionKey: string,
): ChatDockMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && message.sourceSessionKey === sessionKey) {
      return message;
    }
  }

  return null;
}

type ChatDockStateSetter = (
  partial:
    | Partial<ChatDockState>
    | ((state: ChatDockState) => Partial<ChatDockState>),
) => void;

async function syncSessionHistoryIntoCurrentConversation({
  currentSessionKey,
  sourceSessionKey,
  getState,
  setState,
  attempt = 0,
}: {
  currentSessionKey: string;
  sourceSessionKey: string;
  getState: () => ChatDockState;
  setState: ChatDockStateSetter;
  attempt?: number;
}): Promise<ChatDockMessage | null> {
  const sourceMessages = await loadSessionHistoryMessages(sourceSessionKey);
  const normalizedMessages = sourceSessionKey === currentSessionKey
    ? sourceMessages
    : annotateRelatedSessionMessages(sourceMessages, sourceSessionKey);

  const stateBeforeMerge = getState();
  if (stateBeforeMerge.currentSessionKey !== currentSessionKey) {
    return null;
  }

  const mergedMessages = mergeConversationMessages(stateBeforeMerge.messages, normalizedMessages);
  const newMessages = getNewConversationMessages(stateBeforeMerge.messages, mergedMessages);
  const latestAssistantMessage = getLatestAssistantMessageForSession(newMessages, sourceSessionKey);

  if (haveConversationMessagesChanged(stateBeforeMerge.messages, mergedMessages)) {
    setState({ messages: mergedMessages });
  }

  if (sourceSessionKey === currentSessionKey) {
    localPersistence.saveMessages(currentSessionKey, mergedMessages).catch(() => {});
  } else {
    for (const message of newMessages) {
      localPersistence.saveMessage(currentSessionKey, message).catch(() => {});
    }
  }

  if (!latestAssistantMessage && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    return syncSessionHistoryIntoCurrentConversation({
      currentSessionKey,
      sourceSessionKey,
      getState,
      setState,
      attempt: attempt + 1,
    });
  }

  return latestAssistantMessage;
}

function maybeContinueMainAutomationFromMessage(
  assistantMsg: ChatDockMessage,
  automationSessionKey: string,
  currentSessionKey: string,
  getState: () => ChatDockState,
  setState: ChatDockStateSetter,
): void {
  const autoContinueCount = getState().autoContinueSessions[automationSessionKey];
  const isDirectMainAutomation =
    !isGroupSessionKey(currentSessionKey) &&
    extractAgentIdFromSessionKey(automationSessionKey) === "main" &&
    typeof autoContinueCount === "number" &&
    useConsoleSettingsStore.getState().mainAutomationEnabled;

  if (!isDirectMainAutomation) {
    return;
  }

  const status = getMainAutomationStatus(assistantMsg.content);

  if (status === "complete" || autoContinueCount >= MAIN_AUTOMATION_MAX_AUTO_CONTINUES) {
    setState((state) => ({
      autoContinueSessions: omitSessionRecord(state.autoContinueSessions, automationSessionKey),
      ...(status !== "complete" && autoContinueCount >= MAIN_AUTOMATION_MAX_AUTO_CONTINUES
        ? { error: i18n.t("chat:dock.mainAutomationMaxRoundsReached") }
        : {}),
    }));
    return;
  }

  const continueMessage: ChatDockMessage = {
    id: generateMessageId(),
    role: "user",
    content: "[自动续跑] 继续推进上一轮剩余工作",
    timestamp: Date.now(),
  };

  setState((state) => ({
    messages:
      getState().currentSessionKey === automationSessionKey
        ? [...state.messages, continueMessage]
        : state.messages,
    isStreaming: true,
    pendingSessionKeys: [automationSessionKey],
    autoContinueSessions: {
      ...state.autoContinueSessions,
      [automationSessionKey]: autoContinueCount + 1,
    },
  }));

  localPersistence.saveMessage(automationSessionKey, continueMessage).catch(() => {});

  setTimeout(() => {
    try {
      const adapter = getAdapter();
      void adapter
        .chatSend({
          text: MAIN_AUTOMATION_CONTINUE_PROMPT,
          sessionKey: automationSessionKey,
        })
        .catch((error) => {
          setState((state) => ({
            error: error instanceof Error ? error.message : String(error),
            isStreaming: false,
            pendingSessionKeys: removePendingSession(state.pendingSessionKeys, automationSessionKey),
            autoContinueSessions: omitSessionRecord(state.autoContinueSessions, automationSessionKey),
          }));
        });
    } catch (error) {
      setState((state) => ({
        error: error instanceof Error ? error.message : String(error),
        isStreaming: false,
        pendingSessionKeys: removePendingSession(state.pendingSessionKeys, automationSessionKey),
        autoContinueSessions: omitSessionRecord(state.autoContinueSessions, automationSessionKey),
      }));
    }
  }, 0);
}

function isCurrentGroupRelaySession(currentSessionKey: string, payloadSessionKey: string): boolean {
  if (!isGroupSessionKey(currentSessionKey)) {
    return false;
  }

  const payloadAgentId = extractAgentIdFromSessionKey(payloadSessionKey);
  if (!payloadAgentId) {
    return false;
  }

  return payloadSessionKey === buildGroupRelaySessionKey(payloadAgentId, currentSessionKey);
}

function appendAssistantMessage(
  currentSessionKey: string,
  payloadSessionKey: string,
  message: Record<string, unknown>,
): ChatDockMessage | null {
  const text = extractText(message.content);
  if (!text) {
    return null;
  }

  const senderAgentId = extractAgentIdFromSessionKey(payloadSessionKey);
  const senderLabel = getAgentLabel(senderAgentId);
  const shouldAnnotateSender =
    isGroupSessionKey(currentSessionKey) ||
    Boolean(payloadSessionKey && payloadSessionKey !== currentSessionKey && senderAgentId);

  return {
    id: String(message.id ?? generateMessageId()),
    role: "assistant",
    content: text,
    timestamp: Date.now(),
    senderAgentId: shouldAnnotateSender ? (senderAgentId ?? undefined) : undefined,
    senderLabel: shouldAnnotateSender ? (senderLabel ?? undefined) : undefined,
    sourceSessionKey: payloadSessionKey || undefined,
  };
}

function removePendingSession(pendingSessionKeys: string[], sessionKey: string): string[] {
  return pendingSessionKeys.filter((key) => key !== sessionKey);
}

function omitSessionRecord(record: Record<string, number>, sessionKey: string): Record<string, number> {
  if (!(sessionKey in record)) {
    return record;
  }

  const nextRecord = { ...record };
  delete nextRecord[sessionKey];
  return nextRecord;
}

function isRelatedMainAutomationSession(
  currentState: Pick<ChatDockState, "currentSessionKey" | "autoContinueSessions" | "isStreaming">,
  payloadSessionKey: string,
): boolean {
  if (!payloadSessionKey || isGroupSessionKey(currentState.currentSessionKey)) {
    return false;
  }

  const currentAgentId = extractAgentIdFromSessionKey(currentState.currentSessionKey);
  const payloadAgentId = extractAgentIdFromSessionKey(payloadSessionKey);

  if (currentAgentId !== "main" || !payloadAgentId || payloadSessionKey === currentState.currentSessionKey) {
    return false;
  }

  return (
    MAIN_AUTOMATION_TEAM_AGENT_IDS.has(payloadAgentId) &&
    (typeof currentState.autoContinueSessions[currentState.currentSessionKey] === "number" ||
      currentState.isStreaming)
  );
}

async function loadCachedMessages(currentSessionKey: string): Promise<ChatDockMessage[]> {
  try {
    return await localPersistence.getMessages(currentSessionKey);
  } catch {
    return [];
  }
}

async function loadSessionHistoryMessages(sessionKey: string): Promise<ChatDockMessage[]> {
  if (isGroupSessionKey(sessionKey)) {
    const cached = await loadCachedMessages(sessionKey);
    return sortMessagesByTimestamp(withSourceSessionKey(cached, sessionKey));
  }

  try {
    const adapter = getAdapter();
    const rawMessages = await adapter.chatHistory(sessionKey);
    const remoteMessages = withSourceSessionKey(
      toChatDockMessages(rawMessages as unknown as Array<Record<string, unknown>>),
      sessionKey,
    );
    const cachedMessages = await loadCachedMessages(sessionKey);
    const messages = mergeMessagesWithCached(remoteMessages, cachedMessages);
    localPersistence.saveMessages(sessionKey, messages).catch(() => {});
    return messages;
  } catch {
    const cached = await loadCachedMessages(sessionKey);
    return sortMessagesByTimestamp(withSourceSessionKey(cached, sessionKey));
  }
}

// Ensure IndexedDB is opened at module load (non-blocking)
localPersistence.open().catch(() => {});

export const useChatDockStore = create<ChatDockState>((set, get) => ({
  messages: [],
  draftInput: "",
  pendingAttachments: [],
  isStreaming: false,
  currentSessionKey: "agent:main:main",
  dockExpanded: false,
  targetAgentId: null,
  sessions: [],
  isSessionsLoading: false,
  error: null,
  activeRunId: null,
  streamingMessage: null,
  pendingSessionKeys: [],
  runIdSessionKeys: {},
  streamBuffers: {},
  autoContinueSessions: {},
  isHistoryLoaded: false,
  isHistoryLoading: false,
  historyDialogOpen: false,
  historyDialogTitle: null,
  historyDialogSubtitle: null,
  historyMessages: [],
  historyMode: null,
  isHistoryDialogLoading: false,

  sendMessage: async (text) => {
    const trimmed = text.trim();
    const { currentSessionKey, pendingAttachments, targetAgentId } = get();
    if (!trimmed && pendingAttachments.length === 0) return;

    if (useOfficeStore.getState().connectionStatus !== "connected") {
      set({
        error: i18n.t("chat:dock.sendConnectionRequired"),
        isStreaming: false,
        pendingSessionKeys: [],
        streamingMessage: null,
        runIdSessionKeys: {},
        streamBuffers: {},
      });
      return;
    }

    let adapter: GatewayAdapter;
    try {
      adapter = getAdapter();
    } catch (initErr) {
      console.error("[ChatDock] Adapter not initialized:", initErr);
      set({ error: i18n.t("common:errors.adapterNotInitialized"), isStreaming: false });
      return;
    }

    const userMsg: ChatDockMessage = {
      id: generateMessageId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
    };

    if (isGroupSessionKey(currentSessionKey)) {
      const mentionableAgents = getMentionableAgents();
      const { agentIds, cleanedText } = parseGroupMentions(trimmed, mentionableAgents);

      if (agentIds.length === 0) {
        set({
          error: i18n.t("chat:dock.groupMentionRequired"),
          isStreaming: false,
          streamingMessage: null,
          runIdSessionKeys: {},
          streamBuffers: {},
        });
        return;
      }

      const relayBaseText = cleanedText.trim() || trimmed;
      const targetSessionKeys = agentIds.map((agentId) =>
        buildGroupRelaySessionKey(agentId, currentSessionKey),
      );
      const transportAttachments = buildTransportAttachments(pendingAttachments);
      const { mainAutomationEnabled, agentPaths } = useConsoleSettingsStore.getState();
      const relayTexts = agentIds.map((agentId) => {
        const preparedMessage = agentId === "main"
          ? prepareMainAutomationMessage(relayBaseText, {
              enabled: mainAutomationEnabled,
              hostLabel: agentPaths.hostLabel,
              codeOutputDirectory: agentPaths.codeOutputDirectory,
              resourceOutputDirectory: agentPaths.resourceOutputDirectory,
            })
          : { text: relayBaseText, automated: false };

        return buildOutboundChatMessage(preparedMessage.text, pendingAttachments);
      });

      set((state) => ({
        messages: [...state.messages, userMsg],
        pendingAttachments: [],
        isStreaming: true,
        dockExpanded: true,
        error: null,
        streamingMessage: null,
        pendingSessionKeys: targetSessionKeys,
      }));

      localPersistence.saveMessage(currentSessionKey, userMsg).catch(() => {});

      const sendResults = await Promise.allSettled(
        agentIds.map((_agentId, index) =>
          adapter.chatSend({
            text: relayTexts[index],
            sessionKey: targetSessionKeys[index],
            attachments: transportAttachments,
          }),
        ),
      );

      const failedAgentLabels = sendResults.flatMap((result, index) =>
        result.status === "rejected" ? [getAgentLabel(agentIds[index]) ?? agentIds[index]] : [],
      );

      const succeededSessionKeys = targetSessionKeys.filter(
        (_sessionKey, index) => sendResults[index]?.status === "fulfilled",
      );

      if (failedAgentLabels.length > 0) {
        set({
          error: i18n.t("chat:dock.groupDispatchPartialError", {
            agents: failedAgentLabels.join(", "),
          }),
          pendingSessionKeys: succeededSessionKeys,
          isStreaming: succeededSessionKeys.length > 0,
          streamingMessage: null,
          runIdSessionKeys: {},
          streamBuffers: {},
        });
      }

      if (succeededSessionKeys.length === 0) {
        set({
          isStreaming: false,
          streamingMessage: null,
          runIdSessionKeys: {},
          streamBuffers: {},
        });
      }

      return;
    }

    const { mainAutomationEnabled, agentPaths } = useConsoleSettingsStore.getState();
    const resolvedTargetAgentId = targetAgentId ?? extractAgentIdFromSessionKey(currentSessionKey);
    const preparedMessage = resolvedTargetAgentId === "main"
      ? prepareMainAutomationMessage(trimmed, {
          enabled: mainAutomationEnabled,
          hostLabel: agentPaths.hostLabel,
          codeOutputDirectory: agentPaths.codeOutputDirectory,
          resourceOutputDirectory: agentPaths.resourceOutputDirectory,
        })
      : { text: trimmed, automated: false };
    const outboundText = buildOutboundChatMessage(preparedMessage.text, pendingAttachments);
    const transportAttachments = buildTransportAttachments(pendingAttachments);

    set((state) => ({
      messages: [...state.messages, userMsg],
      pendingAttachments: [],
      isStreaming: true,
      dockExpanded: true,
      error: null,
      streamingMessage: null,
      pendingSessionKeys: [currentSessionKey],
      autoContinueSessions: preparedMessage.automated
        ? { ...state.autoContinueSessions, [currentSessionKey]: 0 }
        : omitSessionRecord(state.autoContinueSessions, currentSessionKey),
    }));

    localPersistence.saveMessage(currentSessionKey, userMsg).catch(() => {});

    try {
      console.log("[ChatDock] Sending chat.send:", {
        text: outboundText,
        sessionKey: currentSessionKey,
      });
      await adapter.chatSend({
        text: outboundText,
        sessionKey: currentSessionKey,
        attachments: transportAttachments,
      });
      console.log("[ChatDock] chat.send completed");
      void get().loadSessions();
    } catch (err) {
      console.error("[ChatDock] chat.send error:", err);
      if (err instanceof RpcError && err.code === "NOT_CONNECTED") {
        set({
          error: i18n.t("chat:dock.sendConnectionRequired"),
          isStreaming: false,
          pendingSessionKeys: [],
          runIdSessionKeys: {},
          streamBuffers: {},
          streamingMessage: null,
          autoContinueSessions: omitSessionRecord(get().autoContinueSessions, currentSessionKey),
        });
        return;
      }
      set({
        error: String(err),
        isStreaming: false,
        pendingSessionKeys: [],
        runIdSessionKeys: {},
        streamBuffers: {},
        autoContinueSessions: omitSessionRecord(get().autoContinueSessions, currentSessionKey),
      });
    }
  },

  abort: async () => {
    const { currentSessionKey, pendingSessionKeys } = get();
    const sessionsToAbort =
      isGroupSessionKey(currentSessionKey) && pendingSessionKeys.length > 0
        ? pendingSessionKeys
        : [currentSessionKey];

    set({
      isStreaming: false,
      streamingMessage: null,
      pendingSessionKeys: [],
      runIdSessionKeys: {},
      streamBuffers: {},
      autoContinueSessions: omitSessionRecord(get().autoContinueSessions, currentSessionKey),
    });

    try {
      const adapter = getAdapter();
      await Promise.allSettled(sessionsToAbort.map((sessionKey) => adapter.chatAbort(sessionKey)));
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
    set({
      currentSessionKey: key,
      targetAgentId: getTargetAgentIdForSessionKey(key),
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      pendingSessionKeys: [],
      runIdSessionKeys: {},
      streamBuffers: {},
      isHistoryLoaded: false,
    });
    get().initializeHistory();
  },

  newSession: () => {
    const { targetAgentId } = get();

    if (isGroupTargetAgentId(targetAgentId)) {
      set({
        currentSessionKey: GROUP_CHAT_SESSION_KEY,
        messages: [],
        streamingMessage: null,
        activeRunId: null,
        error: null,
        isStreaming: false,
        pendingSessionKeys: [],
        runIdSessionKeys: {},
        streamBuffers: {},
        isHistoryLoaded: false,
      });
      get().initializeHistory();
      void get().loadSessions();
      return;
    }

    const agentId = targetAgentId ?? "main";
    const newKey = buildFreshSessionKey(agentId);
    set({
      currentSessionKey: newKey,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      pendingSessionKeys: [],
      runIdSessionKeys: {},
      streamBuffers: {},
      isHistoryLoaded: false,
    });
    void get().loadSessions();
  },

  loadSessions: async () => {
    set({ isSessionsLoading: true });
    try {
      const adapter = getAdapter();
      const result = await adapter.sessionsList();
      const sessions = Array.isArray(result) ? result : [];
      set({ sessions, isSessionsLoading: false });

      const { targetAgentId, currentSessionKey } = get();
      if (targetAgentId && isStableMainAgent(targetAgentId)) {
        const preferredSessionKey = pickLatestAgentSessionKey(targetAgentId, sessions);
        if (preferredSessionKey !== currentSessionKey) {
          set({
            currentSessionKey: preferredSessionKey,
            messages: [],
            streamingMessage: null,
            activeRunId: null,
            error: null,
            isStreaming: false,
            pendingSessionKeys: [],
            runIdSessionKeys: {},
            streamBuffers: {},
            isHistoryLoaded: false,
          });
          get().initializeHistory();
        }
      }
    } catch {
      // Sessions are non-critical.
      set({ isSessionsLoading: false });
    }
  },

  loadHistory: async () => {
    const { currentSessionKey } = get();
    const requestSessionKey = currentSessionKey;

    if (isGroupSessionKey(requestSessionKey)) {
      const cached = await loadCachedMessages(requestSessionKey);
      if (get().currentSessionKey !== requestSessionKey) {
        return;
      }
      set({ messages: cached });
      return;
    }

    try {
      const adapter = getAdapter();
      const rawMessages = await adapter.chatHistory(requestSessionKey);
      const remoteMessages = toChatDockMessages(rawMessages as unknown as Array<Record<string, unknown>>);
      const cachedMessages = await loadCachedMessages(requestSessionKey);
      const messages = mergeMessagesWithCached(remoteMessages, cachedMessages);
      if (get().currentSessionKey !== requestSessionKey) {
        return;
      }
      set({ messages });
      localPersistence.saveMessages(requestSessionKey, messages).catch(() => {});
    } catch {
      if (get().currentSessionKey !== requestSessionKey) {
        return;
      }
      set({ messages: [] });
    }
  },

  initializeHistory: async () => {
    const { currentSessionKey } = get();
    const requestSessionKey = currentSessionKey;
    set({ isHistoryLoading: true });

    if (isGroupSessionKey(requestSessionKey)) {
      const cached = await loadCachedMessages(requestSessionKey);
      if (get().currentSessionKey !== requestSessionKey) {
        return;
      }
      set({ messages: cached, isHistoryLoaded: true, isHistoryLoading: false });
      return;
    }

    try {
      const adapter = getAdapter();
      const rawMessages = await adapter.chatHistory(requestSessionKey);
      const remoteMessages = toChatDockMessages(rawMessages as unknown as Array<Record<string, unknown>>);
      const cachedMessages = await loadCachedMessages(requestSessionKey);
      const messages = mergeMessagesWithCached(remoteMessages, cachedMessages);
      if (get().currentSessionKey !== requestSessionKey) {
        return;
      }
      set({ messages, isHistoryLoaded: true, isHistoryLoading: false });
      localPersistence.saveMessages(requestSessionKey, messages).catch(() => {});
    } catch {
      const cached = await loadCachedMessages(requestSessionKey);
      if (get().currentSessionKey !== requestSessionKey) {
        return;
      }
      set({ messages: cached, isHistoryLoaded: true, isHistoryLoading: false });
    }
  },

  clearCurrentMessages: async () => {
    if (get().isStreaming) {
      await get().abort();
    }

    set({
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      pendingSessionKeys: [],
      runIdSessionKeys: {},
      streamBuffers: {},
    });
  },

  deleteSession: async (sessionKey) => {
    const { currentSessionKey, sessions, targetAgentId } = get();

    if (isGroupSessionKey(sessionKey)) {
      await localPersistence.clearMessages(sessionKey);

      if (currentSessionKey === sessionKey) {
        set({
          messages: [],
          streamingMessage: null,
          activeRunId: null,
          error: null,
          isStreaming: false,
          pendingSessionKeys: [],
          runIdSessionKeys: {},
          streamBuffers: {},
          isHistoryLoaded: true,
        });
      }
      return;
    }

    if (useOfficeStore.getState().connectionStatus !== "connected") {
      set({ error: i18n.t("chat:sessionSwitcher.deleteSessionConnectionRequired") });
      return;
    }

    try {
      if (currentSessionKey === sessionKey && get().isStreaming) {
        await get().abort();
      }

      const adapter = getAdapter();
      await adapter.sessionsDelete(sessionKey, { deleteTranscript: true });
      await localPersistence.clearMessages(sessionKey);

      const nextSessions = sessions.filter((session) => session.key !== sessionKey);

      if (currentSessionKey !== sessionKey) {
        set({ sessions: nextSessions });
        return;
      }

      const nextTargetAgentId =
        getTargetAgentIdForSessionKey(sessionKey) ?? targetAgentId ?? getFallbackTargetAgentId();
      const nextSessionKey =
        nextTargetAgentId && !isGroupTargetAgentId(nextTargetAgentId)
          ? pickLatestAgentSessionKey(nextTargetAgentId, nextSessions)
          : GROUP_CHAT_SESSION_KEY;

      set({
        sessions: nextSessions,
        currentSessionKey: nextSessionKey,
        targetAgentId: nextTargetAgentId,
        messages: [],
        streamingMessage: null,
        activeRunId: null,
        error: null,
        isStreaming: false,
        pendingSessionKeys: [],
        runIdSessionKeys: {},
        streamBuffers: {},
        isHistoryLoaded: false,
        isHistoryLoading: false,
      });

      await get().initializeHistory();
    } catch (err) {
      if (err instanceof RpcError && err.code === "NOT_CONNECTED") {
        set({ error: i18n.t("chat:sessionSwitcher.deleteSessionConnectionRequired") });
        return;
      }

      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  openSessionHistory: async (sessionKey) => {
    const resolvedSessionKey = sessionKey ?? get().currentSessionKey;

    set({
      historyDialogOpen: true,
      historyMode: "session",
      historyDialogTitle: i18n.t("chat:history.sessionTitle", {
        session: getSessionDisplayName(resolvedSessionKey, get().sessions),
      }),
      historyDialogSubtitle: resolvedSessionKey,
      historyMessages: [],
      isHistoryDialogLoading: true,
    });

    const messages = await loadSessionHistoryMessages(resolvedSessionKey);

    set({
      historyMessages: messages,
      isHistoryDialogLoading: false,
    });
  },

  openAgentHistory: async (agentId) => {
    const agentLabel = getAgentLabel(agentId) ?? agentId;

    set({
      historyDialogOpen: true,
      historyMode: "agent",
      historyDialogTitle: i18n.t("chat:history.agentTitle", { agent: agentLabel }),
      historyDialogSubtitle: i18n.t("chat:history.agentSubtitle", { agentId }),
      historyMessages: [],
      isHistoryDialogLoading: true,
    });

    let latestSessions = get().sessions;

    try {
      const adapter = getAdapter();
      const result = await adapter.sessionsList();
      latestSessions = Array.isArray(result) ? result : [];
      set({ sessions: latestSessions });
    } catch {
      // Fall back to the locally cached session list.
    }

    const currentSessionKey = get().currentSessionKey;
    const sessionKeys = Array.from(
      new Set(
        [
          buildSessionKey(agentId),
          ...latestSessions
            .filter((session) => extractAgentIdFromSessionKey(session.key) === agentId)
            .map((session) => session.key),
          extractAgentIdFromSessionKey(currentSessionKey) === agentId ? currentSessionKey : null,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    const historyBatches = await Promise.all(
      sessionKeys.map(async (key) => {
        const messages = await loadSessionHistoryMessages(key);
        return messages
          .filter((message) => message.role === "assistant")
          .map((message) => ({
            ...message,
            senderAgentId: agentId,
            senderLabel: agentLabel,
            sourceSessionKey: message.sourceSessionKey ?? key,
          }));
      }),
    );

    set({
      historyMessages: sortMessagesByTimestamp(historyBatches.flat()),
      isHistoryDialogLoading: false,
    });
  },

  closeHistoryDialog: () =>
    set({
      historyDialogOpen: false,
      historyDialogTitle: null,
      historyDialogSubtitle: null,
      historyMessages: [],
      historyMode: null,
      isHistoryDialogLoading: false,
    }),

  setDraftInput: (value) => {
    set({ draftInput: value });
  },

  addPendingAttachments: (attachments) => {
    if (attachments.length === 0) {
      return;
    }

    set((state) => ({
      pendingAttachments: [...state.pendingAttachments, ...attachments],
      error: null,
    }));
  },

  removePendingAttachment: (attachmentId) => {
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  },

  clearPendingAttachments: () => {
    set({ pendingAttachments: [] });
  },

  setTargetAgent: (agentId) => {
    const resolvedAgentId = resolveTargetAgentId(agentId);
    if (!resolvedAgentId) {
      return;
    }

    const sessionKey = isGroupTargetAgentId(resolvedAgentId)
      ? GROUP_CHAT_SESSION_KEY
      : pickLatestAgentSessionKey(resolvedAgentId, get().sessions);

    set({
      targetAgentId: resolvedAgentId,
      currentSessionKey: sessionKey,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      pendingSessionKeys: [],
      runIdSessionKeys: {},
      streamBuffers: {},
      isHistoryLoaded: false,
    });
    get().initializeHistory();
    void get().loadSessions();
  },

  handleChatEvent: (event, frameSessionKey) => {
    const currentState = get();
    const currentSessionKey = currentState.currentSessionKey;
    const eventType = typeof event.type === "string" ? event.type : "";
    const runId = typeof event.runId === "string" ? event.runId : "";
    const fallbackSessionKey =
      !isGroupSessionKey(currentSessionKey) && currentState.pendingSessionKeys.length === 1
        ? currentState.pendingSessionKeys[0]
        : "";
    const payloadSessionKey = String(
      event.sessionKey ||
        frameSessionKey ||
        (runId ? currentState.runIdSessionKeys[runId] : "") ||
        fallbackSessionKey ||
        "",
    );
    const allowRelatedMainAutomationEvent = isRelatedMainAutomationSession(
      currentState,
      payloadSessionKey,
    );

    if (isGroupSessionKey(currentSessionKey)) {
      if (!isCurrentGroupRelaySession(currentSessionKey, payloadSessionKey)) {
        return;
      }
    } else if (payloadSessionKey && payloadSessionKey !== currentSessionKey && !allowRelatedMainAutomationEvent) {
      return;
    }

    const eventState = typeof event.state === "string" ? event.state : "";
    const message = isRecord(event.message) ? event.message : undefined;
    const deltaText = typeof event.text === "string" ? event.text : "";

    let resolvedState = eventState;
    if (!resolvedState && eventType) {
      if (eventType === "stream.start") {
        resolvedState = "start";
      } else if (eventType === "stream.delta") {
        resolvedState = "delta";
      } else if (eventType === "stream.end") {
        resolvedState = event.aborted ? "aborted" : "final";
      }
    }
    if (!resolvedState && message) {
      const stopReason =
        message.stopReason ??
        message.stop_reason;
      if (stopReason) {
        resolvedState = "final";
      } else if (message.role || message.content) {
        resolvedState = "delta";
      }
    }

    switch (resolvedState) {
      case "start": {
        set((state) => ({
          activeRunId: runId || state.activeRunId,
          isStreaming: true,
          runIdSessionKeys:
            runId && payloadSessionKey
              ? { ...state.runIdSessionKeys, [runId]: payloadSessionKey }
              : state.runIdSessionKeys,
        }));
        break;
      }
      case "delta": {
        const bufferedText =
          runId && deltaText
            ? `${currentState.streamBuffers[runId] ?? ""}${deltaText}`
            : deltaText;
        const nextStreamingMessage =
          message ??
          (bufferedText
            ? {
                role: "assistant",
                content: bufferedText,
              }
            : null);

        set((state) => ({
          activeRunId: runId || state.activeRunId,
          streamingMessage: isGroupSessionKey(currentSessionKey) ? null : nextStreamingMessage,
          isStreaming: true,
          runIdSessionKeys:
            runId && payloadSessionKey
              ? { ...state.runIdSessionKeys, [runId]: payloadSessionKey }
              : state.runIdSessionKeys,
          streamBuffers:
            runId && bufferedText
              ? { ...state.streamBuffers, [runId]: bufferedText }
              : state.streamBuffers,
        }));
        break;
      }
      case "final": {
        const bufferedText = runId ? currentState.streamBuffers[runId] ?? "" : "";
        const assistantMsg = message
          ? appendAssistantMessage(currentSessionKey, payloadSessionKey, message)
          : bufferedText
            ? appendAssistantMessage(currentSessionKey, payloadSessionKey, {
                id: generateMessageId(),
                role: "assistant",
                content: bufferedText,
              })
          : null;

        set((state) => {
          const remainingPendingSessionKeys = payloadSessionKey
            ? removePendingSession(state.pendingSessionKeys, payloadSessionKey)
            : state.pendingSessionKeys;
          const nextRunIdSessionKeys = { ...state.runIdSessionKeys };
          const nextStreamBuffers = { ...state.streamBuffers };

          if (runId) {
            delete nextRunIdSessionKeys[runId];
            delete nextStreamBuffers[runId];
          }

          return {
            messages: assistantMsg ? [...state.messages, assistantMsg] : state.messages,
            isStreaming: remainingPendingSessionKeys.length > 0,
            streamingMessage: null,
            activeRunId:
              remainingPendingSessionKeys.length > 0 && state.activeRunId !== runId
                ? state.activeRunId
                : null,
            pendingSessionKeys: remainingPendingSessionKeys,
            runIdSessionKeys: nextRunIdSessionKeys,
            streamBuffers: nextStreamBuffers,
          };
        });

        if (assistantMsg) {
          localPersistence.saveMessage(currentSessionKey, assistantMsg).catch(() => {});
          const automationSessionKey = payloadSessionKey || currentSessionKey;
          maybeContinueMainAutomationFromMessage(
            assistantMsg,
            automationSessionKey,
            currentSessionKey,
            get,
            set,
          );
        } else if (!isGroupSessionKey(currentSessionKey)) {
          const historySessionKey = payloadSessionKey || currentSessionKey;
          void syncSessionHistoryIntoCurrentConversation({
            currentSessionKey,
            sourceSessionKey: historySessionKey,
            getState: get,
            setState: set,
          }).then((syncedAssistantMsg) => {
            if (!syncedAssistantMsg) {
              return;
            }

            maybeContinueMainAutomationFromMessage(
              syncedAssistantMsg,
              historySessionKey,
              currentSessionKey,
              get,
              set,
            );
          });
        }
        void get().loadSessions();
        break;
      }
      case "error": {
        const remainingPendingSessionKeys = payloadSessionKey
          ? removePendingSession(get().pendingSessionKeys, payloadSessionKey)
          : [];
        const senderAgentId = extractAgentIdFromSessionKey(payloadSessionKey);
        const errorPrefix =
          (isGroupSessionKey(currentSessionKey) || allowRelatedMainAutomationEvent) && senderAgentId
            ? `${getAgentLabel(senderAgentId) ?? senderAgentId}: `
            : "";
        const errorMsg = String(event.errorMessage || i18n.t("common:errors.errorOccurred"));
        const nextRunIdSessionKeys = { ...get().runIdSessionKeys };
        const nextStreamBuffers = { ...get().streamBuffers };
        if (runId) {
          delete nextRunIdSessionKeys[runId];
          delete nextStreamBuffers[runId];
        }
        set({
          error: `${errorPrefix}${errorMsg}`,
          isStreaming: remainingPendingSessionKeys.length > 0,
          streamingMessage: null,
          activeRunId:
            remainingPendingSessionKeys.length > 0 && get().activeRunId !== runId
              ? get().activeRunId
              : null,
          pendingSessionKeys: remainingPendingSessionKeys,
          runIdSessionKeys: nextRunIdSessionKeys,
          streamBuffers: nextStreamBuffers,
          autoContinueSessions: payloadSessionKey
            ? omitSessionRecord(get().autoContinueSessions, payloadSessionKey)
            : get().autoContinueSessions,
        });
        break;
      }
      case "aborted": {
        const remainingPendingSessionKeys = payloadSessionKey
          ? removePendingSession(get().pendingSessionKeys, payloadSessionKey)
          : [];
        const nextRunIdSessionKeys = { ...get().runIdSessionKeys };
        const nextStreamBuffers = { ...get().streamBuffers };
        if (runId) {
          delete nextRunIdSessionKeys[runId];
          delete nextStreamBuffers[runId];
        }
        set({
          isStreaming: remainingPendingSessionKeys.length > 0,
          streamingMessage: null,
          activeRunId:
            remainingPendingSessionKeys.length > 0 && get().activeRunId !== runId
              ? get().activeRunId
              : null,
          pendingSessionKeys: remainingPendingSessionKeys,
          runIdSessionKeys: nextRunIdSessionKeys,
          streamBuffers: nextStreamBuffers,
        });
        break;
      }
      default: {
        if (!isGroupSessionKey(currentSessionKey) && get().isStreaming && message) {
          set({ streamingMessage: message });
        }
        break;
      }
    }
  },

  clearError: () => set({ error: null }),
  setError: (value) => set({ error: value }),

  initEventListeners: (wsClient) => {
    if (!wsClient) return () => {};

    const unsub = wsClient.onEvent("chat", (frame: GatewayEventFrame) => {
      const payload = frame.payload as Record<string, unknown>;
      const resolvedFrameSessionKey =
        isRecord(frame.payload) && typeof frame.payload.sessionKey === "string"
          ? frame.payload.sessionKey
          : undefined;
      get().handleChatEvent(payload, resolvedFrameSessionKey);
    });

    return unsub;
  },
}));
