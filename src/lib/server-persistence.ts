import type { ChatDockMessage } from "@/store/console-stores/chat-dock-store";
import type { SessionInfo } from "@/gateway/adapter-types";

interface ServerCacheMessagesResponse {
  messages: ChatDockMessage[];
  sessionKey: string;
  agentId: string | null;
  cachedAt: number | null;
}

interface ServerCacheSessionsResponse {
  sessions: SessionInfo[];
  cachedAt: number | null;
}

interface ServerCacheAllMessagesItem {
  sessionKey: string;
  messageCount?: number;
}

interface ServerCacheAllMessagesResponse {
  sessions: ServerCacheAllMessagesItem[];
}

const BASE_URL = "/api/chat-cache";
const SAVE_DEBOUNCE_MS = 2000;

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    throw new Error(`Server cache API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Strip large binary payload (dataUrl / content) from attachments before
 * sending messages to the cache server. The cache only needs metadata
 * (id/name/mimeType) for display; including full base64 payloads can
 * trivially exceed the server's request body limit and cause 500 errors.
 */
function stripAttachmentData(messages: ChatDockMessage[]): ChatDockMessage[] {
  return messages.map((msg) => {
    if (!msg.attachments || msg.attachments.length === 0) return msg;
    return {
      ...msg,
      attachments: msg.attachments.map((att) => ({
        id: att.id,
        name: att.name,
        mimeType: att.mimeType,
      })),
    };
  });
}

function debouncedSave(key: string, fn: () => Promise<void>): void {
  const existing = pendingSaves.get(key);
  if (existing) clearTimeout(existing);
  pendingSaves.set(
    key,
    setTimeout(() => {
      pendingSaves.delete(key);
      fn().catch(() => {});
    }, SAVE_DEBOUNCE_MS),
  );
}

export const serverPersistence = {
  async getMessages(sessionKey: string): Promise<ChatDockMessage[]> {
    try {
      const result = await fetchJson<ServerCacheMessagesResponse>(
        `${BASE_URL}/messages?sessionKey=${encodeURIComponent(sessionKey)}`,
      );
      return result.messages ?? [];
    } catch {
      return [];
    }
  },

  saveMessages(sessionKey: string, messages: ChatDockMessage[], agentId?: string | null): void {
    const sanitized = stripAttachmentData(messages);
    debouncedSave(`msg:${sessionKey}`, () =>
      fetchJson(`${BASE_URL}/messages`, {
        method: "PUT",
        body: JSON.stringify({ sessionKey, messages: sanitized, agentId: agentId ?? null }),
      }),
    );
  },

  saveMessagesImmediate(sessionKey: string, messages: ChatDockMessage[], agentId?: string | null): void {
    const existing = pendingSaves.get(`msg:${sessionKey}`);
    if (existing) {
      clearTimeout(existing);
      pendingSaves.delete(`msg:${sessionKey}`);
    }
    const sanitized = stripAttachmentData(messages);
    void fetchJson(`${BASE_URL}/messages`, {
      method: "PUT",
      body: JSON.stringify({ sessionKey, messages: sanitized, agentId: agentId ?? null }),
    }).catch(() => {});
  },

  async clearMessages(sessionKey: string): Promise<void> {
    const existing = pendingSaves.get(`msg:${sessionKey}`);
    if (existing) {
      clearTimeout(existing);
      pendingSaves.delete(`msg:${sessionKey}`);
    }
    try {
      await fetchJson(`${BASE_URL}/messages?sessionKey=${encodeURIComponent(sessionKey)}`, {
        method: "DELETE",
      });
    } catch {
      // Silent fail.
    }
  },

  async getSessions(): Promise<ServerCacheSessionsResponse> {
    try {
      return await fetchJson<ServerCacheSessionsResponse>(`${BASE_URL}/sessions`);
    } catch {
      return { sessions: [], cachedAt: null };
    }
  },

  async getAllMessageCounts(): Promise<Map<string, number>> {
    try {
      const result = await fetchJson<ServerCacheAllMessagesResponse>(`${BASE_URL}/all-messages`);
      const counts = new Map<string, number>();
      for (const item of result.sessions ?? []) {
        if (typeof item.sessionKey !== "string" || item.sessionKey.length === 0) {
          continue;
        }
        const rawCount = item.messageCount;
        if (typeof rawCount !== "number" || !Number.isFinite(rawCount) || rawCount < 0) {
          continue;
        }
        counts.set(item.sessionKey, rawCount);
      }
      return counts;
    } catch {
      return new Map<string, number>();
    }
  },

  saveSessions(sessions: SessionInfo[]): void {
    debouncedSave("sessions", () =>
      fetchJson(`${BASE_URL}/sessions`, {
        method: "PUT",
        body: JSON.stringify({ sessions }),
      }),
    );
  },
};
