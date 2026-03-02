import type { GatewayAdapter, AdapterEventHandler, SkillUpdatePatch } from "./adapter";
import type {
  AgentCreateParams,
  AgentCreateResult,
  AgentDeleteParams,
  AgentDeleteResult,
  AgentFileContent,
  AgentFilesListResult,
  AgentFileSetResult,
  AgentUpdateParams,
  AgentUpdateResult,
  ChannelInfo,
  ChannelType,
  ChatMessage,
  ChatSendParams,
  ConfigPatchResult,
  ConfigSchemaResponse,
  ConfigSnapshot,
  CronTask,
  CronTaskInput,
  ModelCatalogEntry,
  SessionInfo,
  SessionPreview,
  SkillInfo,
  SkillInstallResult,
  StatusSummary,
  ToolCatalog,
  UpdateRunResult,
  UsageInfo,
} from "./adapter-types";
import type { GatewayRpcClient } from "./rpc-client";
import type { AgentsListResponse } from "./types";
import type { GatewayWsClient } from "./ws-client";

export class WsAdapter implements GatewayAdapter {
  private handlers: Set<AdapterEventHandler> = new Set();
  private unsubscribers: Array<() => void> = [];

  constructor(
    private wsClient: GatewayWsClient,
    private rpcClient: GatewayRpcClient,
  ) {}

  private static readonly WATCHED_EVENTS = [
    "agent",
    "chat",
    "presence",
    "health",
    "heartbeat",
    "cron",
    "shutdown",
  ] as const;

  async connect(): Promise<void> {
    for (const eventName of WsAdapter.WATCHED_EVENTS) {
      const unsub = this.wsClient.onEvent(eventName, (payload: unknown) => {
        for (const h of this.handlers) {
          h(eventName, payload);
        }
      });
      this.unsubscribers.push(unsub);
    }
  }

  disconnect(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.handlers.clear();
  }

  onEvent(handler: AdapterEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async chatHistory(sessionKey?: string): Promise<ChatMessage[]> {
    return this.rpcClient.request<ChatMessage[]>("chat.history", sessionKey ? { sessionKey } : {});
  }

  async chatSend(params: ChatSendParams): Promise<void> {
    await this.rpcClient.request("chat.send", {
      sessionKey: params.sessionKey,
      message: params.text,
      deliver: false,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  async chatAbort(sessionKeyOrRunId: string): Promise<void> {
    await this.rpcClient.request("chat.abort", { sessionKey: sessionKeyOrRunId });
  }

  async sessionsList(): Promise<SessionInfo[]> {
    return this.rpcClient.request<SessionInfo[]>("sessions.list");
  }

  async sessionsPreview(sessionKey: string): Promise<SessionPreview> {
    return this.rpcClient.request<SessionPreview>("sessions.preview", { sessionKey });
  }

  async channelsStatus(): Promise<ChannelInfo[]> {
    const result = await this.rpcClient.request<GatewayChannelsStatusResult>("channels.status", {
      probe: true,
    });
    return flattenChannelAccounts(result);
  }

  async channelsLogout(channel: string, accountId?: string): Promise<{ cleared: boolean }> {
    return this.rpcClient.request<{ cleared: boolean }>("channels.logout", { channel, accountId });
  }

  async webLoginStart(force?: boolean): Promise<{ qrDataUrl?: string; message: string }> {
    return this.rpcClient.request<{ qrDataUrl?: string; message: string }>("web.login.start", {
      force,
    });
  }

  async webLoginWait(): Promise<{ connected: boolean; message: string }> {
    return this.rpcClient.request<{ connected: boolean; message: string }>("web.login.wait");
  }

  async skillsStatus(): Promise<SkillInfo[]> {
    const result = await this.rpcClient.request<GatewaySkillsStatusResult>("skills.status");
    return mapSkillEntries(result.skills ?? []);
  }

  async skillsInstall(name: string, installId: string): Promise<SkillInstallResult> {
    return this.rpcClient.request<SkillInstallResult>("skills.install", { name, installId });
  }

  async skillsUpdate(skillKey: string, patch: SkillUpdatePatch): Promise<{ ok: boolean }> {
    return this.rpcClient.request<{ ok: boolean }>("skills.update", { skillKey, ...patch });
  }

  async cronList(): Promise<CronTask[]> {
    const result = await this.rpcClient.request<{ jobs?: CronTask[]; total?: number }>("cron.list");
    return result.jobs ?? [];
  }

  async cronAdd(input: CronTaskInput): Promise<CronTask> {
    return this.rpcClient.request<CronTask>(
      "cron.add",
      input as unknown as Record<string, unknown>,
    );
  }

  async cronUpdate(id: string, patch: Partial<CronTaskInput>): Promise<CronTask> {
    return this.rpcClient.request<CronTask>("cron.update", { id, patch });
  }

  async cronRemove(id: string): Promise<void> {
    await this.rpcClient.request("cron.remove", { id });
  }

  async cronRun(id: string): Promise<void> {
    await this.rpcClient.request("cron.run", { id });
  }

  async agentsList(): Promise<AgentsListResponse> {
    return this.rpcClient.request<AgentsListResponse>("agents.list");
  }

  async agentsCreate(params: AgentCreateParams): Promise<AgentCreateResult> {
    return this.rpcClient.request<AgentCreateResult>(
      "agents.create",
      params as unknown as Record<string, unknown>,
    );
  }

  async agentsUpdate(params: AgentUpdateParams): Promise<AgentUpdateResult> {
    return this.rpcClient.request<AgentUpdateResult>(
      "agents.update",
      params as unknown as Record<string, unknown>,
    );
  }

  async agentsDelete(params: AgentDeleteParams): Promise<AgentDeleteResult> {
    return this.rpcClient.request<AgentDeleteResult>(
      "agents.delete",
      params as unknown as Record<string, unknown>,
    );
  }

  async agentsFilesList(agentId: string): Promise<AgentFilesListResult> {
    return this.rpcClient.request<AgentFilesListResult>("agents.files.list", { agentId });
  }

  async agentsFilesGet(agentId: string, name: string): Promise<AgentFileContent> {
    return this.rpcClient.request<AgentFileContent>("agents.files.get", { agentId, name });
  }

  async agentsFilesSet(
    agentId: string,
    name: string,
    content: string,
  ): Promise<AgentFileSetResult> {
    return this.rpcClient.request<AgentFileSetResult>("agents.files.set", {
      agentId,
      name,
      content,
    });
  }

  async toolsCatalog(): Promise<ToolCatalog> {
    return this.rpcClient.request<ToolCatalog>("tools.catalog");
  }

  async usageStatus(): Promise<UsageInfo> {
    return this.rpcClient.request<UsageInfo>("usage.status");
  }

  async modelsList(): Promise<ModelCatalogEntry[]> {
    const result = await this.rpcClient.request<{ models: ModelCatalogEntry[] }>("models.list");
    return result.models ?? [];
  }

  async configGet(): Promise<ConfigSnapshot> {
    return this.rpcClient.request<ConfigSnapshot>("config.get");
  }

  async configPatch(raw: string, baseHash?: string): Promise<ConfigPatchResult> {
    return this.rpcClient.request<ConfigPatchResult>("config.patch", {
      raw,
      ...(baseHash ? { baseHash } : {}),
    });
  }

  async configSchema(): Promise<ConfigSchemaResponse> {
    return this.rpcClient.request<ConfigSchemaResponse>("config.schema");
  }

  async statusSummary(): Promise<StatusSummary> {
    const snapshot = this.wsClient.getSnapshot();
    const serverInfo = this.wsClient.getServerInfo();
    return {
      version: serverInfo?.version,
      port: 18789,
      uptime: snapshot?.uptimeMs != null ? Math.floor(snapshot.uptimeMs / 1000) : undefined,
      mode: "local",
      configPath: snapshot?.configPath,
    };
  }

  async updateRun(params?: { restartDelayMs?: number }): Promise<UpdateRunResult> {
    return this.rpcClient.request<UpdateRunResult>("update.run", params ?? {});
  }
}

// --- Gateway raw response types for domain mapping ---

interface GatewayChannelAccountSnapshot {
  accountId?: string;
  name?: string;
  connected?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  lastConnectedAt?: number | null;
  lastMessageAt?: number | null;
  reconnectAttempts?: number;
  mode?: string;
  error?: string;
  lastError?: string | null;
}

interface GatewayChannelsStatusResult {
  channelAccounts?: Record<string, GatewayChannelAccountSnapshot[]>;
  channelLabels?: Record<string, string>;
}

function deriveChannelStatus(snap: GatewayChannelAccountSnapshot): ChannelInfo["status"] {
  const error = snap.error ?? snap.lastError ?? undefined;
  if (error) return "error";

  if (snap.connected === true) return "connected";
  if (snap.connected === false) return snap.running ? "connecting" : "disconnected";

  // Gateway snapshots can omit `connected` for some channel implementations.
  // In that case we infer "connected" from a healthy linked+configured+running runtime.
  if (snap.running && snap.linked !== false && snap.configured !== false) {
    return "connected";
  }
  if (snap.running) return "connecting";
  return "disconnected";
}

function flattenChannelAccounts(result: GatewayChannelsStatusResult): ChannelInfo[] {
  const accounts = result.channelAccounts ?? {};
  const labels = result.channelLabels ?? {};
  const channels: ChannelInfo[] = [];

  for (const [channelType, snapshots] of Object.entries(accounts)) {
    for (const snap of snapshots) {
      if (!snap.accountId && snapshots.length === 0) continue;
      channels.push({
        id: snap.accountId ? `${channelType}:${snap.accountId}` : channelType,
        type: channelType as ChannelType,
        name: snap.name ?? labels[channelType] ?? channelType,
        status: deriveChannelStatus(snap),
        accountId: snap.accountId,
        error: snap.error ?? snap.lastError ?? undefined,
        configured: snap.configured,
        linked: snap.linked,
        running: snap.running,
        lastConnectedAt: snap.lastConnectedAt,
        lastMessageAt: snap.lastMessageAt,
        reconnectAttempts: snap.reconnectAttempts,
        mode: snap.mode,
      });
    }
  }

  return channels;
}

// --- Skills mapping ---

interface GatewaySkillEntry {
  skillKey?: string;
  name?: string;
  description?: string;
  disabled?: boolean;
  bundled?: boolean;
  core?: boolean;
  emoji?: string;
  version?: string;
  author?: string;
  source?: string;
  homepage?: string;
  primaryEnv?: string;
  always?: boolean;
  eligible?: boolean;
  blockedByAllowlist?: boolean;
  requirements?: { bins?: string[]; env?: string[] };
  missing?: { bins?: string[]; env?: string[] };
  install?: Array<{ id: string; kind: string; label: string }>;
  configChecks?: Array<{ path: string; satisfied: boolean }>;
  config?: Record<string, unknown>;
}

interface GatewaySkillsStatusResult {
  skills?: GatewaySkillEntry[];
}

function mapSkillEntries(entries: GatewaySkillEntry[]): SkillInfo[] {
  return entries.map((e) => ({
    id: e.skillKey ?? "",
    slug: e.skillKey ?? "",
    name: e.name ?? e.skillKey ?? "",
    description: e.description ?? "",
    enabled: !e.disabled,
    icon: e.emoji ?? "📦",
    version: e.version ?? "",
    author: e.author,
    isCore: e.core,
    isBundled: e.bundled,
    config: e.config,
    source: e.source,
    homepage: e.homepage,
    primaryEnv: e.primaryEnv,
    always: e.always,
    eligible: e.eligible,
    blockedByAllowlist: e.blockedByAllowlist,
    requirements: e.requirements,
    missing: e.missing,
    installOptions: e.install,
    configChecks: e.configChecks,
  }));
}
