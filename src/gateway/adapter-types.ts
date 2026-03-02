// Gateway Adapter 数据类型
// 基于 ClawX 类型定义，去除 Electron IPC 依赖

export type ChannelType =
  | "whatsapp"
  | "telegram"
  | "discord"
  | "signal"
  | "feishu"
  | "imessage"
  | "matrix"
  | "line"
  | "msteams"
  | "googlechat"
  | "mattermost";

export type ChannelStatus = "connected" | "disconnected" | "connecting" | "error";

export interface ChannelInfo {
  id: string;
  type: ChannelType;
  name: string;
  status: ChannelStatus;
  accountId?: string;
  error?: string;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  lastConnectedAt?: number | null;
  lastMessageAt?: number | null;
  reconnectAttempts?: number;
  mode?: string;
}

export interface SkillInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
  version: string;
  author?: string;
  isCore?: boolean;
  isBundled?: boolean;
  config?: Record<string, unknown>;
  source?: string;
  homepage?: string;
  primaryEnv?: string;
  always?: boolean;
  eligible?: boolean;
  blockedByAllowlist?: boolean;
  requirements?: { bins?: string[]; env?: string[] };
  missing?: { bins?: string[]; env?: string[] };
  installOptions?: Array<{ id: string; kind: string; label: string }>;
  configChecks?: Array<{ path: string; satisfied: boolean }>;
}

export interface CronJobTarget {
  channelType: ChannelType;
  channelId: string;
  channelName: string;
}

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | { kind: "agentTurn"; message: string }
  | {
      kind: "webhook";
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };

export interface CronDelivery {
  mode: "none" | "notify" | "webhook";
  channel?: string;
  target?: string;
}

export interface CronJobState {
  nextRunAtMs?: number | null;
  lastRunAtMs?: number | null;
  lastRunStatus?: "ok" | "error" | "skipped" | null;
  lastError?: string | null;
  runningAtMs?: number | null;
}

export interface CronTask {
  id: string;
  name: string;
  description?: string;
  schedule: CronSchedule;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  agentId?: string;
  sessionKey?: string;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: CronPayload;
  delivery?: CronDelivery;
  state: CronJobState;
}

export interface CronTaskInput {
  name: string;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: CronPayload;
  description?: string;
  enabled?: boolean;
  delivery?: CronDelivery;
  agentId?: string;
  sessionKey?: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  runId?: string;
  toolCalls?: ToolCallInfo[];
  thinking?: string;
  isStreaming?: boolean;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "done" | "error";
}

export interface ChatSendParams {
  text: string;
  sessionKey?: string;
  attachments?: string[];
}

export interface GatewayChatSendParams {
  sessionKey?: string;
  message: string;
  deliver?: boolean;
  idempotencyKey?: string;
}

export interface SessionInfo {
  key: string;
  agentId: string;
  label: string;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
}

export interface SessionPreview {
  key: string;
  messages: ChatMessage[];
}

export interface ToolCatalogEntry {
  name: string;
  description: string;
  schema?: Record<string, unknown>;
}

export interface ToolCatalog {
  tools: ToolCatalogEntry[];
}

export interface UsageProviderWindow {
  label: string;
  usedPercent: number;
  resetAt?: number;
}

export interface UsageProviderInfo {
  provider: string;
  displayName: string;
  plan?: string;
  windows: UsageProviderWindow[];
  error?: string;
}

export interface UsageInfo {
  updatedAt: number;
  providers: UsageProviderInfo[];
}

export interface SkillInstallResult {
  ok: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  code?: number | null;
  warnings?: string[];
}

// Streaming 事件类型（chat 事件的 payload 格式）
export type ChatStreamEvent =
  | { type: "stream.start"; runId: string; sessionKey?: string }
  | { type: "stream.delta"; runId: string; text: string }
  | { type: "stream.end"; runId: string; aborted?: boolean };

// --- Agent CRUD types ---

export interface AgentCreateParams {
  name: string;
  workspace: string;
  emoji?: string;
  avatar?: string;
}

export interface AgentCreateResult {
  ok: boolean;
  agentId: string;
  name: string;
  workspace: string;
}

export type AgentModelConfig = string | { primary?: string; fallbacks?: string[] };

export interface AgentUpdateParams {
  agentId: string;
  name?: string;
  workspace?: string;
  model?: AgentModelConfig;
  avatar?: string;
}

export interface AgentUpdateResult {
  ok: boolean;
  agentId: string;
}

export interface AgentDeleteParams {
  agentId: string;
  deleteFiles?: boolean;
}

export interface AgentDeleteResult {
  ok: boolean;
  agentId: string;
  removedBindings?: number;
}

export interface AgentFileInfo {
  name: string;
  size: number;
  modifiedAt: string | number;
}

export interface AgentFilesListResult {
  agentId: string;
  workspace: string;
  files: AgentFileInfo[];
}

export interface AgentFileContent {
  agentId: string;
  workspace: string;
  file: {
    name: string;
    content: string;
    size: number;
    modifiedAt: string;
  };
}

export interface AgentFileSetResult {
  ok: boolean;
  agentId: string;
  workspace: string;
  file: {
    name: string;
    size: number;
    modifiedAt: string;
  };
}

// --- Config / Status / Update types (Phase D) ---

export interface ConfigSnapshot {
  config: Record<string, unknown>;
  hash?: string;
  raw?: string | null;
  valid: boolean;
  path?: string;
  issues?: Array<{ path: string; message: string }>;
}

export interface ConfigPatchResult {
  ok: boolean;
  config: Record<string, unknown>;
  restart?: {
    scheduled: boolean;
    delayMs: number;
    coalesced?: boolean;
  };
  error?: string;
}

export interface ConfigUiHint {
  label?: string;
  help?: string;
  sensitive?: boolean;
  placeholder?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  tags?: string[];
}

export interface ConfigSchemaResponse {
  schema: unknown;
  uiHints: Record<string, ConfigUiHint>;
  version: string;
}

export interface StatusSummary {
  version?: string;
  port?: number;
  uptime?: number;
  mode?: string;
  pid?: number;
  nodeVersion?: string;
  platform?: string;
  [key: string]: unknown;
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
}

export interface UpdateRunResult {
  ok: boolean;
  result: {
    status: "ok" | "error" | "noop";
    mode: string;
    before?: string | null;
    after?: string | null;
    reason?: string | null;
    steps: Array<{
      name: string;
      command: string;
      durationMs: number;
    }>;
    durationMs: number;
  };
  restart?: {
    scheduled: boolean;
    delayMs: number;
  } | null;
}
