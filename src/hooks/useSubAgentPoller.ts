import { useEffect, useRef } from "react";
import type { GatewayRpcClient } from "@/gateway/rpc-client";
import type { SubAgentInfo } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

const POLL_INTERVAL_MS = 3_000;

interface SessionEntry {
  sessionKey: string;
  agentId: string;
  label?: string;
  task?: string;
  requesterSessionKey?: string;
  startedAt?: number;
}

interface SessionsListResponse {
  sessions: SessionEntry[];
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

function toSubAgentInfoList(entries: SessionEntry[]): SubAgentInfo[] {
  return entries
    .filter((s) => s.requesterSessionKey)
    .map((s) => ({
      sessionKey: s.sessionKey,
      agentId: s.agentId,
      label: s.label ?? s.agentId,
      task: s.task ?? "",
      requesterSessionKey: s.requesterSessionKey!,
      startedAt: s.startedAt ?? Date.now(),
    }));
}

export function useSubAgentPoller(rpcClient: React.RefObject<GatewayRpcClient | null>) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const lastSnapshot = useOfficeStore((s) => s.lastSessionsSnapshot);
  const setSessionsSnapshot = useOfficeStore((s) => s.setSessionsSnapshot);
  const addSubAgent = useOfficeStore((s) => s.addSubAgent);
  const agents = useOfficeStore((s) => s.agents);
  const removeSubAgent = useOfficeStore((s) => s.removeSubAgent);

  useEffect(() => {
    if (connectionStatus !== "connected" || !rpcClient.current) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const rpc = rpcClient.current;
      if (!rpc) {
        return;
      }

      try {
        const resp = await rpc.request<SessionsListResponse>("sessions.list");
        const nextSubs = toSubAgentInfoList(resp.sessions ?? []);

        const prevSubs = lastSnapshot?.sessions ?? [];
        const { added, removed } = diffSessions(prevSubs, nextSubs);

        for (const sub of added) {
          const parentId = resolveParentAgent(sub.requesterSessionKey);
          if (parentId) {
            // addSubAgent handles: unconfirmed→confirm, placeholder activation, walk animation
            addSubAgent(parentId, sub);
          }
        }

        for (const sub of removed) {
          if (agents.has(sub.agentId)) {
            removeSubAgent(sub.agentId);
          }
        }

        setSessionsSnapshot({ sessions: nextSubs, fetchedAt: Date.now() });
      } catch {
        // RPC failure — skip this cycle
      }
    };

    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]);

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
