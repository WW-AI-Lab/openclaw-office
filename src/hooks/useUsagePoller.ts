import { useEffect, useRef } from "react";
import type { GatewayRpcClient } from "@/gateway/rpc-client";
import type { TokenSnapshot } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

const POLL_INTERVAL_MS = 60_000;
const FAILURE_THRESHOLD = 3;

interface UsageStatusResponse {
  total?: number;
  byAgent?: Record<string, number>;
  tokens?: {
    total?: number;
    byAgent?: Record<string, number>;
  };
  usage?: {
    totalTokens?: number;
    byAgent?: Record<string, number>;
  };
}

interface UsageCostResponse {
  byAgent?: Record<string, number>;
  costs?: Record<string, number>;
}

export function useUsagePoller(rpcRef: React.RefObject<GatewayRpcClient | null>) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failureCountRef = useRef(0);

  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const pushTokenSnapshot = useOfficeStore((s) => s.pushTokenSnapshot);
  const setAgentCosts = useOfficeStore((s) => s.setAgentCosts);

  useEffect(() => {
    if (connectionStatus !== "connected" || !rpcRef.current) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const rpc = rpcRef.current;
      if (!rpc) {
        return;
      }

      try {
        const [statusResp, costResp] = await Promise.all([
          rpc.request<UsageStatusResponse>("usage.status"),
          rpc.request<UsageCostResponse>("usage.cost").catch(() => null),
        ]);

        failureCountRef.current = 0;

        const now = Date.now();
        const resolved = resolveTokenSnapshot(statusResp);

        if (resolved) {
          pushTokenSnapshot({
            timestamp: now,
            total: resolved.total,
            byAgent: resolved.byAgent,
          });
        } else {
          const history = useOfficeStore.getState().eventHistory;
          const estimated = estimateFromEventHistory(history);
          if (estimated) {
            pushTokenSnapshot(estimated);
          }
        }

        const costs = costResp?.byAgent ?? costResp?.costs ?? {};
        if (Object.keys(costs).length > 0) {
          setAgentCosts(costs);
        }
      } catch {
        failureCountRef.current += 1;

        if (failureCountRef.current >= FAILURE_THRESHOLD) {
          const history = useOfficeStore.getState().eventHistory;
          const snapshot = estimateFromEventHistory(history);
          if (snapshot) {
            pushTokenSnapshot(snapshot);
          }
        }
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
  }, [connectionStatus, pushTokenSnapshot, setAgentCosts]);
}

function sumValues(obj: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === "number") {
      sum += v;
    }
  }
  return sum;
}

function resolveTokenSnapshot(
  statusResp: UsageStatusResponse | null | undefined,
): { total: number; byAgent: Record<string, number> } | null {
  if (!statusResp) return null;

  const byAgent =
    statusResp.byAgent ??
    statusResp.tokens?.byAgent ??
    statusResp.usage?.byAgent ??
    {};

  const totalCandidates = [
    statusResp.total,
    statusResp.tokens?.total,
    statusResp.usage?.totalTokens,
  ].filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const totalFromByAgent = sumValues(byAgent);
  const total = totalCandidates[0] ?? totalFromByAgent;

  if (!Number.isFinite(total) || total <= 0) return null;

  return {
    total: Math.max(0, Math.round(total)),
    byAgent,
  };
}

function estimateFromEventHistory(
  history: { timestamp: number; agentId: string; stream: string }[],
): TokenSnapshot | null {
  const byAgent: Record<string, number> = {};
  let total = 0;

  for (const item of history) {
    if (item.stream !== "tool") {
      continue;
    }
    const tokens = 100;
    byAgent[item.agentId] = (byAgent[item.agentId] ?? 0) + tokens;
    total += tokens;
  }

  if (total === 0) {
    return null;
  }

  return {
    timestamp: Date.now(),
    total,
    byAgent,
  };
}
