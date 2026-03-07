import { create } from "zustand";
import { getAdapter, waitForAdapter } from "@/gateway/adapter-provider";
import { useConfigStore } from "@/store/console-stores/config-store";
import type {
  AgentCreateParams,
  AgentFileInfo,
  AgentModelConfig,
  ChannelInfo,
  CronTask,
  CronTaskInput,
  SkillInfo,
  ToolCatalogEntry,
} from "@/gateway/adapter-types";
import type { AgentSummary } from "@/gateway/types";
import {
  extractAgentConfig,
  patchAgentToolsConfig,
  patchAgentSkillsConfig,
  type PatchResult,
} from "@/lib/config-patch-helpers";
import { clearAgentChannelSessions } from "./agent-session-cleanup";

export type AgentTab = "overview" | "files" | "tools" | "skills" | "channels" | "cronJobs";

export interface SystemModelOption {
  id: string;
  label: string;
  provider: string;
}

export interface AgentToolsConfig {
  profile?: string;
  alsoAllow?: string[];
  deny?: string[];
}

interface AgentsStoreState {
  agents: AgentSummary[];
  defaultAgentId: string;
  selectedAgentId: string | null;
  activeTab: AgentTab;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;

  files: AgentFileInfo[];
  filesLoading: boolean;
  selectedFileName: string | null;
  fileContent: string | null;
  originalFileContent: string | null;
  isFileDirty: boolean;
  fileSaving: boolean;

  createDialogOpen: boolean;
  deleteDialogOpen: boolean;

  systemModels: SystemModelOption[];
  agentModelConfigs: Record<string, { primary: string; fallbacks: string[] }>;

  // Tools tab
  agentTools: ToolCatalogEntry[];
  agentToolsLoading: boolean;
  agentToolsConfig: AgentToolsConfig | null;
  configHash: string | null;

  // Skills tab
  agentSkills: SkillInfo[];
  agentSkillsLoading: boolean;
  agentSkillsAllowlist: string[] | null;

  // Channels tab
  agentChannels: ChannelInfo[];
  agentChannelsLoading: boolean;

  // Cron tab
  agentCronJobs: CronTask[];
  agentCronJobsLoading: boolean;
  cronDialogOpen: boolean;
  cronEditingTask: CronTask | null;

  fetchAgents: () => Promise<void>;
  fetchSystemModels: () => Promise<void>;
  selectAgent: (id: string | null) => void;
  setActiveTab: (tab: AgentTab) => void;
  setSearchQuery: (query: string) => void;

  fetchFiles: (agentId: string) => Promise<void>;
  fetchFileContent: (agentId: string, name: string) => Promise<void>;
  setFileContent: (content: string) => void;
  resetFileContent: () => void;
  saveFileContent: (agentId: string, name: string, content: string) => Promise<boolean>;

  createAgent: (params: AgentCreateParams) => Promise<string | null>;
  updateAgentModel: (agentId: string, model: AgentModelConfig) => Promise<boolean>;
  deleteAgent: (agentId: string, deleteFiles: boolean) => Promise<boolean>;

  setCreateDialogOpen: (open: boolean) => void;
  setDeleteDialogOpen: (open: boolean) => void;

  // Tools tab actions
  fetchAgentTools: (agentId: string) => Promise<void>;
  saveAgentToolsConfig: (agentId: string, toolsConfig: AgentToolsConfig) => Promise<PatchResult>;

  // Skills tab actions
  fetchAgentSkills: (agentId: string) => Promise<void>;
  saveAgentSkillsAllowlist: (agentId: string, skills: string[] | null) => Promise<PatchResult>;

  // Channels tab actions
  fetchAgentChannels: () => Promise<void>;

  // Cron tab actions
  fetchAgentCronJobs: (agentId: string) => Promise<void>;
  addAgentCronJob: (agentId: string, input: CronTaskInput) => Promise<void>;
  updateAgentCronJob: (id: string, patch: Partial<CronTaskInput>) => Promise<void>;
  removeAgentCronJob: (id: string) => Promise<void>;
  runAgentCronJob: (id: string) => Promise<void>;
  toggleAgentCronJob: (id: string, enabled: boolean) => Promise<void>;
  openAgentCronDialog: (task?: CronTask) => void;
  closeAgentCronDialog: () => void;
}

const EMPTY_TAB_STATE = {
  agentTools: [] as ToolCatalogEntry[],
  agentToolsLoading: false,
  agentToolsConfig: null as AgentToolsConfig | null,
  configHash: null as string | null,
  agentSkills: [] as SkillInfo[],
  agentSkillsLoading: false,
  agentSkillsAllowlist: null as string[] | null,
  agentChannels: [] as ChannelInfo[],
  agentChannelsLoading: false,
  agentCronJobs: [] as CronTask[],
  agentCronJobsLoading: false,
  cronDialogOpen: false,
  cronEditingTask: null as CronTask | null,
};

export const useAgentsStore = create<AgentsStoreState>((set, get) => ({
  agents: [],
  defaultAgentId: "",
  selectedAgentId: null,
  activeTab: "overview",
  isLoading: false,
  error: null,
  searchQuery: "",

  files: [],
  filesLoading: false,
  selectedFileName: null,
  fileContent: null,
  originalFileContent: null,
  isFileDirty: false,
  fileSaving: false,

  createDialogOpen: false,
  deleteDialogOpen: false,

  systemModels: [],
  agentModelConfigs: {},

  ...EMPTY_TAB_STATE,

  fetchSystemModels: async () => {
    try {
      await waitForAdapter();
      const adapter = getAdapter();
      const [snap, catalogModels] = await Promise.all([
        adapter.configGet(),
        adapter
          .modelsList()
          .catch(() => [] as Array<{ id: string; name: string; provider: string }>),
      ]);
      const config = snap.config;

      const seen = new Set<string>();
      const options: SystemModelOption[] = [];

      const catalogByProvider = new Map<
        string,
        Array<{ id: string; name: string; provider: string }>
      >();
      for (const m of catalogModels) {
        const key = `${m.provider}/${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ id: key, label: m.name ?? m.id, provider: m.provider });
        if (!catalogByProvider.has(m.provider)) catalogByProvider.set(m.provider, []);
        catalogByProvider.get(m.provider)!.push(m);
      }

      const models = config?.models as Record<string, unknown> | undefined;
      const providers = models?.providers as Record<string, Record<string, unknown>> | undefined;
      if (providers) {
        for (const [providerId, provConfig] of Object.entries(providers)) {
          const modelList = provConfig.models as Array<{ id: string; name?: string }> | undefined;
          if (!modelList) continue;
          for (const m of modelList) {
            const key = `${providerId}/${m.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            options.push({ id: key, label: m.name ?? m.id, provider: providerId });
          }
        }
      }

      const agentModelConfigs: Record<string, { primary: string; fallbacks: string[] }> = {};
      const agentsList = (config?.agents as Record<string, unknown> | undefined)?.list as
        | Array<Record<string, unknown>>
        | undefined;
      if (agentsList) {
        for (const entry of agentsList) {
          const id = entry.id as string | undefined;
          if (!id) continue;
          const model = entry.model;
          if (typeof model === "string") {
            agentModelConfigs[id] = { primary: model, fallbacks: [] };
          } else if (model && typeof model === "object" && !Array.isArray(model)) {
            const m = model as { primary?: string; fallbacks?: string[] };
            agentModelConfigs[id] = {
              primary: m.primary ?? "",
              fallbacks: m.fallbacks ?? [],
            };
          }
        }
      }

      set({ systemModels: options, agentModelConfigs });
    } catch {
      // non-critical
    }
  },

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      await waitForAdapter();
      const result = await getAdapter().agentsList();
      const agents = result.agents.map((a) => ({
        ...a,
        default: a.id === result.defaultId,
      }));
      const { selectedAgentId } = get();
      const autoSelect = selectedAgentId == null ? result.defaultId : selectedAgentId;
      set({
        agents,
        defaultAgentId: result.defaultId,
        selectedAgentId: autoSelect,
        isLoading: false,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  selectAgent: (id) => {
    set({
      selectedAgentId: id,
      activeTab: "overview",
      files: [],
      selectedFileName: null,
      fileContent: null,
      originalFileContent: null,
      isFileDirty: false,
      ...EMPTY_TAB_STATE,
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchFiles: async (agentId) => {
    set({ filesLoading: true, files: [] });
    try {
      await waitForAdapter();
      const result = await getAdapter().agentsFilesList(agentId);
      set({ files: result.files, filesLoading: false });
    } catch {
      set({ filesLoading: false });
    }
  },

  fetchFileContent: async (agentId, name) => {
    set({
      selectedFileName: name,
      fileContent: null,
      originalFileContent: null,
      isFileDirty: false,
    });
    try {
      await waitForAdapter();
      const result = await getAdapter().agentsFilesGet(agentId, name);
      set({
        fileContent: result.file.content,
        originalFileContent: result.file.content,
        isFileDirty: false,
      });
    } catch {
      set({ fileContent: "", originalFileContent: "" });
    }
  },

  setFileContent: (content) => {
    const { originalFileContent } = get();
    set({ fileContent: content, isFileDirty: content !== originalFileContent });
  },

  resetFileContent: () => {
    const { originalFileContent } = get();
    set({ fileContent: originalFileContent, isFileDirty: false });
  },

  saveFileContent: async (agentId, name, content) => {
    set({ fileSaving: true });
    try {
      await waitForAdapter();
      await getAdapter().agentsFilesSet(agentId, name, content);
      set({ fileSaving: false, originalFileContent: content, isFileDirty: false });
      return true;
    } catch {
      set({ fileSaving: false });
      return false;
    }
  },

  createAgent: async (params) => {
    try {
      await waitForAdapter();
      const result = await getAdapter().agentsCreate(params);
      if (result.ok) {
        await get().fetchAgents();
        return result.agentId;
      }
      return null;
    } catch {
      return null;
    }
  },

  updateAgentModel: async (agentId, model) => {
    try {
      await waitForAdapter();
      const adapter = getAdapter();
      const result = await adapter.agentsUpdate({ agentId, model });
      if (result.ok) {
        let messageKey = "configLifecycle.runtimeAgentModel";
        try {
          const cleared = await clearAgentChannelSessions(adapter, agentId);
          if (cleared > 0) {
            messageKey = "configLifecycle.runtimeAgentModelSessionsReset";
          }
        } catch {
          // Keep the runtime-applied success state even if session cleanup fails.
        }
        useConfigStore.getState().setRuntimeApplied(messageKey);
      }
      return result.ok;
    } catch {
      return false;
    }
  },

  deleteAgent: async (agentId, deleteFiles) => {
    try {
      await waitForAdapter();
      const result = await getAdapter().agentsDelete({ agentId, deleteFiles });
      if (result.ok) {
        set({ selectedAgentId: null });
        await get().fetchAgents();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  setCreateDialogOpen: (open) => set({ createDialogOpen: open }),
  setDeleteDialogOpen: (open) => set({ deleteDialogOpen: open }),

  // --- Tools tab ---

  fetchAgentTools: async (agentId) => {
    set({ agentToolsLoading: true });
    try {
      await waitForAdapter();
      const adapter = getAdapter();
      const [catalog, snap] = await Promise.all([
        adapter.toolsCatalog(agentId),
        adapter.configGet(),
      ]);
      const entry = extractAgentConfig(snap.config, agentId);
      const tools = entry?.tools as AgentToolsConfig | undefined;
      set({
        agentTools: catalog.tools,
        agentToolsConfig: tools ?? null,
        configHash: snap.hash ?? null,
        agentToolsLoading: false,
      });
    } catch {
      set({ agentToolsLoading: false });
    }
  },

  saveAgentToolsConfig: async (agentId, toolsConfig) => {
    try {
      await waitForAdapter();
      const adapter = getAdapter();
      const { configHash } = get();
      const result = await patchAgentToolsConfig(
        adapter,
        agentId,
        toolsConfig as Record<string, unknown>,
        configHash ?? undefined,
      );
      if (result.ok) {
        const snapshot = await adapter.configGet();
        set({ agentToolsConfig: toolsConfig, configHash: snapshot.hash ?? null });
        useConfigStore.getState().setLifecycleFromWriteResult(
          { ...result, config: snapshot.config },
          "save",
        );
      }
      return result;
    } catch {
      return { ok: false, error: "unknown" };
    }
  },

  // --- Skills tab ---

  fetchAgentSkills: async (agentId) => {
    set({ agentSkillsLoading: true });
    try {
      await waitForAdapter();
      const adapter = getAdapter();
      const [skills, snap] = await Promise.all([
        adapter.skillsStatus(agentId),
        adapter.configGet(),
      ]);
      const entry = extractAgentConfig(snap.config, agentId);
      const allowlist = entry?.skills ?? null;
      set({
        agentSkills: skills,
        agentSkillsAllowlist: allowlist,
        configHash: snap.hash ?? null,
        agentSkillsLoading: false,
      });
    } catch {
      set({ agentSkillsLoading: false });
    }
  },

  saveAgentSkillsAllowlist: async (agentId, skills) => {
    try {
      await waitForAdapter();
      const adapter = getAdapter();
      const { configHash } = get();
      const result = await patchAgentSkillsConfig(
        adapter,
        agentId,
        skills,
        configHash ?? undefined,
      );
      if (result.ok) {
        const snapshot = await adapter.configGet();
        set({ agentSkillsAllowlist: skills, configHash: snapshot.hash ?? null });
        useConfigStore.getState().setLifecycleFromWriteResult(
          { ...result, config: snapshot.config },
          "save",
        );
      }
      return result;
    } catch {
      return { ok: false, error: "unknown" };
    }
  },

  // --- Channels tab ---

  fetchAgentChannels: async () => {
    set({ agentChannelsLoading: true });
    try {
      await waitForAdapter();
      const channels = await getAdapter().channelsStatus();
      set({ agentChannels: channels, agentChannelsLoading: false });
    } catch {
      set({ agentChannelsLoading: false });
    }
  },

  // --- Cron tab ---

  fetchAgentCronJobs: async (agentId) => {
    set({ agentCronJobsLoading: true });
    try {
      await waitForAdapter();
      const all = await getAdapter().cronList();
      set({
        agentCronJobs: all.filter((j) => j.agentId === agentId),
        agentCronJobsLoading: false,
      });
    } catch {
      set({ agentCronJobsLoading: false });
    }
  },

  addAgentCronJob: async (agentId, input) => {
    await waitForAdapter();
    const task = await getAdapter().cronAdd({ ...input, agentId });
    set((s) => ({ agentCronJobs: [...s.agentCronJobs, task] }));
    useConfigStore.getState().setRuntimeApplied("configLifecycle.runtimeCron");
  },

  updateAgentCronJob: async (id, patch) => {
    await waitForAdapter();
    const updated = await getAdapter().cronUpdate(id, patch);
    set((s) => ({
      agentCronJobs: s.agentCronJobs.map((j) => (j.id === id ? updated : j)),
    }));
    useConfigStore.getState().setRuntimeApplied("configLifecycle.runtimeCron");
  },

  removeAgentCronJob: async (id) => {
    await waitForAdapter();
    await getAdapter().cronRemove(id);
    set((s) => ({ agentCronJobs: s.agentCronJobs.filter((j) => j.id !== id) }));
    useConfigStore.getState().setRuntimeApplied("configLifecycle.runtimeCron");
  },

  runAgentCronJob: async (id) => {
    await waitForAdapter();
    await getAdapter().cronRun(id);
    useConfigStore.getState().setRuntimeApplied("configLifecycle.runtimeCron");
  },

  toggleAgentCronJob: async (id, enabled) => {
    await waitForAdapter();
    const updated = await getAdapter().cronUpdate(id, { enabled });
    set((s) => ({
      agentCronJobs: s.agentCronJobs.map((j) => (j.id === id ? updated : j)),
    }));
    useConfigStore.getState().setRuntimeApplied("configLifecycle.runtimeCron");
  },

  openAgentCronDialog: (task) => {
    set({ cronDialogOpen: true, cronEditingTask: task ?? null });
  },

  closeAgentCronDialog: () => {
    set({ cronDialogOpen: false, cronEditingTask: null });
  },
}));
