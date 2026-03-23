import { useEffect, useRef } from "react";
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
import i18n from "@/i18n";
import { PerceptionEngine } from "@/perception/perception-engine";
import { useProjectionStore } from "@/perception/projection-store";
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
  const perceptionRef = useRef<PerceptionEngine | null>(null);

  const setConnectionStatus = useOfficeStore((s) => s.setConnectionStatus);
  const initAgents = useOfficeStore((s) => s.initAgents);
  const syncMainAgents = useOfficeStore((s) => s.syncMainAgents);
  const processAgentEvent = useOfficeStore((s) => s.processAgentEvent);
  const setOperatorScopes = useOfficeStore((s) => s.setOperatorScopes);
  const setMaxSubAgents = useOfficeStore((s) => s.setMaxSubAgents);
  const setAgentToAgentConfig = useOfficeStore((s) => s.setAgentToAgentConfig);
  const setDebugWarnings = useOfficeStore((s) => s.setDebugWarnings);

  useEffect(() => {
    if (!url) {
      return;
    }

    // Mock mode: use MockAdapter directly (no WebSocket needed)
    if (isMockMode()) {
      let unsubEvent: (() => void) | null = null;
      const mockPerception = new PerceptionEngine();
      perceptionRef.current = mockPerception;
      const applyPerceivedEvent = useProjectionStore.getState().applyPerceivedEvent;
      mockPerception.onPerceived((event) => {
        applyPerceivedEvent(event);
      });

      void initAdapter("mock").then(async (adapter) => {
        // 1. Wire event handler FIRST so no events are lost
        unsubEvent = adapter.onEvent((event: string, payload: unknown) => {
          if (event === "agent") {
            processAgentEvent(payload as AgentEventPayload);
            mockPerception.ingest(payload as AgentEventPayload);
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
        setDebugWarnings(buildDebugWarnings(cfg));

        // 3. Init agents (triggers prefillLoungePlaceholders with correct maxSubAgents)
        const agentList = await adapter.agentsList() as AgentsListResponse;
        cacheAgentNames(agentList.agents);
        initAgents(agentList.agents);
        setOperatorScopes(["operator.admin"]);
        setConnectionStatus("connected");
      });
      return () => {
        unsubEvent?.();
        mockPerception.destroy();
        perceptionRef.current = null;
      };
    }

    const ws = new GatewayWsClient();
    const rpc = new GatewayRpcClient(ws);
    const throttle = new EventThrottle();
    const perception = new PerceptionEngine();

    wsRef.current = ws;
    rpcRef.current = rpc;
    throttleRef.current = throttle;
    perceptionRef.current = perception;

    // Perception Engine → ProjectionStore (Living Office 管道)
    const applyPerceivedEvent = useProjectionStore.getState().applyPerceivedEvent;
    perception.onPerceived((event) => {
      applyPerceivedEvent(event);
    });

    // 旧管道: EventThrottle → processAgentEvent (2D/3D Office 视图)
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
        initProjectionFromSnapshot(ws);
        const snapshot = ws.getSnapshot();
        const scopes = (snapshot as Record<string, unknown>)?.scopes;
        setOperatorScopes(Array.isArray(scopes) ? (scopes as string[]) : ["operator"]);

        void initAdapter("ws", { wsClient: ws, rpcClient: rpc });
        void fetchGatewayConfig(rpc, setMaxSubAgents, setAgentToAgentConfig, setDebugWarnings);
        void fetchAgentNamesAndUpdate(rpc, syncMainAgents);
      }
    });

    ws.onEvent("agent", (frame: GatewayEventFrame) => {
      const payload = frame.payload as AgentEventPayload;
      throttle.push(payload);
      perception.ingest(payload);
    });

    ws.onEvent("health", (frame: GatewayEventFrame) => {
      const health = frame.payload as HealthSnapshot;
      if (health?.agents) {
        const summaries = healthAgentsToSummaries(health);
        syncMainAgents(summaries);
      }
    });

    ws.connect(url, token);

    return () => {
      throttle.destroy();
      perception.destroy();
      ws.disconnect();
      wsRef.current = null;
      rpcRef.current = null;
      throttleRef.current = null;
      perceptionRef.current = null;
      setDebugWarnings([]);
    };
  }, [url, token, setConnectionStatus, initAgents, syncMainAgents, processAgentEvent, setOperatorScopes, setMaxSubAgents, setAgentToAgentConfig, setDebugWarnings]);

  useSubAgentPoller(rpcRef);
  useUsagePoller(rpcRef);

  return { wsClient: wsRef, rpcClient: rpcRef, perceptionEngine: perceptionRef };
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

function initProjectionFromSnapshot(ws: GatewayWsClient): void {
  const snapshot = ws.getSnapshot();
  const health = snapshot?.health as HealthSnapshot | undefined;
  if (health?.agents) {
    const batch = health.agents.map((a) => ({
      agentId: a.agentId,
      role: resolveAgentName(a.agentId),
      deskId: a.agentId,
    }));
    useProjectionStore.getState().initAgentsBatch(batch);
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
      const batch = result.agents.map((a) => ({
        agentId: a.id,
        role: a.identity?.name ?? a.name ?? a.id,
        deskId: a.id,
      }));
      useProjectionStore.getState().initAgentsBatch(batch);
    }
  } catch {
    // agents.list not available yet, snapshot data will be used
  }
}

async function fetchGatewayConfig(
  rpc: GatewayRpcClient,
  setMaxSubAgents: (n: number) => void,
  setAgentToAgentConfig: (config: { enabled: boolean; allow: string[] }) => void,
  setDebugWarnings: (warnings: string[]) => void,
): Promise<void> {
  try {
    const resp = await rpc.request<ConfigGetResponse>("config.get", {
      keys: ["agents.defaults.subagents", "tools.agentToAgent", "tools.sessions"],
    });
    const val = resp.value as Record<string, unknown> | undefined;
    if (!val) {
      setDebugWarnings([]);
      return;
    }

    const subagents = val["agents.defaults.subagents"] as
      | { maxConcurrent?: number }
      | undefined;
    if (subagents?.maxConcurrent && subagents.maxConcurrent >= 1 && subagents.maxConcurrent <= 50) {
      setMaxSubAgents(subagents.maxConcurrent);
    }

    const a2a = val["tools.agentToAgent"] as
      | { enabled?: boolean; allow?: string[] }
      | undefined;
    if (a2a) {
      setAgentToAgentConfig({
        enabled: a2a.enabled ?? false,
        allow: Array.isArray(a2a.allow) ? a2a.allow : [],
      });
    }

    setDebugWarnings(buildDebugWarnings(val));
  } catch {
    setDebugWarnings([]);
    // Gateway doesn't support config.get or permission denied — use defaults
  }
}

function buildDebugWarnings(config: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  const flattenedSessions = config["tools.sessions"] as { visibility?: string } | undefined;
  const tools = config.tools as Record<string, unknown> | undefined;
  const nestedSessions = tools?.sessions as { visibility?: string } | undefined;
  const visibility = flattenedSessions?.visibility ?? nestedSessions?.visibility;

  if (typeof visibility === "string" && visibility !== "all") {
    warnings.push(
      i18n.t("console:dashboard.alerts.sessionsVisibilityLimited", {
        visibility,
      }),
    );
  }

  return warnings;
}
