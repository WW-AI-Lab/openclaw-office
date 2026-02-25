// Gateway WebSocket 协议类型定义
// 基于 OpenClaw Gateway 源码（protocol v3）对齐

// --- 请求/响应帧 ---

export interface GatewayRequest {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponseOk<T = unknown> {
  type: "res";
  id: string;
  ok: true;
  payload: T;
}

export interface GatewayResponseError {
  type: "res";
  id: string;
  ok: false;
  error: ErrorShape;
}

export type GatewayResponseFrame<T = unknown> =
  | GatewayResponseOk<T>
  | GatewayResponseError;

export interface GatewayEventFrame<T = unknown> {
  type: "event";
  event: string;
  payload: T;
}

export type GatewayFrame =
  | GatewayRequest
  | GatewayResponseFrame
  | GatewayEventFrame;

// --- 认证 ---

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  caps: string[];
  scopes?: string[];
  auth?: {
    token: string;
  };
}

export interface HealthAgentInfo {
  agentId: string;
  isDefault?: boolean;
  heartbeat?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
}

export interface HealthSnapshot {
  ok: boolean;
  ts: number;
  agents?: HealthAgentInfo[];
  defaultAgentId?: string;
  channels?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
}

export interface HelloOk {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    connId?: string;
  };
  features?: Record<string, unknown>;
  snapshot?: {
    presence?: unknown;
    health?: HealthSnapshot;
    sessionDefaults?: unknown;
  };
  policy?: Record<string, unknown>;
}

// --- Agent 事件 ---

export type AgentStream = "lifecycle" | "tool" | "assistant" | "error";

export interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: AgentStream;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
}

// --- 可视化状态 ---

export type AgentVisualStatus =
  | "idle"
  | "thinking"
  | "tool_calling"
  | "speaking"
  | "spawning"
  | "error"
  | "offline";

export interface ToolInfo {
  name: string;
  args?: Record<string, unknown>;
  startedAt: number;
}

export interface SpeechBubble {
  text: string;
  timestamp: number;
}

export interface VisualAgent {
  id: string;
  name: string;
  status: AgentVisualStatus;
  position: { x: number; y: number };
  currentTool: ToolInfo | null;
  speechBubble: SpeechBubble | null;
  lastActiveAt: number;
  toolCallCount: number;
  toolCallHistory: ToolCallRecord[];
  runId: string | null;
  isSubAgent: boolean;
}

export interface ToolCallRecord {
  name: string;
  timestamp: number;
}

export interface CollaborationLink {
  sourceId: string;
  targetId: string;
  sessionKey: string;
  strength: number;
  lastActivityAt: number;
}

export interface EventHistoryItem {
  timestamp: number;
  agentId: string;
  agentName: string;
  stream: AgentStream;
  summary: string;
}

// --- 全局指标 ---

export interface GlobalMetrics {
  activeAgents: number;
  totalAgents: number;
  totalTokens: number;
  tokenRate: number;
  collaborationHeat: number;
}

// --- 连接状态 ---

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

// --- Store ---

export type ViewMode = "2d" | "3d";

export interface OfficeStore {
  agents: Map<string, VisualAgent>;
  links: CollaborationLink[];
  globalMetrics: GlobalMetrics;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  selectedAgentId: string | null;
  viewMode: ViewMode;
  eventHistory: EventHistoryItem[];
  sidebarCollapsed: boolean;

  // runId → agentId 映射
  runIdMap: Map<string, string>;
  // sessionKey → agentId[] 映射
  sessionKeyMap: Map<string, string[]>;

  // Agent CRUD
  addAgent: (agent: VisualAgent) => void;
  updateAgent: (id: string, patch: Partial<VisualAgent>) => void;
  removeAgent: (id: string) => void;
  initAgents: (agents: AgentSummary[]) => void;

  // 事件处理
  processAgentEvent: (event: AgentEventPayload) => void;

  // UI actions
  selectAgent: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 指标
  updateMetrics: () => void;
}

// --- 错误 ---

export interface ErrorShape {
  code: string;
  message: string;
  retryable?: boolean;
  retryAfterMs?: number;
}

// --- RPC 数据 ---

export interface AgentSummary {
  id: string;
  name: string;
  identity?: {
    name?: string;
  };
}

export interface AgentsListResponse {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: AgentSummary[];
}
