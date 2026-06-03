import { useEffect, useRef } from "react";
import { initAdapter, isMockMode } from "@/gateway/adapter-provider";
import { applySecurityConfigOnce } from "@/store/console-stores/config-store";
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
import { useAuthStore } from "@/store/auth-store";
import { useOfficeStore } from "@/store/office-store";
import { useSubAgentPoller } from "./useSubAgentPoller";
import { useUsagePoller } from "./useUsagePoller";

interface UseGatewayConnectionOptions {
  /** Resolved WebSocket URL for the configured/default Gateway endpoint. */
  url: string;
  token: string;
}

function resolveGatewayWsUrl(pathOrUrl: string, fallbackUrl: string): string {
  const value = (pathOrUrl || "").trim();
  if (value.startsWith("ws://") || value.startsWith("wss://")) {
    return value;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const url = new URL(value);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }
  if (value.startsWith("/") && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${value}`;
  }
  return fallbackUrl;
}

export function useGatewayConnection({ url: fallbackUrl }: UseGatewayConnectionOptions) {
  const wsRef = useRef<GatewayWsClient | null>(null);
  const rpcRef = useRef<GatewayRpcClient | null>(null);
  const throttleRef = useRef<EventThrottle | null>(null);

  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const token = useAuthStore((s) => s.token);
  const password = useAuthStore((s) => s.password);
  const authStatus = useAuthStore((s) => s.authStatus);
  const markAuthenticated = useAuthStore((s) => s.markAuthenticated);
  const markAuthFailed = useAuthStore((s) => s.markAuthFailed);
  // Both "authenticating" and "authenticated" should keep the socket open, so
  // the authenticating -> authenticated transition must NOT tear it down.
  const shouldConnect = authStatus !== "unauthenticated";
  // Mirror authStatus into a ref so the long-lived ws.onStatusChange
  // callback (registered inside the connect effect) can read the *current*
  // status without re-subscribing on every auth-state change. We only want
  // to bounce the user back to the login form on errors that happen while
  // we are still in the "authenticating" phase, not on transient errors
  // after they are already in.
  const authStatusRef = useRef(authStatus);
  authStatusRef.current = authStatus;

  const setConnectionStatus = useOfficeStore((s) => s.setConnectionStatus);
  const initAgents = useOfficeStore((s) => s.initAgents);
  const syncMainAgents = useOfficeStore((s) => s.syncMainAgents);
  const processAgentEvent = useOfficeStore((s) => s.processAgentEvent);
  const setOperatorScopes = useOfficeStore((s) => s.setOperatorScopes);
  const setMaxSubAgents = useOfficeStore((s) => s.setMaxSubAgents);
  const setAgentToAgentConfig = useOfficeStore((s) => s.setAgentToAgentConfig);

  useEffect(() => {
    if (isMockMode()) {
      let unsubEvent: (() => void) | null = null;

      void initAdapter("mock").then(async (adapter) => {
        unsubEvent = adapter.onEvent((event: string, payload: unknown) => {
          if (event === "agent") {
            processAgentEvent(payload as AgentEventPayload);
          }
        });

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

        const agentList = await adapter.agentsList() as AgentsListResponse;
        cacheAgentNames(agentList.agents);
        initAgents(agentList.agents);
        setOperatorScopes(["operator.admin", "operator.read"]);
        setConnectionStatus("connected");
      });

      return () => {
        unsubEvent?.();
      };
    }

    if (!shouldConnect) {
      setConnectionStatus("disconnected");
      return;
    }

    const resolvedUrl = resolveGatewayWsUrl(gatewayUrl, fallbackUrl);
    if (!resolvedUrl) {
      return;
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
        markAuthenticated();
        initAgentsFromSnapshot(ws, initAgents);
        const authScopes = ws.getAuthInfo()?.scopes;
        setOperatorScopes(Array.isArray(authScopes) ? authScopes : ["operator.admin", "operator.read"]);

        void initAdapter("ws", { wsClient: ws, rpcClient: rpc });
        void fetchGatewayConfig(rpc, setMaxSubAgents, setAgentToAgentConfig);
        void fetchAgentNamesAndUpdate(rpc, syncMainAgents);
        void applySecurityConfigOnce();
      } else if (status === "error" && authStatusRef.current === "authenticating") {
        // The first connect attempt was rejected (bad URL, wrong token,
        // protocol mismatch, network refused, …). Send the user back to
        // the login form so it becomes interactive again. Without this
        // path, any non-auth error would leave the UI stuck on
        // "连接中..." with the submit button disabled.
        markAuthFailed(error ?? null);
      } else if (status === "disconnected" && authStatusRef.current === "authenticating") {
        // ws-client gave up after MAX_RECONNECT_ATTEMPTS without ever
        // reaching "connected". Same as above: return control to the
        // login form so the user can correct their input and retry.
        markAuthFailed(error ?? null);
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

    ws.connect(resolvedUrl, token, password);

    return () => {
      throttle.destroy();
      ws.disconnect();
      wsRef.current = null;
      rpcRef.current = null;
      throttleRef.current = null;
    };
  }, [
    gatewayUrl,
    fallbackUrl,
    token,
    password,
    shouldConnect,
    markAuthenticated,
    markAuthFailed,
    setConnectionStatus,
    initAgents,
    syncMainAgents,
    processAgentEvent,
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
  if (!health?.agents) {
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
