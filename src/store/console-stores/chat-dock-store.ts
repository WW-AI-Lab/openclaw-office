import { create } from "zustand";
import type { GatewayAdapter } from "@/gateway/adapter";
import { getAdapter } from "@/gateway/adapter-provider";
import type { SessionInfo } from "@/gateway/adapter-types";
import type { GatewayEventFrame } from "@/gateway/types";
import i18n from "@/i18n";
import { localPersistence } from "@/lib/local-persistence";
import { generateMessageId } from "@/lib/message-utils";

export type MessageRole = "user" | "assistant";

export interface ChatDockMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatDockState {
  messages: ChatDockMessage[];
  isStreaming: boolean;
  currentSessionKey: string;
  dockExpanded: boolean;
  targetAgentId: string | null;
  sessions: SessionInfo[];
  error: string | null;
  activeRunId: string | null;
  streamingMessage: Record<string, unknown> | null;
  isHistoryLoaded: boolean;
  isHistoryLoading: boolean;

  sendMessage: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  toggleDock: () => void;
  setDockExpanded: (expanded: boolean) => void;
  switchSession: (key: string) => void;
  newSession: () => void;
  loadSessions: () => Promise<void>;
  loadHistory: () => Promise<void>;
  initializeHistory: () => Promise<void>;
  setTargetAgent: (agentId: string) => void;
  handleChatEvent: (event: Record<string, unknown>, frameSessionKey?: string) => void;
  clearError: () => void;
  initEventListeners: (
    wsClient: {
      onEvent: (name: string, handler: (frame: GatewayEventFrame) => void) => () => void;
    } | null,
  ) => () => void;
}

function buildSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

function pickLatestAgentSessionKey(agentId: string, sessions: SessionInfo[]): string {
  const prefix = `agent:${agentId}:`;
  const matched = sessions
    .filter((s) => s.key.startsWith(prefix))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return matched[0]?.key ?? buildSessionKey(agentId);
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type?: string; text?: string }>)
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!)
      .join("\n");
  }
  return "";
}

// Ensure IndexedDB is opened at module load (non-blocking)
localPersistence.open().catch(() => {});

export const useChatDockStore = create<ChatDockState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentSessionKey: "agent:main:main",
  dockExpanded: false,
  targetAgentId: null,
  sessions: [],
  error: null,
  activeRunId: null,
  streamingMessage: null,
  isHistoryLoaded: false,
  isHistoryLoading: false,

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { currentSessionKey } = get();

    const userMsg: ChatDockMessage = {
      id: generateMessageId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      isStreaming: true,
      dockExpanded: true,
      error: null,
      streamingMessage: null,
    }));

    localPersistence.saveMessage(currentSessionKey, userMsg).catch(() => {});

    try {
      let adapter: GatewayAdapter;
      try {
        adapter = getAdapter();
      } catch (initErr) {
        console.error("[ChatDock] Adapter not initialized:", initErr);
        set({ error: i18n.t("common:errors.adapterNotInitialized"), isStreaming: false });
        return;
      }
      console.log("[ChatDock] Sending chat.send:", {
        text: trimmed,
        sessionKey: currentSessionKey,
      });
      await adapter.chatSend({
        text: trimmed,
        sessionKey: currentSessionKey,
      });
      console.log("[ChatDock] chat.send completed");
    } catch (err) {
      console.error("[ChatDock] chat.send error:", err);
      set({ error: String(err), isStreaming: false });
    }
  },

  abort: async () => {
    const { currentSessionKey } = get();
    set({
      isStreaming: false,
      streamingMessage: null,
    });

    try {
      const adapter = getAdapter();
      await adapter.chatAbort(currentSessionKey);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  toggleDock: () => {
    set((s) => ({ dockExpanded: !s.dockExpanded }));
  },

  setDockExpanded: (expanded) => {
    set({ dockExpanded: expanded });
  },

  switchSession: (key) => {
    set({
      currentSessionKey: key,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      isHistoryLoaded: false,
    });
    get().initializeHistory();
  },

  newSession: () => {
    const { targetAgentId } = get();
    const agentId = targetAgentId ?? "main";
    const newKey = `agent:${agentId}:session-${Date.now()}`;
    set({
      currentSessionKey: newKey,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
    });
  },

  loadSessions: async () => {
    try {
      const adapter = getAdapter();
      const result = await adapter.sessionsList();
      const sessions = Array.isArray(result) ? result : [];
      set({ sessions });

      const { targetAgentId, currentSessionKey } = get();
      if (targetAgentId) {
        const preferred = pickLatestAgentSessionKey(targetAgentId, sessions);
        if (preferred !== currentSessionKey) {
          set({ currentSessionKey: preferred, messages: [], isHistoryLoaded: false });
          get().initializeHistory();
        }
      }
    } catch {
      // Silently handle — sessions not critical
    }
  },

  loadHistory: async () => {
    const { currentSessionKey } = get();
    try {
      const adapter = getAdapter();
      const rawMessages = await adapter.chatHistory(currentSessionKey);
      const messages: ChatDockMessage[] = rawMessages.map((m) => ({
        id: m.id,
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
        timestamp: m.timestamp,
      }));
      set({ messages });
      localPersistence.saveMessages(currentSessionKey, messages).catch(() => {});
    } catch {
      set({ messages: [] });
    }
  },

  initializeHistory: async () => {
    const { currentSessionKey } = get();
    set({ isHistoryLoading: true });
    try {
      const adapter = getAdapter();
      const rawMessages = await adapter.chatHistory(currentSessionKey);
      const messages: ChatDockMessage[] = rawMessages.map((m) => ({
        id: m.id,
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
        timestamp: m.timestamp,
      }));
      set({ messages, isHistoryLoaded: true, isHistoryLoading: false });
      localPersistence.saveMessages(currentSessionKey, messages).catch(() => {});
    } catch {
      // Gateway unavailable — fallback to IndexedDB
      try {
        const cached = await localPersistence.getMessages(currentSessionKey);
        set({ messages: cached, isHistoryLoaded: true, isHistoryLoading: false });
      } catch {
        set({ messages: [], isHistoryLoaded: true, isHistoryLoading: false });
      }
    }
  },

  setTargetAgent: (agentId) => {
    const { sessions } = get();
    const sessionKey = pickLatestAgentSessionKey(agentId, sessions);
    set({
      targetAgentId: agentId,
      currentSessionKey: sessionKey,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      isHistoryLoaded: false,
    });
    get().initializeHistory();
  },

  handleChatEvent: (event, frameSessionKey) => {
    const storeSessionKey = get().currentSessionKey;
    const payloadSessionKey = String(event.sessionKey || frameSessionKey || "");

    // Critical: ignore chat events from other sessions/agents
    if (payloadSessionKey && payloadSessionKey !== storeSessionKey) {
      return;
    }

    const eventState = String(event.state || "");
    const runId = String(event.runId || "");
    const message = event.message as Record<string, unknown> | undefined;

    // Infer state if missing
    let resolvedState = eventState;
    if (!resolvedState && message) {
      const stopReason =
        (message as Record<string, unknown>).stopReason ??
        (message as Record<string, unknown>).stop_reason;
      if (stopReason) {
        resolvedState = "final";
      } else if (message.role || message.content) {
        resolvedState = "delta";
      }
    }

    switch (resolvedState) {
      case "delta": {
        if (message) {
          set({
            streamingMessage: message,
            activeRunId: runId || get().activeRunId,
          });
        }
        break;
      }
      case "final": {
        if (message) {
          const text = extractText(message.content);
          if (text) {
            const assistantMsg: ChatDockMessage = {
              id: (message.id as string) || generateMessageId(),
              role: "assistant",
              content: text,
              timestamp: Date.now(),
            };
            set((s) => ({
              messages: [...s.messages, assistantMsg],
              isStreaming: false,
              streamingMessage: null,
              activeRunId: null,
            }));
            const { currentSessionKey } = get();
            localPersistence.saveMessage(currentSessionKey, assistantMsg).catch(() => {});
          } else {
            set({
              isStreaming: false,
              streamingMessage: null,
              activeRunId: null,
            });
            get().loadHistory();
          }
        } else {
          set({
            isStreaming: false,
            streamingMessage: null,
            activeRunId: null,
          });
          get().loadHistory();
        }
        break;
      }
      case "error": {
        const errorMsg = String(event.errorMessage || i18n.t("common:errors.errorOccurred"));
        set({
          error: errorMsg,
          isStreaming: false,
          streamingMessage: null,
          activeRunId: null,
        });
        break;
      }
      case "aborted": {
        set({
          isStreaming: false,
          streamingMessage: null,
          activeRunId: null,
        });
        break;
      }
      default: {
        // Unknown state — if streaming, treat as delta
        if (get().isStreaming && message) {
          set({ streamingMessage: message });
        }
        break;
      }
    }
  },

  clearError: () => set({ error: null }),

  initEventListeners: (wsClient) => {
    if (!wsClient) return () => {};

    const unsub = wsClient.onEvent("chat", (frame: GatewayEventFrame) => {
      const payload = frame.payload as Record<string, unknown>;
      get().handleChatEvent(payload);
    });

    return unsub;
  },
}));
