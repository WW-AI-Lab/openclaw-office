// Gateway Adapter 统一接口
// 提供 mock 与 gateway（WebSocket）两种实现

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
  ChatMessage,
  ChatSendParams,
  ConfigPatchResult,
  ConfigSchemaResponse,
  ConfigSnapshot,
  ConfigWriteResult,
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
import type { AgentsListResponse } from "./types";

export type AdapterEventHandler = (event: string, payload: unknown) => void;

export interface SkillUpdatePatch {
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
}

export interface GatewayAdapter {
  connect(): Promise<void>;
  disconnect(): void;
  onEvent(handler: AdapterEventHandler): () => void;

  // Chat
  chatHistory(sessionKey?: string): Promise<ChatMessage[]>;
  chatSend(params: ChatSendParams): Promise<void>;
  chatAbort(sessionKeyOrRunId: string): Promise<void>;

  // Sessions
  sessionsList(): Promise<SessionInfo[]>;
  sessionsPreview(sessionKey: string): Promise<SessionPreview>;
  sessionsDelete(sessionKey: string, options?: { deleteTranscript?: boolean }): Promise<void>;

  // Channels
  channelsStatus(): Promise<ChannelInfo[]>;
  channelsLogout(channel: string, accountId?: string): Promise<{ cleared: boolean }>;
  webLoginStart(force?: boolean): Promise<{ qrDataUrl?: string; message: string }>;
  webLoginWait(): Promise<{ connected: boolean; message: string }>;

  // Skills
  skillsStatus(agentId?: string): Promise<SkillInfo[]>;
  skillsInstall(name: string, installId: string): Promise<SkillInstallResult>;
  skillsUpdate(skillKey: string, patch: SkillUpdatePatch): Promise<{ ok: boolean }>;

  // Cron
  cronList(): Promise<CronTask[]>;
  cronAdd(input: CronTaskInput): Promise<CronTask>;
  cronUpdate(id: string, patch: Partial<CronTaskInput>): Promise<CronTask>;
  cronRemove(id: string): Promise<void>;
  cronRun(id: string): Promise<void>;

  // Agents & Tools
  agentsList(): Promise<AgentsListResponse>;
  agentsCreate(params: AgentCreateParams): Promise<AgentCreateResult>;
  agentsUpdate(params: AgentUpdateParams): Promise<AgentUpdateResult>;
  agentsDelete(params: AgentDeleteParams): Promise<AgentDeleteResult>;
  agentsFilesList(agentId: string): Promise<AgentFilesListResult>;
  agentsFilesGet(agentId: string, name: string): Promise<AgentFileContent>;
  agentsFilesSet(agentId: string, name: string, content: string): Promise<AgentFileSetResult>;
  toolsCatalog(agentId?: string): Promise<ToolCatalog>;
  usageStatus(): Promise<UsageInfo>;

  // Models catalog (from pi-ai SDK auto-discovery)
  modelsList(): Promise<ModelCatalogEntry[]>;

  // Config / Status / Update (Phase D)
  configGet(): Promise<ConfigSnapshot>;
  configSet(raw: string, baseHash?: string): Promise<ConfigWriteResult>;
  configApply(
    raw: string,
    baseHash?: string,
    params?: { sessionKey?: string; note?: string; restartDelayMs?: number },
  ): Promise<ConfigWriteResult>;
  configPatch(raw: string, baseHash?: string): Promise<ConfigPatchResult>;
  configSchema(): Promise<ConfigSchemaResponse>;
  statusSummary(): Promise<StatusSummary>;
  updateRun(params?: { restartDelayMs?: number }): Promise<UpdateRunResult>;
}
