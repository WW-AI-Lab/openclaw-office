import type { SessionInfo } from "@/gateway/adapter-types";
import { localPersistence } from "@/lib/local-persistence";
import { serverPersistence } from "@/lib/server-persistence";
import { extractAgentIdFromSessionKey } from "@/lib/session-key-utils";

export function buildSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

const CHAT_PAGE_LAST_SESSION_KEY = "openclaw-office-chat-page:last-session";

export function isWorkspaceChatSessionKey(sessionKey: string): boolean {
  return /^agent:[^:]+:(main|session-[^:]+)$/u.test(sessionKey);
}

export function filterWorkspaceSessions(sessions: SessionInfo[]): SessionInfo[] {
  return sessions.filter((session) => isWorkspaceChatSessionKey(session.key));
}

export function getStoredWorkspaceSessionKey(): string | null {
  try {
    const value = localStorage.getItem(CHAT_PAGE_LAST_SESSION_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function storeWorkspaceSessionKey(sessionKey: string): void {
  if (!isWorkspaceChatSessionKey(sessionKey)) {
    return;
  }
  try {
    localStorage.setItem(CHAT_PAGE_LAST_SESSION_KEY, sessionKey);
  } catch {
    // Ignore localStorage failures.
  }
}

export function resolveSessionAgentId(sessionKey: string, sessions: SessionInfo[]): string | null {
  const session = sessions.find((item) => item.key === sessionKey);
  return session?.agentId ?? extractAgentIdFromSessionKey(sessionKey);
}

export function selectPreferredSessionKey(agentId: string, sessions: SessionInfo[]): string {
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

export function normalizeSession(session: SessionInfo): SessionInfo {
  return {
    ...session,
    label: session.label ?? session.key,
    lastActiveAt: session.lastActiveAt ?? session.updatedAt ?? Date.now(),
    messageCount: session.messageCount ?? 0,
  };
}

export function mergeCurrentSession(
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

export function touchSession(
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

export function persistSessions(sessions: SessionInfo[]): void {
  void localPersistence.saveSessions(sessions);
  serverPersistence.saveSessions(sessions);
}

export function applyMessageCountHints(
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
