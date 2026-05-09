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

export type GatewayResponseFrame<T = unknown> = GatewayResponseOk<T> | GatewayResponseError;

export interface GatewayEventFrame<T = unknown> {
  type: "event";
  event: string;
  payload: T;
}

export type GatewayFrame = GatewayRequest | GatewayResponseFrame | GatewayEventFrame;

// --- 认证 ---

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  role?: string;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  caps: string[];
  scopes?: string[];
  auth?: {
    token?: string;
    deviceToken?: string;
  };
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce: string;
  };
  userAgent?: string;
  locale?: string;
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
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  snapshot?: {
    presence?: unknown;
    health?: HealthSnapshot;
    sessionDefaults?: unknown;
    uptimeMs?: number;
    configPath?: string;
    stateDir?: string;
    authMode?: string;
  };
  policy?: Record<string, unknown>;
}

// --- Agent 事件 ---

export type AgentStream =
  | "lifecycle"
  | "tool"
  | "assistant"
  | "error"
  | "item"
  | "plan"
  | "approval"
  | "command_output"
  | "patch"
  | "thinking"
  | "compaction"
  | (string & {});

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

export type AgentZone = "desk" | "meeting" | "hotDesk" | "lounge" | "corridor";

export interface MovementState {
  path: Array<{ x: number; y: number }>;
  progress: number;
  duration: number;
  startTime: number;
  fromZone: AgentZone;
  toZone: AgentZone;
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
  isPlaceholder: boolean;
  parentAgentId: string | null;
  childAgentIds: string[];
  zone: AgentZone;
  originalPosition: { x: number; y: number } | null;
  movement: MovementState | null;
  confirmed: boolean;
  /** Timestamp when this sub-agent arrived at hotDesk zone (for minimum stay enforcement) */
  arrivedAtHotDeskAt: number | null;
  /** Whether lifecycle end has been received but retirement is deferred */
  pendingRetire: boolean;
  /** Timestamp when this agent arrived at meeting zone (for minimum 10s stay enforcement) */
  arrivedAtMeetingAt: number | null;
  /** Whether this agent was manually moved to meeting zone (won't be auto-returned by gathering) */
  manualMeeting: boolean;
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
  /** 是否是 peer agent 直接指派产生的链接（通过 A2A 工具事件检测到） */
  isPeer?: boolean;
}

export interface EventHistoryItem {
  timestamp: number;
  agentId: string;
  agentName: string;
  stream: AgentStream;
  summary: string;
  /** 所属 run 的 ID，用于合并同一 run 的流式 assistant 事件 */
  runId?: string;
  /** assistant 流式输出的完整累积文本，供展开详情时显示 */
  fullText?: string;
  /** item 流的 itemId，用于按追踪项合并 item 事件 */
  itemId?: string;
}

// --- Sub-Agent 轮询 ---

export interface SubAgentInfo {
  sessionKey: string;
  agentId: string;
  label: string;
  task: string;
  requesterSessionKey: string;
  startedAt: number;
}

export interface SessionSnapshot {
  sessions: SubAgentInfo[];
  fetchedAt: number;
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

// --- 配置感知 ---

export interface AgentToAgentConfig {
  enabled: boolean;
  allow: string[];
}

// --- Store ---

export type ThemeMode = "light" | "dark";
export type PageId =
  | "office"
  | "chat"
  | "dashboard"
  | "agents"
  | "channels"
  | "skills"
  | "cron"
  | "settings"
  | "setupGcp";

export interface TokenSnapshot {
  timestamp: number;
  total: number;
  byAgent: Record<string, number>;
}

export interface OfficeStore {
  agents: Map<string, VisualAgent>;
  links: CollaborationLink[];
  globalMetrics: GlobalMetrics;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  selectedAgentId: string | null;
  eventHistory: EventHistoryItem[];
  sidebarCollapsed: boolean;
  lastSessionsSnapshot: SessionSnapshot | null;
  theme: ThemeMode;
  operatorScopes: string[];
  tokenHistory: TokenSnapshot[];
  agentCosts: Record<string, number>;
  currentPage: PageId;
  chatDockHeight: number;

  // 配置感知
  maxSubAgents: number;
  agentToAgentConfig: AgentToAgentConfig;

  // runId → agentId 映射
  runIdMap: Map<string, string>;
  // sessionKey → agentId[] 映射
  sessionKeyMap: Map<string, string[]>;

  // Agent CRUD
  addAgent: (agent: VisualAgent) => void;
  updateAgent: (id: string, patch: Partial<VisualAgent>) => void;
  removeAgent: (id: string) => void;
  initAgents: (agents: AgentSummary[]) => void;
  syncMainAgents: (agents: AgentSummary[]) => void;

  // Sub-Agent 管理
  addSubAgent: (parentId: string, info: SubAgentInfo) => void;
  removeSubAgent: (subAgentId: string) => void;
  retireSubAgent: (subAgentId: string) => void;

  // 会议区位置管理
  moveToMeeting: (agentId: string, meetingPosition: { x: number; y: number }) => void;
  returnFromMeeting: (agentId: string) => void;

  // 手动会议 API
  requestMeeting: (agentIds: string[]) => void;
  dismissMeeting: (agentIds?: string[]) => void;

  // 行走动画
  startMovement: (agentId: string, toZone: AgentZone, targetPos?: { x: number; y: number }) => void;
  tickMovement: (agentId: string, deltaTime: number) => void;
  completeMovement: (agentId: string) => void;

  // Agent 确认（unconfirmed → confirmed）
  confirmAgent: (agentId: string, role: "main" | "sub", parentId?: string) => void;

  // 休息区预填充
  prefillLoungePlaceholders: (count: number) => void;

  // Sessions 轮询
  setSessionsSnapshot: (snapshot: SessionSnapshot) => void;

  // 事件处理
  processAgentEvent: (event: AgentEventPayload) => void;
  deferredSetIdle: (agentId: string) => void;
  initEventHistory: () => Promise<void>;

  // UI actions
  selectAgent: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: ThemeMode) => void;

  // 配置感知
  setMaxSubAgents: (n: number) => void;
  setAgentToAgentConfig: (config: AgentToAgentConfig) => void;

  // Scopes & Metrics
  setOperatorScopes: (scopes: string[]) => void;
  pushTokenSnapshot: (snapshot: TokenSnapshot) => void;
  setAgentCosts: (costs: Record<string, number>) => void;
  setCurrentPage: (page: PageId) => void;
  setChatDockHeight: (height: number) => void;

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
  default?: boolean;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
}

export interface AgentsListResponse {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: AgentSummary[];
}
