import { useEffect, useRef } from "react";
import { initAdapter, isMockMode } from "@/gateway/adapter-provider";
import { fetchProjectionBootstrap, isOperatorBootstrapConfigured } from "@/gateway/projection-bootstrap-fetcher";
import { GatewayRpcClient } from "@/gateway/rpc-client";
import type {
  AgentEventPayload,
  AgentSummary,
  AgentsListResponse,
  GatewayEventFrame,
  HealthSnapshot,
  ProjectionBootstrapPacket,
} from "@/gateway/types";
import { GatewayWsClient } from "@/gateway/ws-client";
import { EventThrottle } from "@/lib/event-throttle";
import { MOCK_PROJECTION_BOOTSTRAP } from "@/mock/projection-bootstrap";
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

  const setConnectionStatus = useOfficeStore((s) => s.setConnectionStatus);
  const initAgents = useOfficeStore((s) => s.initAgents);
  const syncMainAgents = useOfficeStore((s) => s.syncMainAgents);
  const applyProjectionBootstrap = useOfficeStore((s) => s.applyProjectionBootstrap);
  const processAgentEvent = useOfficeStore((s) => s.processAgentEvent);
  const setOperatorScopes = useOfficeStore((s) => s.setOperatorScopes);
  const setMaxSubAgents = useOfficeStore((s) => s.setMaxSubAgents);
  const setAgentToAgentConfig = useOfficeStore((s) => s.setAgentToAgentConfig);

  useEffect(() => {
    if (!url) {
      return;
    }

    if (isMockMode()) {
      let unsubEvent: (() => void) | null = null;

      void initAdapter("mock").then(async (adapter) => {
        unsubEvent = adapter.onEvent((event: string, payload: unknown) => {
          if (event === "agent") {
            processAgentEvent(payload as AgentEventPayload);
          }
        });

        applyProjectionBootstrap(MOCK_PROJECTION_BOOTSTRAP);

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

        const agentList = (await adapter.agentsList()) as AgentsListResponse;
        cacheAgentNames(agentList.agents);
        setOperatorScopes(["operator.admin", "operator.read"]);
        setConnectionStatus("connected");
      });

      return () => {
        unsubEvent?.();
      };
    }

    const ws = new GatewayWsClient();
    const rpc = new GatewayRpcClient(ws);
    const throttle = new EventThrottle();

    wsRef.current = ws;
    rpcRef.current = rpc;
    throttleRef.current = throttle;

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
        const authScopes = ws.getAuthInfo()?.scopes;
        setOperatorScopes(Array.isArray(authScopes) ? authScopes : ["operator.admin", "operator.read"]);

        void initAdapter("ws", { wsClient: ws, rpcClient: rpc });
        void fetchGatewayConfig(rpc, setMaxSubAgents, setAgentToAgentConfig);
        void fetchAgentNamesAndUpdate(rpc, syncMainAgents);
      }
    });

    ws.onEvent("agent", (frame: GatewayEventFrame) => {
      const payload = frame.payload as AgentEventPayload;
      throttle.push(payload);
    });

    ws.onEvent("health", (frame: GatewayEventFrame) => {
      const health = frame.payload as HealthSnapshot;
      if (health?.agents) {
        const summaries = healthAgentsToSummaries(health);
        syncMainAgents(summaries);
      }
    });

    ws.connect(url, token);

    // Operator-facing bootstrap: load projection packet from configured URL/path
    // This runs in parallel with the real Gateway connection, non-mock mode only.
    if (!isMockMode() && isOperatorBootstrapConfigured()) {
      void loadOperatorBootstrap(applyProjectionBootstrap);
    }

    return () => {
      throttle.destroy();
      ws.disconnect();
      wsRef.current = null;
      rpcRef.current = null;
      throttleRef.current = null;
    };
  }, [
    url,
    token,
    setConnectionStatus,
    initAgents,
    syncMainAgents,
    processAgentEvent,
    applyProjectionBootstrap,
    setOperatorScopes,
    setMaxSubAgents,
    setAgentToAgentConfig,
  ]);

  useSubAgentPoller(rpcRef);
  useUsagePoller(rpcRef);

  return { wsClient: wsRef, rpcClient: rpcRef };
}

const agentNameCache = new Map<string, { name: string; identity?: AgentSummary["identity"] }>();

function cacheAgentNames(agents: AgentSummary[]): void {
  for (const a of agents) {
    agentNameCache.set(a.id, {
      name: a.identity?.name ?? a.name ?? a.id,
      identity: a.identity,
    });
  }
}

function resolveAgentName(agentId: string): string {
  return agentNameCache.get(agentId)?.name ?? agentId;
}

function healthAgentsToSummaries(health: HealthSnapshot): AgentSummary[] {
  if (!health.agents) {
    return [];
  }
  return health.agents.map((a) => ({
    id: a.agentId,
    name: resolveAgentName(a.agentId),
    identity: agentNameCache.get(a.agentId)?.identity,
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

interface ConfigGetResponse {
  value?: unknown;
}

async function fetchAgentNamesAndUpdate(
  rpc: GatewayRpcClient,
  syncMainAgents: (agents: AgentSummary[]) => void,
): Promise<void> {
  try {
    const result = await rpc.request<AgentsListResponse>("agents.list");
    if (result?.agents) {
      cacheAgentNames(result.agents);
      syncMainAgents(result.agents);
    }
  } catch {
    // agents.list not available yet, snapshot data will be used
  }
}

async function fetchGatewayConfig(
  rpc: GatewayRpcClient,
  setMaxSubAgents: (n: number) => void,
  setAgentToAgentConfig: (config: { enabled: boolean; allow: string[] }) => void,
): Promise<void> {
  try {
    const resp = await rpc.request<ConfigGetResponse>("config.get", {
      keys: ["agents.defaults.subagents", "tools.agentToAgent"],
    });
    const val = resp.value as Record<string, unknown> | undefined;
    if (val) {
      const subagents = val["agents.defaults.subagents"] as
        | { maxConcurrent?: number }
        | undefined;
      if (subagents?.maxConcurrent && subagents.maxConcurrent >= 1 && subagents.maxConcurrent <= 50) {
        setMaxSubAgents(subagents.maxConcurrent);
      }
      const a2a = val["tools.agentToAgent"] as { enabled?: boolean; allow?: string[] } | undefined;
      if (a2a) {
        setAgentToAgentConfig({
          enabled: a2a.enabled ?? false,
          allow: Array.isArray(a2a.allow) ? a2a.allow : [],
        });
      }
    }
  } catch {
    // config.get not available; keep defaults
  }
}

/**
 * Load operator-facing projection bootstrap packet.
 * Called once after Gateway connection in non-mock mode.
 */
async function loadOperatorBootstrap(
  applyBootstrap: (packet: ProjectionBootstrapPacket) => void,
): Promise<void> {
  try {
    const packet = await fetchProjectionBootstrap();
    if (packet) {
      applyBootstrap(packet);
    }
  } catch (error) {
    console.warn(
      "[useGatewayConnection] Failed to load operator bootstrap:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
