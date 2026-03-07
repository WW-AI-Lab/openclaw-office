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

const MOCK_CHANNELS: ChannelInfo[] = [
  {
    id: "telegram:bot1",
    type: "telegram",
    name: "MyBot",
    status: "connected",
    accountId: "bot1",
    configured: true,
    linked: true,
    running: true,
    lastConnectedAt: Date.now() - 60_000,
  },
  {
    id: "discord:srv1",
    type: "discord",
    name: "Dev Server",
    status: "connected",
    accountId: "srv1",
    configured: true,
    linked: true,
    running: true,
    lastConnectedAt: Date.now() - 120_000,
  },
  {
    id: "whatsapp:wa1",
    type: "whatsapp",
    name: "WhatsApp",
    status: "disconnected",
    accountId: "wa1",
    configured: true,
    linked: false,
    running: false,
  },
  {
    id: "signal:sig1",
    type: "signal",
    name: "Signal",
    status: "error",
    accountId: "sig1",
    configured: true,
    linked: false,
    running: false,
    error: "Session expired",
  },
];

const MOCK_SKILLS: SkillInfo[] = [
  {
    id: "web-search",
    slug: "web-search",
    name: "Web Search",
    description: "搜索互联网获取实时信息",
    enabled: true,
    icon: "🔍",
    version: "1.0.0",
    isCore: true,
    isBundled: true,
    source: "core",
    always: true,
    eligible: true,
    requirements: { bins: ["curl"] },
    missing: { bins: [] },
    configChecks: [{ path: "SEARCH_API_KEY", satisfied: true }],
    primaryEnv: "SEARCH_API_KEY",
  },
  {
    id: "code-interpreter",
    slug: "code-interpreter",
    name: "Code Interpreter",
    description: "执行代码并返回结果",
    enabled: true,
    icon: "💻",
    version: "1.2.0",
    isCore: true,
    isBundled: true,
    source: "core",
    always: true,
    eligible: true,
  },
  {
    id: "file-editor",
    slug: "file-editor",
    name: "File Editor",
    description: "读写本地文件",
    enabled: true,
    icon: "📝",
    version: "1.0.0",
    isCore: true,
    isBundled: true,
    source: "core",
    always: true,
    eligible: true,
  },
  {
    id: "image-gen",
    slug: "image-gen",
    name: "Image Generation",
    description: "使用 AI 生成图片",
    enabled: true,
    icon: "🎨",
    version: "0.9.0",
    isBundled: false,
    source: "marketplace",
    eligible: true,
    installOptions: [{ id: "node", kind: "npm", label: "npm install" }],
    homepage: "https://github.com/openclaw/image-gen",
  },
  {
    id: "playwright",
    slug: "playwright",
    name: "Playwright",
    description: "浏览器自动化与测试",
    enabled: true,
    icon: "🎭",
    version: "1.1.0",
    isBundled: false,
    source: "marketplace",
    eligible: true,
    installOptions: [
      { id: "brew", kind: "brew", label: "Homebrew" },
      { id: "npm", kind: "npm", label: "npm install" },
    ],
    requirements: { bins: ["playwright"] },
    missing: { bins: [] },
  },
  {
    id: "voice-call",
    slug: "voice-call",
    name: "Voice Call",
    description: "语音通话技能",
    enabled: false,
    icon: "📞",
    version: "0.5.0",
    isBundled: false,
    source: "marketplace",
    eligible: false,
    blockedByAllowlist: true,
  },
];

const MOCK_CRON_TASKS: CronTask[] = [
  {
    id: "cron-1",
    name: "每日摘要",
    description: "每天下午6点生成工作摘要",
    schedule: { kind: "cron", expr: "0 18 * * *" },
    enabled: true,
    createdAtMs: Date.now() - 7 * 86400_000,
    updatedAtMs: Date.now() - 86400_000,
    sessionTarget: "main",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "生成今日工作摘要" },
    delivery: { mode: "notify", channel: "telegram", target: "bot1" },
    state: {
      lastRunAtMs: Date.now() - 86400_000,
      lastRunStatus: "ok",
      nextRunAtMs: Date.now() + 3600_000,
    },
  },
  {
    id: "cron-2",
    name: "周报提醒",
    description: "每周一早上9点发送周报提醒",
    schedule: { kind: "cron", expr: "0 9 * * 1" },
    enabled: false,
    createdAtMs: Date.now() - 14 * 86400_000,
    updatedAtMs: Date.now() - 3 * 86400_000,
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "请提交本周周报" },
    state: { lastRunAtMs: Date.now() - 7 * 86400_000, lastRunStatus: "ok" },
  },
  {
    id: "cron-3",
    name: "健康检查",
    schedule: { kind: "every", everyMs: 1800_000 },
    enabled: true,
    createdAtMs: Date.now() - 30 * 86400_000,
    updatedAtMs: Date.now(),
    sessionTarget: "main",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "执行系统健康检查" },
    state: {
      lastRunAtMs: Date.now() - 1200_000,
      lastRunStatus: "error",
      lastError: "Agent timeout",
      nextRunAtMs: Date.now() + 600_000,
    },
  },
];

const REDACTED = "__OPENCLAW_REDACTED__";

function mockConfigData(): Record<string, unknown> {
  return {
    models: {
      providers: {
        anthropic: {
          baseUrl: "https://api.anthropic.com",
          apiKey: REDACTED,
          api: "anthropic-messages",
          models: [
            {
              id: "claude-sonnet-4-20250514",
              name: "Claude Sonnet 4",
              reasoning: true,
              input: ["text", "image"],
              contextWindow: 200000,
              maxTokens: 16384,
            },
            {
              id: "claude-opus-4-20250514",
              name: "Claude Opus 4",
              reasoning: true,
              input: ["text", "image"],
              contextWindow: 200000,
              maxTokens: 32768,
            },
            {
              id: "claude-3-5-haiku-20241022",
              name: "Claude 3.5 Haiku",
              reasoning: false,
              input: ["text", "image"],
              contextWindow: 200000,
              maxTokens: 8192,
            },
          ],
        },
        openai: {
          baseUrl: "https://api.openai.com/v1",
          apiKey: REDACTED,
          api: "openai-responses",
          models: [
            {
              id: "gpt-4o",
              name: "GPT-4o",
              reasoning: false,
              input: ["text", "image"],
              contextWindow: 128000,
              maxTokens: 16384,
            },
            {
              id: "o3",
              name: "o3",
              reasoning: true,
              input: ["text", "image"],
              contextWindow: 200000,
              maxTokens: 100000,
            },
            {
              id: "gpt-4o-mini",
              name: "GPT-4o Mini",
              reasoning: false,
              input: ["text", "image"],
              contextWindow: 128000,
              maxTokens: 16384,
            },
          ],
        },
      },
    },
    agents: {
      defaults: {
        subagents: { maxConcurrent: 12, maxSpawnDepth: 2 },
      },
      list: [
        { id: "main", model: "anthropic/claude-sonnet-4-20250514" },
        { id: "ai-researcher", model: "anthropic/claude-opus-4-20250514" },
        { id: "coder", model: "anthropic/claude-sonnet-4-20250514" },
        { id: "ecommerce", model: "openai/gpt-4o" },
      ],
    },
    tools: {
      agentToAgent: { enabled: true, allow: ["main", "coder", "ai-researcher", "ecommerce"] },
    },
    update: { channel: "stable" },
    gateway: { auth: { token: REDACTED } },
  };
}

function deepMergePatch(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = deepMergePatch(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

class SubAgentSimulator {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private activeSubAgents = new Set<string>();
  private subCounter = 0;
  private running = false;

  constructor(
    private emit: (event: string, payload: unknown) => void,
    private maxConcurrent: number = 3,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNextSpawn(5000);
    this.scheduleAgentToAgentComm(20_000);
  }

  stop(): void {
    this.running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.activeSubAgents.clear();
  }

  private schedule(fn: () => void, ms: number): void {
    const t = setTimeout(fn, ms);
    this.timers.push(t);
  }

  private scheduleNextSpawn(delayMs: number): void {
    this.schedule(() => {
      if (!this.running) return;
      if (this.activeSubAgents.size < this.maxConcurrent) {
        this.spawnSubAgent();
      }
      this.scheduleNextSpawn(randRange(3000, 8000));
    }, delayMs);
  }

  private spawnSubAgent(): void {
    this.subCounter++;
    const subId = `mock-sub-${this.subCounter}`;
    const runId = `mock-run-sub-${this.subCounter}`;
    const sessionKey = `mock-session-sub-${this.subCounter}`;

    this.activeSubAgents.add(subId);

    // lifecycle start
    this.emit("agent", {
      runId,
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start", agentId: subId, parentAgentId: "main" },
      sessionKey,
    });

    // thinking phase
    this.schedule(() => {
      if (!this.running) return;
      this.emit("agent", {
        runId,
        seq: 2,
        stream: "assistant",
        ts: Date.now(),
        data: { text: `Sub-agent ${subId} 正在分析任务...` },
        sessionKey,
      });
    }, randRange(1000, 2000));

    // tool calling phase
    this.schedule(() => {
      if (!this.running) return;
      const tools = ["web_search", "code_exec", "file_read", "analyze_data"];
      const tool = tools[Math.floor(Math.random() * tools.length)];
      this.emit("agent", {
        runId,
        seq: 3,
        stream: "tool",
        ts: Date.now(),
        data: { name: tool, phase: "start" },
        sessionKey,
      });
    }, randRange(3000, 5000));

    // speaking phase
    this.schedule(() => {
      if (!this.running) return;
      this.emit("agent", {
        runId,
        seq: 4,
        stream: "assistant",
        ts: Date.now(),
        data: { text: `Sub-agent ${subId} 已完成任务分析。` },
        sessionKey,
      });
    }, randRange(6000, 9000));

    // lifecycle end
    const endDelay = randRange(8000, 15_000);
    this.schedule(() => {
      if (!this.running) return;
      this.emit("agent", {
        runId,
        seq: 5,
        stream: "lifecycle",
        ts: Date.now(),
        data: { phase: "end", agentId: subId },
        sessionKey,
      });
      this.activeSubAgents.delete(subId);
    }, endDelay);
  }

  private scheduleAgentToAgentComm(delayMs: number): void {
    this.schedule(() => {
      if (!this.running) return;
      const agents = ["main", "coder", "ai-researcher", "ecommerce"];
      const a = agents[Math.floor(Math.random() * agents.length)];
      let b = a;
      while (b === a) b = agents[Math.floor(Math.random() * agents.length)];

      const sessionKey = `a2a-${Date.now()}`;
      const runIdA = `a2a-run-${a}-${Date.now()}`;
      const runIdB = `a2a-run-${b}-${Date.now()}`;

      // Both agents start in the same session (triggers collaboration link)
      this.emit("agent", {
        runId: runIdA,
        seq: 1,
        stream: "lifecycle",
        ts: Date.now(),
        data: { phase: "start", agentId: a },
        sessionKey,
      });
      this.emit("agent", {
        runId: runIdB,
        seq: 1,
        stream: "lifecycle",
        ts: Date.now(),
        data: { phase: "start", agentId: b },
        sessionKey,
      });

      // End communication after some time
      const commDuration = randRange(10_000, 20_000);
      this.schedule(() => {
        if (!this.running) return;
        this.emit("agent", {
          runId: runIdA,
          seq: 2,
          stream: "lifecycle",
          ts: Date.now(),
          data: { phase: "end", agentId: a },
          sessionKey,
        });
        this.emit("agent", {
          runId: runIdB,
          seq: 2,
          stream: "lifecycle",
          ts: Date.now(),
          data: { phase: "end", agentId: b },
          sessionKey,
        });
      }, commDuration);

      this.scheduleAgentToAgentComm(randRange(15_000, 30_000));
    }, delayMs);
  }
}

export class MockAdapter implements GatewayAdapter {
  private handlers: Set<AdapterEventHandler> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];
  private mockConfig: Record<string, unknown> = mockConfigData();
  private mockHash = Date.now().toString(36);
  private subAgentSimulator: SubAgentSimulator | null = null;

  async connect(): Promise<void> {
    this.heartbeatTimer = setInterval(() => {
      for (const h of this.handlers) {
        h("heartbeat", { ts: Date.now() });
      }
    }, 30_000);

    // Start sub-agent simulator after connection
    this.subAgentSimulator = new SubAgentSimulator(
      (event, payload) => this.emit(event, payload),
      3,
    );
    this.subAgentSimulator.start();
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.subAgentSimulator?.stop();
    this.subAgentSimulator = null;
    this.cancelPendingTimers();
    this.handlers.clear();
  }

  onEvent(handler: AdapterEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private emit(event: string, payload: unknown): void {
    for (const h of this.handlers) {
      h(event, payload);
    }
  }

  private cancelPendingTimers(): void {
    for (const t of this.pendingTimers) {
      clearTimeout(t);
    }
    this.pendingTimers = [];
  }

  private scheduleTimer(fn: () => void, ms: number): void {
    const t = setTimeout(fn, ms);
    this.pendingTimers.push(t);
  }

  async chatHistory(): Promise<ChatMessage[]> {
    return [
      {
        id: "msg-hist-1",
        role: "user",
        content: "你好，请介绍一下 OpenClaw",
        timestamp: Date.now() - 120_000,
      },
      {
        id: "msg-hist-2",
        role: "assistant",
        content:
          "**OpenClaw** 是一个多 Agent 协作系统，支持：\n\n- 多渠道消息接入（Telegram、Discord、WhatsApp 等）\n- 工具调用和技能扩展\n- 定时任务调度\n- 实时可视化监控\n\n你可以通过 OpenClaw Office 观察 Agent 的协作行为。",
        timestamp: Date.now() - 110_000,
      },
    ];
  }

  async chatSend(params: ChatSendParams): Promise<void> {
    const runId = `mock-run-${Date.now()}`;
    const responseText = `收到你的消息：「${params.text}」\n\n这是 Mock 模式下的模拟回复。在连接真实 Gateway 后，这里将显示 Agent 的实际响应。`;

    // Simulate Gateway chat events: delta → delta → final
    this.scheduleTimer(() => {
      this.emit("chat", {
        type: "event",
        event: "chat",
        payload: {
          runId,
          state: "delta",
          message: {
            role: "assistant",
            content: responseText.slice(0, Math.floor(responseText.length / 2)),
          },
        },
      });
    }, 300);

    this.scheduleTimer(() => {
      this.emit("chat", {
        type: "event",
        event: "chat",
        payload: {
          runId,
          state: "delta",
          message: {
            role: "assistant",
            content: responseText,
          },
        },
      });
    }, 800);

    this.scheduleTimer(() => {
      this.emit("chat", {
        type: "event",
        event: "chat",
        payload: {
          runId,
          state: "final",
          message: {
            role: "assistant",
            content: responseText,
            id: `mock-msg-${Date.now()}`,
            stopReason: "end_turn",
          },
        },
      });
    }, 1200);
  }

  async chatAbort(_runId: string): Promise<void> {
    this.cancelPendingTimers();
    this.emit("chat", {
      type: "event",
      event: "chat",
      payload: { state: "aborted" },
    });
  }

  async sessionsList(): Promise<SessionInfo[]> {
    return [
      {
        key: "agent:main:main",
        agentId: "main",
        label: "默认会话",
        createdAt: Date.now() - 3600_000,
        lastActiveAt: Date.now(),
        messageCount: 12,
      },
      {
        key: "agent:main:feishu:direct:test-user",
        agentId: "main",
        label: "飞书会话",
        createdAt: Date.now() - 1800_000,
        lastActiveAt: Date.now() - 60_000,
        messageCount: 8,
      },
    ];
  }

  async sessionsPreview(sessionKey: string): Promise<SessionPreview> {
    return { key: sessionKey, messages: await this.chatHistory() };
  }

  async sessionsDelete(_sessionKey: string, _options?: { deleteTranscript?: boolean }): Promise<void> {
    return;
  }

  async channelsStatus(): Promise<ChannelInfo[]> {
    return [...MOCK_CHANNELS];
  }

  async skillsStatus(_agentId?: string): Promise<SkillInfo[]> {
    return [...MOCK_SKILLS];
  }

  async cronList(): Promise<CronTask[]> {
    return [...MOCK_CRON_TASKS];
  }

  async channelsLogout(_channel: string, _accountId?: string): Promise<{ cleared: boolean }> {
    return { cleared: true };
  }

  async webLoginStart(_force?: boolean): Promise<{ qrDataUrl?: string; message: string }> {
    return {
      qrDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      message: "Scan QR code with WhatsApp",
    };
  }

  async webLoginWait(): Promise<{ connected: boolean; message: string }> {
    await new Promise((r) => setTimeout(r, 2000));
    return { connected: true, message: "WhatsApp connected successfully" };
  }

  async skillsInstall(_name: string, _installId: string): Promise<SkillInstallResult> {
    return {
      ok: true,
      message: "Mock install completed",
      stdout: "mock: skill installed successfully",
      code: 0,
    };
  }

  async skillsUpdate(_skillKey: string, _patch: SkillUpdatePatch): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async cronAdd(input: CronTaskInput): Promise<CronTask> {
    const now = Date.now();
    return {
      id: `cron-${now}`,
      name: input.name,
      description: input.description,
      schedule: input.schedule,
      enabled: input.enabled ?? true,
      createdAtMs: now,
      updatedAtMs: now,
      sessionTarget: input.sessionTarget,
      wakeMode: input.wakeMode,
      payload: input.payload,
      delivery: input.delivery,
      agentId: input.agentId,
      sessionKey: input.sessionKey,
      state: {},
    };
  }

  async cronUpdate(id: string, patch: Partial<CronTaskInput>): Promise<CronTask> {
    const existing = MOCK_CRON_TASKS.find((t) => t.id === id);
    if (!existing) throw new Error(`Cron task not found: ${id}`);
    return { ...existing, ...patch, updatedAtMs: Date.now() };
  }

  async cronRemove(_id: string): Promise<void> {}

  async cronRun(_id: string): Promise<void> {}

  async agentsList(): Promise<AgentsListResponse> {
    return {
      defaultId: "main",
      mainKey: "agent:main:main",
      scope: "global",
      agents: [
        { id: "main", name: "main", default: true, identity: { name: "main", emoji: "m" } },
        {
          id: "ai-researcher",
          name: "ResearchClaw",
          identity: { name: "ResearchClaw", emoji: "🔬" },
        },
        { id: "coder", name: "CodeClaw", identity: { name: "CodeClaw", emoji: "💻" } },
        { id: "ecommerce", name: "TradeClaw", identity: { name: "TradeClaw", emoji: "🛒" } },
      ],
    };
  }

  async agentsCreate(params: AgentCreateParams): Promise<AgentCreateResult> {
    return {
      ok: true,
      agentId: `agent-${Date.now()}`,
      name: params.name,
      workspace: params.workspace,
    };
  }

  async agentsUpdate(params: AgentUpdateParams): Promise<AgentUpdateResult> {
    return { ok: true, agentId: params.agentId };
  }

  async agentsDelete(params: AgentDeleteParams): Promise<AgentDeleteResult> {
    return { ok: true, agentId: params.agentId, removedBindings: 0 };
  }

  async agentsFilesList(_agentId: string): Promise<AgentFilesListResult> {
    const now = new Date().toISOString();
    return {
      agentId: _agentId,
      workspace: `~/.openclaw/workspace`,
      files: [
        { name: "AGENTS.md", size: 7900, modifiedAt: now },
        { name: "SOUL.md", size: 2048, modifiedAt: now },
        { name: "TOOLS.md", size: 860, modifiedAt: now },
        { name: "IDENTITY.md", size: 759, modifiedAt: now },
        { name: "USER.md", size: 1800, modifiedAt: now },
        { name: "HEARTBEAT.md", size: 512, modifiedAt: now },
      ],
    };
  }

  async agentsFilesGet(agentId: string, name: string): Promise<AgentFileContent> {
    return {
      agentId,
      workspace: `~/.openclaw/workspace`,
      file: {
        name,
        content: `# ${name}\n\nMock content for ${name}`,
        size: 128,
        modifiedAt: new Date().toISOString(),
      },
    };
  }

  async agentsFilesSet(
    agentId: string,
    name: string,
    content: string,
  ): Promise<AgentFileSetResult> {
    return {
      ok: true,
      agentId,
      workspace: `~/.openclaw/workspace`,
      file: { name, size: content.length, modifiedAt: new Date().toISOString() },
    };
  }

  async toolsCatalog(_agentId?: string): Promise<ToolCatalog> {
    return {
      tools: [
        { name: "web_search", description: "搜索互联网", source: "built-in", group: "core", enabled: true },
        { name: "code_exec", description: "执行代码", source: "built-in", group: "core", enabled: true },
        { name: "file_read", description: "读取文件内容", source: "built-in", group: "fs", enabled: true },
        { name: "file_write", description: "写入文件", source: "built-in", group: "fs", enabled: true },
        { name: "bash", description: "执行 Bash 命令", source: "built-in", group: "exec", enabled: true, optional: true },
        { name: "mcp_client", description: "MCP 协议客户端", source: "plugin", group: "integrations", enabled: false, optional: true },
      ],
    };
  }

  async usageStatus(): Promise<UsageInfo> {
    return {
      updatedAt: Date.now(),
      providers: [
        {
          provider: "anthropic",
          displayName: "Anthropic",
          plan: "pro",
          windows: [
            { label: "daily", usedPercent: 45, resetAt: Date.now() + 12 * 3600_000 },
            { label: "monthly", usedPercent: 22 },
          ],
        },
        {
          provider: "openai",
          displayName: "OpenAI",
          plan: "tier-3",
          windows: [{ label: "daily", usedPercent: 12 }],
        },
      ],
    };
  }

  async modelsList(): Promise<ModelCatalogEntry[]> {
    return [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        provider: "anthropic",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200000,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        provider: "anthropic",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200000,
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        reasoning: false,
        input: ["text", "image"],
        contextWindow: 128000,
      },
      {
        id: "o3",
        name: "o3",
        provider: "openai",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200000,
      },
      {
        id: "gpt-5.3-codex",
        name: "gpt-5.3-codex",
        provider: "openai-codex",
        reasoning: true,
        input: ["text"],
        contextWindow: 1048576,
      },
      {
        id: "gpt-5.3-codex-spark",
        name: "gpt-5.3-codex-spark",
        provider: "openai-codex",
        reasoning: true,
        input: ["text"],
        contextWindow: 1048576,
      },
      {
        id: "gpt-5.1-codex",
        name: "gpt-5.1-codex",
        provider: "openai-codex",
        reasoning: true,
        input: ["text"],
        contextWindow: 200000,
      },
    ];
  }

  async configGet(): Promise<ConfigSnapshot> {
    return {
      config: this.mockConfig,
      hash: this.mockHash,
      raw: JSON.stringify(this.mockConfig, null, 2),
      valid: true,
      path: "~/.openclaw/openclaw.json",
    };
  }

  async configSet(raw: string, baseHash?: string): Promise<ConfigWriteResult> {
    if (baseHash && baseHash !== this.mockHash) {
      return {
        ok: false,
        path: "~/.openclaw/openclaw.json",
        config: this.mockConfig,
        error: "config changed since last load; re-run config.get and retry",
      };
    }
    this.mockConfig = JSON.parse(raw) as Record<string, unknown>;
    this.mockHash = Date.now().toString(36);
    return {
      ok: true,
      path: "~/.openclaw/openclaw.json",
      config: this.mockConfig,
    };
  }

  async configApply(
    raw: string,
    baseHash?: string,
    _params?: { sessionKey?: string; note?: string; restartDelayMs?: number },
  ): Promise<ConfigWriteResult> {
    if (baseHash && baseHash !== this.mockHash) {
      return {
        ok: false,
        path: "~/.openclaw/openclaw.json",
        config: this.mockConfig,
        error: "config changed since last load; re-run config.get and retry",
      };
    }
    this.mockConfig = JSON.parse(raw) as Record<string, unknown>;
    this.mockHash = Date.now().toString(36);
    return {
      ok: true,
      path: "~/.openclaw/openclaw.json",
      config: this.mockConfig,
      restart: { scheduled: true, delayMs: 2000 },
    };
  }

  async configPatch(raw: string, baseHash?: string): Promise<ConfigPatchResult> {
    if (baseHash && baseHash !== this.mockHash) {
      return {
        ok: false,
        config: this.mockConfig,
        error: "config changed since last load; re-run config.get and retry",
      };
    }
    const patch = JSON.parse(raw) as Record<string, unknown>;
    this.mockConfig = deepMergePatch(this.mockConfig, patch);
    this.mockHash = Date.now().toString(36);
    return { ok: true, config: this.mockConfig, restart: { scheduled: true, delayMs: 2000 } };
  }

  async configSchema(): Promise<ConfigSchemaResponse> {
    return {
      schema: {},
      uiHints: {
        "models.providers.*.apiKey": { sensitive: true, label: "API Key" },
        "gateway.auth.token": { sensitive: true, label: "Gateway Token" },
      },
      version: "mock",
    };
  }

  async statusSummary(): Promise<StatusSummary> {
    return {
      version: "2026.2.27-mock",
      port: 18789,
      uptime: 86400,
      mode: "local",
      pid: 12345,
      nodeVersion: "v22.0.0",
      platform: "darwin",
    };
  }

  async updateRun(_params?: { restartDelayMs?: number }): Promise<UpdateRunResult> {
    return {
      ok: true,
      result: {
        status: "noop",
        mode: "npm",
        reason: "already up to date",
        steps: [],
        durationMs: 1200,
      },
      restart: null,
    };
  }
}
