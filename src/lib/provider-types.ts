export const MODEL_APIS = [
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
  "anthropic-messages",
  "google-generative-ai",
  "github-copilot",
  "bedrock-converse-stream",
  "ollama",
] as const;

export type ModelApi = (typeof MODEL_APIS)[number];

export const MODEL_INPUT_TYPES = ["text", "image"] as const;
export type ModelInputType = (typeof MODEL_INPUT_TYPES)[number];

export const THINKING_FORMATS = ["openai", "zai", "qwen"] as const;
export type ThinkingFormat = (typeof THINKING_FORMATS)[number];

export const MAX_TOKENS_FIELDS = ["max_completion_tokens", "max_tokens"] as const;
export type MaxTokensField = (typeof MAX_TOKENS_FIELDS)[number];

export interface ModelCost {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ModelCompatConfig {
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  supportsUsageInStreaming?: boolean;
  supportsStrictMode?: boolean;
  maxTokensField?: MaxTokensField;
  thinkingFormat?: ThinkingFormat;
  requiresToolResultName?: boolean;
  requiresAssistantAfterToolResult?: boolean;
  requiresThinkingAsText?: boolean;
  requiresMistralToolIds?: boolean;
}

export interface ModelDefinitionConfig {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning?: boolean;
  input?: ModelInputType[];
  cost?: ModelCost;
  contextWindow?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  compat?: ModelCompatConfig;
}

export function createDefaultModel(): ModelDefinitionConfig {
  return {
    id: "",
    name: "",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

export interface ProviderTypeMeta {
  id: string;
  name: string;
  icon: string;
  defaultBaseUrl: string;
  defaultApi: ModelApi;
  requiresApiKey: boolean;
  placeholder?: string;
}

export const PROVIDER_TYPE_INFO: ProviderTypeMeta[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "🤖",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultApi: "anthropic-messages",
    requiresApiKey: true,
    placeholder: "sk-ant-...",
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "🧠",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultApi: "openai-responses",
    requiresApiKey: true,
    placeholder: "sk-...",
  },
  {
    id: "openai-codex",
    name: "OpenAI Codex",
    icon: "🧬",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultApi: "openai-codex-responses",
    requiresApiKey: false,
  },
  {
    id: "google",
    name: "Google AI",
    icon: "🔮",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    defaultApi: "google-generative-ai",
    requiresApiKey: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "🔀",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultApi: "openai-completions",
    requiresApiKey: true,
    placeholder: "sk-or-...",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "🔍",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultApi: "openai-completions",
    requiresApiKey: true,
    placeholder: "sk-...",
  },
  {
    id: "moonshot",
    name: "Moonshot (CN)",
    icon: "🌙",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultApi: "openai-completions",
    requiresApiKey: true,
    placeholder: "sk-...",
  },
  {
    id: "qwen",
    name: "通义千问 (CN)",
    icon: "🌐",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultApi: "openai-completions",
    requiresApiKey: true,
    placeholder: "sk-...",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow (CN)",
    icon: "⚡",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultApi: "openai-completions",
    requiresApiKey: true,
    placeholder: "sk-...",
  },
  {
    id: "ollama",
    name: "Ollama",
    icon: "🦙",
    defaultBaseUrl: "http://localhost:11434",
    defaultApi: "ollama",
    requiresApiKey: false,
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    icon: "☁️",
    defaultBaseUrl: "",
    defaultApi: "bedrock-converse-stream",
    requiresApiKey: false,
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    icon: "🐙",
    defaultBaseUrl: "",
    defaultApi: "github-copilot",
    requiresApiKey: false,
  },
  {
    id: "custom",
    name: "Custom",
    icon: "⚙️",
    defaultBaseUrl: "",
    defaultApi: "openai-completions",
    requiresApiKey: true,
  },
];

export function inferProviderType(
  providerId: string,
  api?: string,
  baseUrl?: string,
): ProviderTypeMeta {
  const byId = PROVIDER_TYPE_INFO.find((p) => p.id === providerId);
  if (byId) return byId;

  if (api) {
    const byApi = PROVIDER_TYPE_INFO.find((p) => p.defaultApi === api);
    if (byApi) return byApi;
  }

  if (baseUrl) {
    if (baseUrl.includes("anthropic.com")) return PROVIDER_TYPE_INFO[0];
    if (baseUrl.includes("openai.com")) return PROVIDER_TYPE_INFO[1];
    if (baseUrl.includes("googleapis.com")) return PROVIDER_TYPE_INFO[2];
    if (baseUrl.includes("openrouter.ai")) return PROVIDER_TYPE_INFO[3];
    if (baseUrl.includes("deepseek.com")) return PROVIDER_TYPE_INFO[4];
    if (baseUrl.includes("moonshot.cn")) return PROVIDER_TYPE_INFO[5];
    if (baseUrl.includes("dashscope.aliyuncs.com")) return PROVIDER_TYPE_INFO[6];
    if (baseUrl.includes("siliconflow.cn")) return PROVIDER_TYPE_INFO[7];
    if (baseUrl.includes("localhost:11434")) return PROVIDER_TYPE_INFO[8];
  }

  return PROVIDER_TYPE_INFO[PROVIDER_TYPE_INFO.length - 1];
}

export const REDACTED_SENTINEL = "__OPENCLAW_REDACTED__";

/** Parse raw config.models into typed ModelDefinitionConfig[] */
export function parseModels(raw: unknown): ModelDefinitionConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: Record<string, unknown>) => ({
    id: String(m.id ?? ""),
    name: String(m.name ?? ""),
    api: m.api as ModelApi | undefined,
    reasoning: m.reasoning === true,
    input: Array.isArray(m.input) ? (m.input as ModelInputType[]) : ["text"],
    cost: m.cost
      ? {
          input: Number((m.cost as Record<string, unknown>).input ?? 0),
          output: Number((m.cost as Record<string, unknown>).output ?? 0),
          cacheRead: Number((m.cost as Record<string, unknown>).cacheRead ?? 0),
          cacheWrite: Number((m.cost as Record<string, unknown>).cacheWrite ?? 0),
        }
      : undefined,
    contextWindow: typeof m.contextWindow === "number" ? m.contextWindow : undefined,
    maxTokens: typeof m.maxTokens === "number" ? m.maxTokens : undefined,
    compat: m.compat as ModelCompatConfig | undefined,
  }));
}

/** Serialize ModelDefinitionConfig to plain object for config.patch */
export function serializeModel(model: ModelDefinitionConfig): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    id: model.id,
    name: model.name,
    reasoning: model.reasoning ?? false,
    input: model.input ?? ["text"],
  };
  if (model.api) obj.api = model.api;
  if (model.cost) obj.cost = model.cost;
  if (model.contextWindow) obj.contextWindow = model.contextWindow;
  if (model.maxTokens) obj.maxTokens = model.maxTokens;
  if (model.compat) obj.compat = model.compat;
  if (model.headers) obj.headers = model.headers;
  return obj;
}
