import { create } from "zustand";
import type { WorkbenchMode } from "@/components/console/skills/WorkbenchToolbar";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";

const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/g;

interface SkillWorkbenchState {
  mode: WorkbenchMode;
  currentSkillSlug: string | null;
  currentSkillName: string | null;

  mermaidSource: string;
  mermaidConfirmed: boolean;

  savedSessionKey: string | null;
  sessionActive: boolean;

  fileTree: string[];
  fileContent: string | null;
  selectedFile: string | null;
  isLoadingFiles: boolean;

  setMode: (mode: WorkbenchMode) => void;
  setCurrentSkill: (slug: string, name: string) => void;
  clearCurrentSkill: () => void;

  setMermaidSource: (source: string) => void;
  confirmMermaid: () => void;
  resetMermaid: () => void;

  enterWorkbench: () => void;
  leaveWorkbench: () => void;

  setFileTree: (files: string[]) => void;
  setSelectedFile: (path: string | null) => void;
  setFileContent: (content: string | null) => void;
  setLoadingFiles: (loading: boolean) => void;
}

export const useSkillWorkbenchStore = create<SkillWorkbenchState>((set, get) => ({
  mode: "create",
  currentSkillSlug: null,
  currentSkillName: null,

  mermaidSource: "",
  mermaidConfirmed: false,

  savedSessionKey: null,
  sessionActive: false,

  fileTree: [],
  fileContent: null,
  selectedFile: null,
  isLoadingFiles: false,

  setMode: (mode) => {
    set({ mode, mermaidSource: "", mermaidConfirmed: false });
    const chatStore = useChatDockStore.getState();
    if (mode === "create") {
      const key = `agent:default:skill-workbench-new-${Date.now()}`;
      chatStore.switchSession(key);
    } else if (mode === "edit" && get().currentSkillSlug) {
      const key = `agent:default:skill-workbench-edit-${get().currentSkillSlug}`;
      chatStore.switchSession(key);
    }
  },

  setCurrentSkill: (slug, name) => set({ currentSkillSlug: slug, currentSkillName: name }),
  clearCurrentSkill: () => set({ currentSkillSlug: null, currentSkillName: null }),

  setMermaidSource: (source) => set({ mermaidSource: source, mermaidConfirmed: false }),
  confirmMermaid: () => set({ mermaidConfirmed: true }),
  resetMermaid: () => set({ mermaidSource: "", mermaidConfirmed: false }),

  enterWorkbench: () => {
    const chatStore = useChatDockStore.getState();
    const saved = chatStore.currentSessionKey;
    set({ savedSessionKey: saved, sessionActive: true });

    const { mode, currentSkillSlug } = get();
    if (mode === "create") {
      const key = `agent:default:skill-workbench-new-${Date.now()}`;
      chatStore.switchSession(key);
    } else if (mode === "edit" && currentSkillSlug) {
      const key = `agent:default:skill-workbench-edit-${currentSkillSlug}`;
      chatStore.switchSession(key);
    }
  },

  leaveWorkbench: () => {
    const { savedSessionKey } = get();
    if (savedSessionKey) {
      useChatDockStore.getState().switchSession(savedSessionKey);
    }
    set({ sessionActive: false, savedSessionKey: null });
  },

  setFileTree: (files) => set({ fileTree: files }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  setFileContent: (content) => set({ fileContent: content }),
  setLoadingFiles: (loading) => set({ isLoadingFiles: loading }),
}));

/**
 * Extract the last mermaid code block from messages and streaming content.
 */
export function extractLatestMermaid(
  messages: Array<{ role: string; content: string }>,
  streamingContent?: string | null,
): string | null {
  const sources = [
    ...(streamingContent ? [streamingContent] : []),
    ...messages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .reverse(),
  ];

  for (const text of sources) {
    let lastMatch: string | null = null;
    let match: RegExpExecArray | null;
    MERMAID_FENCE_RE.lastIndex = 0;
    while ((match = MERMAID_FENCE_RE.exec(text)) !== null) {
      lastMatch = match[1].trim();
    }
    if (lastMatch) return lastMatch;
  }
  return null;
}
