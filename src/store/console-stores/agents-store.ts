import { create } from "zustand";
import { getAdapter, waitForAdapter } from "@/gateway/adapter-provider";
import type { AgentCreateParams, AgentFileInfo, AgentModelConfig } from "@/gateway/adapter-types";
import type { AgentSummary } from "@/gateway/types";

export type AgentTab = "overview" | "files" | "tools" | "skills" | "channels" | "cronJobs";

export interface SystemModelOption {
  id: string;
  label: string;
  provider: string;
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
}

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
      const result = await getAdapter().agentsUpdate({ agentId, model });
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
}));
