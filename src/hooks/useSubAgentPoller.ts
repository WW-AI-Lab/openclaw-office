import { useEffect, useRef } from "react";
import type { GatewayRpcClient } from "@/gateway/rpc-client";
import type { SubAgentInfo } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

const SUB_AGENT_MAX_IDLE_MS = 5 * 60_000;

export interface SessionEntry {
  key?: string;
  sessionKey?: string;
  agentId?: string;
  label?: string;
  task?: string;
  requesterSessionKey?: string;
  startedAt?: number;
  createdAt?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
}

export function diffSessions(
  prev: SubAgentInfo[],
  next: SubAgentInfo[],
): { added: SubAgentInfo[]; removed: SubAgentInfo[] } {
  const prevKeys = new Set(prev.map((s) => s.sessionKey));
  const nextKeys = new Set(next.map((s) => s.sessionKey));

  const added = next.filter((s) => !prevKeys.has(s.sessionKey));
  const removed = prev.filter((s) => !nextKeys.has(s.sessionKey));

  return { added, removed };
}

/**
 * Extract the sub-agent UUID from a sessionKey like "agent:<parent>:subagent:<uuid>".
 * Returns null if the pattern doesn't match.
 */
export { extractSubAgentUuid as extractSubAgentUuidForTest };
function extractSubAgentUuid(sessionKey: string): string | null {
  const marker = ":subagent:";
  const idx = sessionKey.indexOf(marker);
  if (idx >= 0) {
    return sessionKey.slice(idx + marker.length);
  }
  return null;
}

export function toSubAgentInfoList(entries: SessionEntry[]): SubAgentInfo[] {
  return entries
    .filter((s) => s.requesterSessionKey && (s.sessionKey ?? s.key))
    .map((s) => {
      const sessionKey = s.sessionKey ?? s.key ?? "";
      // Gateway returns agentId as the parent agent name (e.g. "main"), not the
      // sub-agent's unique id. Extract the UUID from the sessionKey instead to
      // avoid colliding with the parent agent in the store.
      const subUuid = extractSubAgentUuid(sessionKey);
      const effectiveId = subUuid ?? s.agentId ?? sessionKey;
      // Prefer the explicit human-readable label from sessions_spawn (e.g.
      // "Analyste de portefeuille"). Treat empty/whitespace-only labels as
      // absent so the fallback chain still produces something readable.
      // Fallback order matches existing behavior: explicit label → derived
      // Sub-<uuid> when sessionKey carries a sub-agent UUID → agentId.
      const explicitLabel = s.label?.trim();
      const label =
        explicitLabel ||
        (subUuid ? `Sub-${subUuid.slice(0, 6)}` : (s.agentId ?? effectiveId));
      return {
        sessionKey,
        agentId: effectiveId,
        label,
        task: s.task ?? "",
        requesterSessionKey: s.requesterSessionKey!,
        startedAt: s.startedAt ?? s.createdAt ?? Date.now(),
      };
    });
}

export function useSubAgentPoller(_rpcClient: React.RefObject<GatewayRpcClient | null>) {
  const prevSubsRef = useRef<SubAgentInfo[]>([]);
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const snapshot = useOfficeStore((s) => s.lastSessionsSnapshot);

  useEffect(() => {
    if (connectionStatus !== "connected") {
      prevSubsRef.current = [];
      return;
    }

    if (!snapshot) {
      return;
    }

    const nextSubs = snapshot.sessions ?? [];
    const prevSubs = prevSubsRef.current;
    const { added, removed } = diffSessions(prevSubs, nextSubs);

    for (const sub of added) {
      const parentId = resolveParentAgent(sub.requesterSessionKey);
      if (parentId) {
        useOfficeStore.getState().addSubAgent(parentId, sub);
      }
    }

    for (const sub of removed) {
      if (useOfficeStore.getState().agents.has(sub.agentId)) {
        useOfficeStore.getState().retireSubAgent(sub.agentId);
      }
    }

    // Safety net: retire idle sub-agents that have been around too long
    // without pendingRetire (missed lifecycle:end or stale session).
    const now = Date.now();
    const activeSessionIds = new Set(nextSubs.map((s) => s.agentId));
    for (const [id, agent] of useOfficeStore.getState().agents) {
      if (
        agent.isSubAgent &&
        !agent.isPlaceholder &&
        !agent.pendingRetire &&
        agent.status === "idle" &&
        !activeSessionIds.has(id) &&
        now - agent.lastActiveAt > SUB_AGENT_MAX_IDLE_MS
      ) {
        useOfficeStore.getState().retireSubAgent(id);
      }
    }

    prevSubsRef.current = nextSubs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, snapshot?.fetchedAt]);

  function resolveParentAgent(requesterSessionKey: string): string | null {
    const sessionKeyMap = useOfficeStore.getState().sessionKeyMap;
    const agentIds = sessionKeyMap.get(requesterSessionKey);
    if (agentIds && agentIds.length > 0) {
      return agentIds[0];
    }

    for (const [id, agent] of useOfficeStore.getState().agents) {
      if (!agent.isSubAgent) {
        return id;
      }
    }
    return null;
  }
}
