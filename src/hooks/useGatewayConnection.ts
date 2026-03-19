import { useEffect, useRef, useCallback } from "react";
import { initAdapter, isMockMode } from "@/gateway/adapter-provider";
import { GatewayRpcClient } from "@/gateway/rpc-client";
import type {
  AgentEventPayload,
  AgentSummary,
  AgentsListResponse,
  GatewayEventFrame,
  HealthSnapshot,
} from "@/gateway/types";
import { GatewayWsClient } from "@/gateway/ws-client";
import { EventThrottle } from "@/lib/event-throttle";
import { useOfficeStore } from "@/store/office-store";
import { useSubAgentPoller } from "./useSubAgentPoller";
import { useUsagePoller } from "./useUsagePoller";

interface UseGatewayConnectionOptions {
  url: string;
  token: string;
}

export function useGatewayConnection({ url, token }: UseGatewayConnectionOptions) {
  const wsRef = useRef<GatewayWsClient | null>(null);
  const rpcRef = useRef<GatewayRpcClient | null>(null);
  const throttleRef = useRef<EventThrottle | null>(null);
  // Track the last connected URL/token to avoid reconnecting on identity-equal deps
  const connectedRef = useRef<{ url: string; token: string }>({ url: "", token: "" });

  const setConnectionStatus = useOfficeStore((s) => s.setConnectionStatus);
  const initAgents = useOfficeStore((s) => s.initAgents);
  const processAgentEvent = useOfficeStore((s) => s.processAgentEvent);
  const setOperatorScopes = useOfficeStore((s) => s.setOperatorScopes);
  const setMaxSubAgents = useOfficeStore((s) => s.setMaxSubAgents);
  const setAgentToAgentConfig = useOfficeStore((s) => s.setAgentToAgentConfig);

  // Stable callbacks that never change identity across renders
  const onAgentEvent = useCallback(
    (frame: GatewayEventFrame) => {
      throttleRef.current?.push(frame.payload as AgentEventPayload);
    },
    [],
  );

  const onHealthEvent = useCallback(
    (frame: GatewayEventFrame) => {
      const health = frame.payload as HealthSnapshot;
      if (health?.agents) {
        const summaries = healthAgentsToSummaries(health);
        initAgents(summaries);
      }
    },
    [initAgents],
  );

  useEffect(() => {
    if (!url) {
      return;
    }

    // Skip reconnect if URL+token haven't actually changed (React StrictMode re-mount guard)
    if (connectedRef.current.url === url && connectedRef.current.token === token) {
      return;
    }

    // Mock mode: use MockAdapter directly (no WebSocket needed)
    if (isMockMode()) {
      let unsubEvent: (() => void) | null = null;

      void initAdapter("mock").then(async (adapter) => {
        // 1. Wire event handler FIRST so no events are lost
        unsubEvent = adapter.onEvent((event: string, payload: unknown) => {
          if (event === "agent") {
            processAgentEvent(payload as AgentEventPayload);
          }
        });

        // 2. Apply config BEFORE initAgents (prefillLoungePlaceholders uses maxSubAgents)
        const config = await adapter.configGet();
        const cfg = config.config as Record<string, unknown>;
        const agentsCfg = cfg.agents as Record<string, unknown> | undefined;
        const defaults = agentsCfg?.defaults as Record<string, unknown> | undefined;
        const subagents = defaults?.subagents as { maxConcurrent?: number } | undefined;
        if (subagents?.maxConcurrent) {
          setMaxSubAgents(subagents.maxConcurrent);
        }
        const tools = cfg.tools as Record<string, unknown> | undefined;
        const a2a = tools?.agentToAgent as { enabled?: boolean; allow?: string[] } | undefined;
        if (a2a) {
          setAgentToAgentConfig({
            enabled: a2a.enabled ?? false,
            allow: Array.isArray(a2a.allow) ? a2a.allow : [],
          });
        }

        // 3. Init agents (triggers prefillLoungePlaceholders with correct maxSubAgents)
        const agentList = await adapter.agentsList() as AgentsListResponse;
        initAgents(agentList.agents);
        setOperatorScopes(["operator.admin"]);
        setConnectionStatus("connected");
      });
      return () => {
        unsubEvent?.();
      };
    }

    // Disconnect any existing client before creating a new one
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    const ws = new GatewayWsClient();
    const rpc = new GatewayRpcClient(ws);
    const throttle = new EventThrottle();

    wsRef.current = ws;
    rpcRef.current = rpc;
    throttleRef.current = throttle;

    connectedRef.current = { url, token };

    throttle.onBatch((events) => {
      for (const event of events) {
        processAgentEvent(event);
      }
    });

    throttle.onImmediate((event) => {
      processAgentEvent(event);
    });

    ws.onStatusChange((status, error) => {
      setConnectionStatus(status, error);

      if (status === "connected") {
        initAgentsFromSnapshot(ws, initAgents);
        const snapshot = ws.getSnapshot();
        const scopes = (snapshot as Record<string, unknown>)?.scopes;
        setOperatorScopes(Array.isArray(scopes) ? (scopes as string[]) : ["operator"]);

        void initAdapter("ws", { wsClient: ws, rpcClient: rpc });
        void fetchGatewayConfig(rpc, setMaxSubAgents, setAgentToAgentConfig);
      }
    });

    ws.onEvent("agent", onAgentEvent);

    ws.onEvent("health", onHealthEvent);

    ws.connect(url, token);

    return () => {
      throttle.destroy();
      ws.disconnect();
      // Reset the connected ref so the next mount with the same url will reconnect
      connectedRef.current = { url: "", token: "" };
    };
  }, [url, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useSubAgentPoller(rpcRef);
  useUsagePoller(rpcRef);

  return { wsClient: wsRef, rpcClient: rpcRef };
}

function healthAgentsToSummaries(health: HealthSnapshot): AgentSummary[] {
  if (!health.agents) {
    return [];
  }
  return health.agents.map((a) => ({
    id: a.agentId,
    name: a.agentId,
  }));
}

function initAgentsFromSnapshot(
  ws: GatewayWsClient,
  initAgents: (agents: AgentSummary[]) => void,
): void {
  const snapshot = ws.getSnapshot();
  const health = snapshot?.health as HealthSnapshot | undefined;
  if (health?.agents) {
    initAgents(healthAgentsToSummaries(health));
  }
}

async function fetchGatewayConfig(
  rpc: GatewayRpcClient,
  setMaxSubAgents: (n: number) => void,
  setAgentToAgentConfig: (config: { enabled: boolean; allow: string[] }) => void,
): Promise<void> {
  try {
    const resp = await rpc.request<{ config?: Record<string, unknown> }>("config.get");
    const config = resp.config;
    if (!config) {
      return;
    }

    const agentsCfg = config.agents as Record<string, unknown> | undefined;
    const defaults = agentsCfg?.defaults as Record<string, unknown> | undefined;
    const subagents = defaults?.subagents as { maxConcurrent?: number } | undefined;
    if (subagents?.maxConcurrent && subagents.maxConcurrent >= 1 && subagents.maxConcurrent <= 50) {
      setMaxSubAgents(subagents.maxConcurrent);
    }

    const tools = config.tools as Record<string, unknown> | undefined;
    const a2a = tools?.agentToAgent as { enabled?: boolean; allow?: string[] } | undefined;
    if (a2a) {
      setAgentToAgentConfig({
        enabled: a2a.enabled ?? false,
        allow: Array.isArray(a2a.allow) ? a2a.allow : [],
      });
    }
  } catch {
    // Gateway doesn't support config.get or permission denied — use defaults
  }
}
