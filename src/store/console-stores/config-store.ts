import { create } from "zustand";
import { waitForAdapter } from "@/gateway/adapter-provider";
import type {
  ConfigPatchResult,
  ConfigSchemaResponse,
  ConfigSnapshot,
  ModelCatalogEntry,
  StatusSummary,
  UpdateRunResult,
} from "@/gateway/adapter-types";

export interface RestartState {
  status: "pending" | "disconnected" | "reconnecting" | "complete";
  startedAt: number;
  estimatedDelayMs: number;
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
  setRestartPending: (delayMs: number) => void;
  setRestartReconnecting: () => void;
  setRestartComplete: () => void;
  clearRestart: () => void;

  fetchConfig: () => Promise<void>;
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
