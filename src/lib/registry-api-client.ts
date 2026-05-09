/**
 * Registry API client for the local HQ sidecar.
 *
 * The "Setup GCP" console page uses this client to:
 *   - approve/reject pending pairing requests from new branch nodes (Tailscale)
 *   - manage GCP Secret Manager-backed notification channels (Telegram first)
 *   - broadcast notifications via the HQ notify endpoint
 *
 * Trust model:
 *   The HQ sidecar listens on the Tailscale tailnet (default
 *   `http://openclaw-hq:8781`). The trust boundary is the VPN itself: the
 *   sidecar validates the source identity server-side via `tailscale whois`.
 *   This client therefore intentionally has NO bearer token, NO Authorization
 *   header, and NO admin-credential plumbing. Putting a long-lived token in
 *   the browser bundle was a regression — the network is the perimeter.
 *
 * Configuration precedence (URL only):
 *   1. Runtime injection: window.__OPENCLAW_CONFIG__.registryApiUrl
 *      (mirrors the gateway pattern used in src/App.tsx)
 *   2. Build-time env: VITE_REGISTRY_API_URL
 *   3. Default: http://openclaw-hq:8781 (Tailscale hostname for HQ)
 */

// ---------- Types ----------

export type PairingStatus = "pending" | "approved" | "rejected" | "smoke_passed" | "smoke_failed";

export interface PairingRequest {
  id: number;
  branch_id: string;
  hostname: string;
  tailscale_ip: string;
  delegate_url: string;
  coordinator_agent_id: string;
  allowed_agents: string[];
  status: PairingStatus;
  delegation_token_fingerprint: string;
  metadata?: Record<string, unknown> | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface PairingApproveBody {
  decided_by: string;
}

export interface PairingRejectBody {
  decided_by: string;
  reason: string;
}

export interface PairingSmokeTestBody {
  delegation_token: string;
}

export interface PairingSmokeTestResult {
  ok: boolean;
  status?: string;
  http?: number;
  detail?: Record<string, unknown> | string | null;
}

export type ChannelKind = "telegram" | "discord" | "slack" | string;
export type ChannelScope = "admin" | "branch" | string;

export interface NotificationChannel {
  id: number;
  kind: ChannelKind;
  name: string;
  config: Record<string, unknown>;
  secret_ref: string | null;
  enabled: boolean;
  scope: ChannelScope;
  last_test_at: string | null;
  last_test_result: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateChannelBody {
  kind: ChannelKind;
  name: string;
  config: Record<string, unknown>;
  scope?: ChannelScope;
}

export interface UpdateChannelBody {
  config?: Record<string, unknown>;
  name?: string;
  enabled?: boolean;
}

export interface SetSecretBody {
  secret_value: string;
}

export interface ChannelTestBody {
  message?: string;
}

export interface ChannelTestResult {
  ok: boolean;
  http?: number;
  detail?: Record<string, unknown> | string | null;
}

export interface NotifyBroadcastBody {
  scope: string;
  text: string;
}

export interface NotifyBroadcastResult {
  ok: boolean;
  delivered?: number;
  detail?: Record<string, unknown> | string | null;
}

// ---------- OpenHands (LLM provider profiles) ----------

export type OpenHandsProvider =
  | "google"
  | "anthropic"
  | "openai"
  | "deepseek"
  | "minimax"
  | "ollama";

export interface OpenHandsProfile {
  id: number;
  provider: OpenHandsProvider;
  model: string;
  label: string;
  is_default: boolean;
  has_secret: boolean;
  last_test_at: string | null;
  last_test_result: Record<string, unknown> | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateOpenHandsProfileBody {
  provider: OpenHandsProvider;
  model: string;
  label: string;
}

export interface UpdateOpenHandsProfileBody {
  provider?: OpenHandsProvider;
  model?: string;
  label?: string;
}

export interface OpenHandsTestBody {
  prompt?: string;
}

export interface OpenHandsTestResult {
  ok: boolean;
  detail?: Record<string, unknown> | string | null;
  latency_ms?: number;
}

// ---------- Config resolution ----------

/**
 * Default base URL for the HQ sidecar on Tailscale. The sidecar listens on
 * the tailnet and uses `tailscale whois` for source identity — no bearer.
 */
export const DEFAULT_REGISTRY_API_URL = "http://openclaw-hq:8781";

interface RuntimeConfig {
  registryApiUrl?: string;
}

function readRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") return {};
  const injected = (window as unknown as Record<string, unknown>).__OPENCLAW_CONFIG__ as
    | RuntimeConfig
    | undefined;
  return injected ?? {};
}

export interface RegistryApiResolvedConfig {
  baseUrl: string;
  configured: boolean;
}

export function resolveRegistryApiConfig(): RegistryApiResolvedConfig {
  const runtime = readRuntimeConfig();
  const fromRuntime = (runtime.registryApiUrl ?? "").trim();
  const fromEnv = (
    (import.meta.env as unknown as Record<string, string | undefined>).VITE_REGISTRY_API_URL ?? ""
  ).trim();
  const baseUrl = (fromRuntime || fromEnv || DEFAULT_REGISTRY_API_URL).replace(/\/+$/u, "");
  return { baseUrl, configured: Boolean(baseUrl) };
}

// ---------- Errors ----------

export class RegistryApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "RegistryApiError";
    this.status = status;
    this.body = body;
  }
}

export class RegistryApiNotConfiguredError extends Error {
  constructor() {
    super(
      "Registry API base URL is empty. Set VITE_REGISTRY_API_URL or inject " +
        "window.__OPENCLAW_CONFIG__.registryApiUrl at runtime (default is " +
        `${DEFAULT_REGISTRY_API_URL}).`,
    );
    this.name = "RegistryApiNotConfiguredError";
  }
}

// ---------- HTTP core ----------

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { baseUrl, configured } = resolveRegistryApiConfig();
  if (!configured) throw new RegistryApiNotConfiguredError();

  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  // Trust boundary is the VPN — no Authorization header by design.
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail?: unknown }).detail)
        : null) ?? `Registry API ${res.status} on ${opts.method ?? "GET"} ${path}`;
    throw new RegistryApiError(res.status, message, payload);
  }

  return payload as T;
}

// ---------- Resource APIs ----------

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const pairing = {
  list: async (statusFilter: PairingStatus | "all" = "pending") => {
    const qs = statusFilter === "all" ? "" : `?status_filter=${encodeURIComponent(statusFilter)}`;
    // Sidecar returns `{requests: [...]}`. Tolerate plain-array fallback too.
    const raw = await request<{ requests?: PairingRequest[] } | PairingRequest[]>(
      `/v1/pairing/requests${qs}`
    );
    if (Array.isArray(raw)) return raw;
    return ensureArray<PairingRequest>(raw?.requests);
  },
  get: (id: number) => request<PairingRequest>(`/v1/pairing/requests/${id}`),
  approve: (id: number, body: PairingApproveBody) =>
    request<PairingRequest>(`/v1/pairing/requests/${id}/approve`, { method: "POST", body }),
  reject: (id: number, body: PairingRejectBody) =>
    request<PairingRequest>(`/v1/pairing/requests/${id}/reject`, { method: "POST", body }),
  smokeTest: (id: number, body: PairingSmokeTestBody) =>
    request<PairingSmokeTestResult>(`/v1/pairing/requests/${id}/smoke-test`, {
      method: "POST",
      body,
    }),
};

export const channels = {
  list: async () => {
    // Sidecar returns `{channels: [...]}`. Tolerate plain-array fallback too.
    const raw = await request<{ channels?: NotificationChannel[] } | NotificationChannel[]>(
      "/v1/channels"
    );
    if (Array.isArray(raw)) return raw;
    return ensureArray<NotificationChannel>(raw?.channels);
  },
  get: (id: number) => request<NotificationChannel>(`/v1/channels/${id}`),
  create: (body: CreateChannelBody) =>
    request<NotificationChannel>("/v1/channels", { method: "POST", body }),
  update: (id: number, body: UpdateChannelBody) =>
    request<NotificationChannel>(`/v1/channels/${id}`, { method: "PATCH", body }),
  delete: (id: number) => request<{ ok: boolean }>(`/v1/channels/${id}`, { method: "DELETE" }),
  setSecret: (id: number, body: SetSecretBody) =>
    request<NotificationChannel>(`/v1/channels/${id}/secret`, { method: "POST", body }),
  test: (id: number, body: ChannelTestBody = {}) =>
    request<ChannelTestResult>(`/v1/channels/${id}/test`, { method: "POST", body }),
};

export const notify = {
  broadcast: (body: NotifyBroadcastBody) =>
    request<NotifyBroadcastResult>("/v1/notify", { method: "POST", body }),
};

export const openhands = {
  profiles: {
    list: async () => {
      // Sidecar returns `{profiles: [...]}`. Tolerate plain-array fallback too.
      const raw = await request<{ profiles?: OpenHandsProfile[] } | OpenHandsProfile[]>(
        "/v1/openhands/profiles",
      );
      if (Array.isArray(raw)) return raw;
      return ensureArray<OpenHandsProfile>(raw?.profiles);
    },
    get: (id: number) => request<OpenHandsProfile>(`/v1/openhands/profiles/${id}`),
    create: (body: CreateOpenHandsProfileBody) =>
      request<OpenHandsProfile>("/v1/openhands/profiles", { method: "POST", body }),
    update: (id: number, body: UpdateOpenHandsProfileBody) =>
      request<OpenHandsProfile>(`/v1/openhands/profiles/${id}`, { method: "PATCH", body }),
    delete: (id: number) =>
      request<{ ok: boolean }>(`/v1/openhands/profiles/${id}`, { method: "DELETE" }),
    setSecret: (id: number, body: SetSecretBody) =>
      request<OpenHandsProfile>(`/v1/openhands/profiles/${id}/secret`, { method: "POST", body }),
    activate: (id: number) =>
      request<OpenHandsProfile>(`/v1/openhands/profiles/${id}/activate`, { method: "POST" }),
    test: (id: number, body: OpenHandsTestBody = {}) =>
      request<OpenHandsTestResult>(`/v1/openhands/profiles/${id}/test`, { method: "POST", body }),
  },
};

export const registryApiClient = {
  pairing,
  channels,
  notify,
  openhands,
  resolveConfig: resolveRegistryApiConfig,
};

export default registryApiClient;
