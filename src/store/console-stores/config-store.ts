import { create } from "zustand";
import { waitForAdapter } from "@/gateway/adapter-provider";
import type {
  ConfigPatchResult,
  ConfigSchemaResponse,
  ConfigSnapshot,
  ConfigWriteResult,
  ModelCatalogEntry,
  StatusSummary,
  UpdateRunResult,
} from "@/gateway/adapter-types";

export interface RestartState {
  status: "pending" | "disconnected" | "reconnecting" | "complete";
  startedAt: number;
  estimatedDelayMs: number;
}

export type ConfigLifecycleStatus =
  | "effective-now"
  | "saved-hot-reload"
  | "saved-restart-required"
  | "saved-cli-restart-required"
  | "apply-restarting"
  | "disconnected"
  | "reconnecting"
  | "complete";

export interface ConfigLifecycleState {
  status: ConfigLifecycleStatus;
  source: "runtime" | "save" | "apply" | "cli";
  startedAt: number;
  estimatedDelayMs?: number;
  command?: string;
  messageKey?: string;
}

interface ConfigStoreState {
  config: Record<string, unknown> | null;
  hash: string | null;
  configPath: string | null;
  configRaw: string | null;
  configValid: boolean;
  loading: boolean;
  error: string | null;

  schemaHints: ConfigSchemaResponse | null;

  status: StatusSummary | null;
  statusLoading: boolean;
  statusError: string | null;

  updateResult: UpdateRunResult | null;
  updateLoading: boolean;

  catalogModels: ModelCatalogEntry[];
  catalogLoading: boolean;

  restartState: RestartState | null;
  lifecycleState: ConfigLifecycleState | null;
  setRestartPending: (delayMs: number) => void;
  setRestartReconnecting: () => void;
  setRestartComplete: () => void;
  clearRestart: () => void;
  setLifecycleState: (state: ConfigLifecycleState | null) => void;
  setLifecycleFromWriteResult: (
    result: ConfigWriteResult,
    source: "save" | "apply",
    fallbackCommand?: string,
  ) => void;
  setRuntimeApplied: (messageKey?: string) => void;
  setLifecycleDisconnected: () => void;
  setLifecycleReconnecting: () => void;
  setLifecycleComplete: () => void;
  clearLifecycle: () => void;

  fetchConfig: () => Promise<void>;
  saveConfig: (
    updater: (config: Record<string, unknown>) => Record<string, unknown>,
    options?: { fallbackCommand?: string },
  ) => Promise<ConfigWriteResult>;
  applyConfig: (
    updater: (config: Record<string, unknown>) => Record<string, unknown>,
    params?: { sessionKey?: string; note?: string; restartDelayMs?: number },
  ) => Promise<ConfigWriteResult>;
  patchConfig: (patch: Record<string, unknown>) => Promise<ConfigPatchResult>;
  fetchSchema: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  fetchCatalogModels: () => Promise<void>;
  runUpdate: (params?: { restartDelayMs?: number }) => Promise<UpdateRunResult>;
}

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  config: null,
  hash: null,
  configPath: null,
  configRaw: null,
  configValid: true,
  loading: false,
  error: null,

  schemaHints: null,

  status: null,
  statusLoading: false,
  statusError: null,

  updateResult: null,
  updateLoading: false,

  catalogModels: [],
  catalogLoading: false,

  restartState: null,
  lifecycleState: null,

  setRestartPending: (delayMs) =>
    set({
      restartState: { status: "pending", startedAt: Date.now(), estimatedDelayMs: delayMs },
    }),

  setRestartReconnecting: () =>
    set((s) => {
      if (!s.restartState) return {};
      return { restartState: { ...s.restartState, status: "reconnecting" } };
    }),

  setRestartComplete: () =>
    set((s) => {
      if (!s.restartState) return {};
      return { restartState: { ...s.restartState, status: "complete" } };
    }),

  clearRestart: () => set({ restartState: null }),

  setLifecycleState: (lifecycleState) => set({ lifecycleState }),

  setLifecycleFromWriteResult: (result, source, fallbackCommand) => {
    const startedAt = Date.now();
    if (result.restart?.scheduled) {
      set({
        lifecycleState: {
          status: source === "apply" ? "apply-restarting" : "saved-restart-required",
          source,
          startedAt,
          estimatedDelayMs: result.restart.delayMs,
        },
        restartState:
          source === "apply"
            ? {
                status: "pending",
                startedAt,
                estimatedDelayMs: result.restart.delayMs,
              }
            : null,
      });
      return;
    }

    set({
      lifecycleState: fallbackCommand
        ? {
            status: "saved-cli-restart-required",
            source: "cli",
            startedAt,
            command: fallbackCommand,
          }
        : {
            status: "saved-hot-reload",
            source,
            startedAt,
          },
      restartState: null,
    });
  },

  setRuntimeApplied: (messageKey) =>
    set({
      lifecycleState: {
        status: "effective-now",
        source: "runtime",
        startedAt: Date.now(),
        messageKey,
      },
      restartState: null,
    }),

  setLifecycleDisconnected: () =>
    set((s) => {
      if (!s.lifecycleState) return {};
      return {
        lifecycleState: { ...s.lifecycleState, status: "disconnected" },
        restartState: s.restartState ? { ...s.restartState, status: "disconnected" } : s.restartState,
      };
    }),

  setLifecycleReconnecting: () =>
    set((s) => {
      if (!s.lifecycleState) return {};
      return {
        lifecycleState: { ...s.lifecycleState, status: "reconnecting" },
        restartState: s.restartState ? { ...s.restartState, status: "reconnecting" } : s.restartState,
      };
    }),

  setLifecycleComplete: () =>
    set((s) => {
      if (!s.lifecycleState) return {};
      return {
        lifecycleState: { ...s.lifecycleState, status: "complete" },
        restartState: s.restartState ? { ...s.restartState, status: "complete" } : s.restartState,
      };
    }),

  clearLifecycle: () => set({ lifecycleState: null, restartState: null }),

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const adapter = await waitForAdapter();
      const snap: ConfigSnapshot = await adapter.configGet();
      set({
        config: snap.config,
        hash: snap.hash ?? null,
        configPath: snap.path ?? null,
        configRaw: snap.raw ?? null,
        configValid: snap.valid,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  saveConfig: async (updater, options) => {
    const currentConfig = get().config;
    const hash = get().hash ?? undefined;
    if (!currentConfig) {
      return {
        ok: false,
        config: {},
        error: "config not loaded",
      };
    }

    try {
      const adapter = await waitForAdapter();
      const nextConfig = updater(structuredClone(currentConfig));
      const result = await adapter.configSet(JSON.stringify(nextConfig), hash);
      if (result.ok) {
        set({
          config: result.config,
          error: null,
        });
        get().setLifecycleFromWriteResult(
          result,
          "save",
          options?.fallbackCommand,
        );
        await get().fetchConfig();
      } else {
        const errMsg = result.error ?? "config set failed";
        set({ error: errMsg });
        if (errMsg.includes("config changed")) {
          await get().fetchConfig();
        }
      }
      return result;
    } catch (err) {
      const errMsg = String(err);
      set({ error: errMsg });
      return {
        ok: false,
        config: currentConfig,
        error: errMsg,
      };
    }
  },

  applyConfig: async (updater, params) => {
    const currentConfig = get().config;
    const hash = get().hash ?? undefined;
    if (!currentConfig) {
      return {
        ok: false,
        config: {},
        error: "config not loaded",
      };
    }

    try {
      const adapter = await waitForAdapter();
      const nextConfig = updater(structuredClone(currentConfig));
      const result = await adapter.configApply(JSON.stringify(nextConfig), hash, params);
      if (result.ok) {
        set({
          config: result.config,
          error: null,
        });
        get().setLifecycleFromWriteResult(result, "apply");
        await get().fetchConfig();
      } else {
        const errMsg = result.error ?? "config apply failed";
        set({ error: errMsg });
        if (errMsg.includes("config changed")) {
          await get().fetchConfig();
        }
      }
      return result;
    } catch (err) {
      const errMsg = String(err);
      set({ error: errMsg });
      return {
        ok: false,
        config: currentConfig,
        error: errMsg,
      };
    }
  },

  patchConfig: async (patch) => {
    const { hash } = get();
    try {
      const adapter = await waitForAdapter();
      const raw = JSON.stringify(patch);
      const result = await adapter.configPatch(raw, hash ?? undefined);
      if (result.ok) {
        set({
          config: result.config,
          error: null,
        });
        if (result.restart?.scheduled) {
          get().setRestartPending(result.restart.delayMs);
        }
        await get().fetchConfig();
      } else {
        const errMsg = result.error ?? "config patch failed";
        set({ error: errMsg });
        if (errMsg.includes("config changed")) {
          await get().fetchConfig();
        }
      }
      return result;
    } catch (err) {
      const errMsg = String(err);
      set({ error: errMsg });
      return { ok: false, config: get().config ?? {}, error: errMsg };
    }
  },

  fetchSchema: async () => {
    try {
      const adapter = await waitForAdapter();
      const schema = await adapter.configSchema();
      set({ schemaHints: schema });
    } catch {
      // Schema is optional, don't block UI
    }
  },

  fetchStatus: async () => {
    set({ statusLoading: true, statusError: null });
    try {
      const adapter = await waitForAdapter();
      const status = await adapter.statusSummary();
      set({ status, statusLoading: false });
    } catch (err) {
      set({ statusLoading: false, statusError: String(err) });
    }
  },

  fetchCatalogModels: async () => {
    set({ catalogLoading: true });
    try {
      const adapter = await waitForAdapter();
      const models = await adapter.modelsList();
      set({ catalogModels: models, catalogLoading: false });
    } catch {
      set({ catalogLoading: false });
    }
  },

  runUpdate: async (params) => {
    set({ updateLoading: true, updateResult: null });
    try {
      const adapter = await waitForAdapter();
      const result = await adapter.updateRun(params);
      set({ updateResult: result, updateLoading: false });
      return result;
    } catch (err) {
      const result: UpdateRunResult = {
        ok: false,
        result: { status: "error", mode: "unknown", reason: String(err), steps: [], durationMs: 0 },
        restart: null,
      };
      set({ updateResult: result, updateLoading: false });
      return result;
    }
  },
}));
