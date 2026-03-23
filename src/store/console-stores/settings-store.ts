import { create } from "zustand";
import {
  coerceRemotePathToRoot,
  FIXED_REMOTE_WORKSPACE_ROOT,
  isRemotePathWithinRoot,
} from "@/lib/remote-path-utils";

type ThemePreference = "light" | "dark" | "system";
export type AgentPathSettingKey =
  | "hostLabel"
  | "codeDirectory"
  | "serverDirectory"
  | "codeOutputDirectory"
  | "resourceOutputDirectory";

export interface AgentPathSettings {
  hostLabel: string;
  codeDirectory: string;
  serverDirectory: string;
  codeOutputDirectory: string;
  resourceOutputDirectory: string;
}

const THEME_KEY = "openclaw-console-theme";
const LANG_KEY = "openclaw-console-lang";
const DEV_MODE_KEY = "openclaw-console-dev-mode";
const MAIN_AUTOMATION_KEY = "openclaw-main-auto-orchestration";
const HOST_LABEL_KEY = "openclaw-agent-host-label";
const CODE_DIRECTORY_KEY = "openclaw-agent-code-directory";
const SERVER_DIRECTORY_KEY = "openclaw-agent-server-directory";
const CODE_OUTPUT_DIRECTORY_KEY = "openclaw-agent-output-directory";
const RESOURCE_OUTPUT_DIRECTORY_KEY = "openclaw-agent-resource-output-directory";
const LEGACY_LOCAL_AGENT_PATH_VALUES = new Set([
  "E:\\AnimalOpenClaw\\openclaw-office",
  "E:\\AnimalOpenClaw\\openclaw-gateway",
  "E:\\AnimalOpenClaw\\openclaw-office\\dist",
]);

function readLocal(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function readLocalBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const val = localStorage.getItem(key);
  if (val === null) return fallback;
  return val === "true";
}

function getDefaultAgentHostLabel(): string {
  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL;
  if (!gatewayUrl) return "";

  try {
    const parsed = new URL(gatewayUrl);
    return parsed.host;
  } catch {
    return gatewayUrl
      .replace(/^wss?:\/\//, "")
      .replace(/\/+$/, "");
  }
}

function normalizeAgentPathValue(key: AgentPathSettingKey, value: string): string {
  const trimmed = value.trim();
  if (key === "hostLabel") return trimmed;
  if (LEGACY_LOCAL_AGENT_PATH_VALUES.has(trimmed)) {
    return "";
  }
  const normalizedWorkspaceRoot = FIXED_REMOTE_WORKSPACE_ROOT.replace(/\/+$/, "");
  if (
    trimmed.startsWith(`${normalizedWorkspaceRoot}/home/`) ||
    trimmed.startsWith(`${normalizedWorkspaceRoot}/Users/`) ||
    /^[a-zA-Z]:/.test(trimmed)
  ) {
    return "";
  }
  if (
    trimmed &&
    /^(~\/|\/|[a-zA-Z]:[\\/])/.test(trimmed) &&
    !isRemotePathWithinRoot(trimmed, FIXED_REMOTE_WORKSPACE_ROOT)
  ) {
    return "";
  }
  return coerceRemotePathToRoot(trimmed, FIXED_REMOTE_WORKSPACE_ROOT);
}

function readAgentPathSetting(key: AgentPathSettingKey, fallback: string): string {
  const storageKey = AGENT_PATH_STORAGE_KEYS[key];
  const rawValue = readLocal(storageKey, fallback);
  const normalizedValue = normalizeAgentPathValue(key, rawValue || fallback);

  if (typeof window !== "undefined" && normalizedValue !== rawValue) {
    localStorage.setItem(storageKey, normalizedValue);
  }

  return normalizedValue;
}

interface ConsoleSettingsState {
  theme: ThemePreference;
  language: string;
  devModeUnlocked: boolean;
  mainAutomationEnabled: boolean;
  agentPaths: AgentPathSettings;

  setTheme: (theme: ThemePreference) => void;
  setLanguage: (lang: string) => void;
  setDevModeUnlocked: (v: boolean) => void;
  setMainAutomationEnabled: (enabled: boolean) => void;
  setAgentPath: (key: AgentPathSettingKey, value: string) => void;
}

const AGENT_PATH_STORAGE_KEYS: Record<AgentPathSettingKey, string> = {
  hostLabel: HOST_LABEL_KEY,
  codeDirectory: CODE_DIRECTORY_KEY,
  serverDirectory: SERVER_DIRECTORY_KEY,
  codeOutputDirectory: CODE_OUTPUT_DIRECTORY_KEY,
  resourceOutputDirectory: RESOURCE_OUTPUT_DIRECTORY_KEY,
};

export const useConsoleSettingsStore = create<ConsoleSettingsState>((set) => ({
  theme: readLocal(THEME_KEY, "system") as ThemePreference,
  language: readLocal(LANG_KEY, "zh"),
  devModeUnlocked: readLocalBool(DEV_MODE_KEY, false),
  mainAutomationEnabled: readLocalBool(MAIN_AUTOMATION_KEY, true),
  agentPaths: {
    hostLabel: readAgentPathSetting("hostLabel", getDefaultAgentHostLabel()),
    codeDirectory: readAgentPathSetting("codeDirectory", ""),
    serverDirectory: readAgentPathSetting("serverDirectory", ""),
    codeOutputDirectory: readAgentPathSetting("codeOutputDirectory", ""),
    resourceOutputDirectory: readAgentPathSetting("resourceOutputDirectory", ""),
  },

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },

  setLanguage: (language) => {
    localStorage.setItem(LANG_KEY, language);
    set({ language });
  },

  setDevModeUnlocked: (devModeUnlocked) => {
    localStorage.setItem(DEV_MODE_KEY, String(devModeUnlocked));
    set({ devModeUnlocked });
  },

  setMainAutomationEnabled: (mainAutomationEnabled) => {
    localStorage.setItem(MAIN_AUTOMATION_KEY, String(mainAutomationEnabled));
    set({ mainAutomationEnabled });
  },

  setAgentPath: (key, value) => {
    const nextValue = normalizeAgentPathValue(key, value);
    const fallbackHostLabel = getDefaultAgentHostLabel();
    const effectiveValue = key === "hostLabel" && !nextValue ? fallbackHostLabel : nextValue;

    if (key === "hostLabel" && !nextValue) {
      localStorage.removeItem(AGENT_PATH_STORAGE_KEYS[key]);
    } else {
      localStorage.setItem(AGENT_PATH_STORAGE_KEYS[key], effectiveValue);
    }

    set((state) => ({
      agentPaths: {
        ...state.agentPaths,
        [key]: effectiveValue,
      },
    }));
  },
}));
