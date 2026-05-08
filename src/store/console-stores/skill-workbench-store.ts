import { create } from "zustand";
import type { WorkbenchMode } from "@/components/console/skills/WorkbenchToolbar";
import { getAdapter } from "@/gateway/adapter-provider";
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

  /** Message to auto-send when WorkbenchChat mounts (used by one-click flowchart generation) */
  pendingAutoSendMessage: string | null;

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
  setPendingAutoSendMessage: (msg: string | null) => void;
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
  pendingAutoSendMessage: null,

  setMode: (mode) => {
    set({ mode, mermaidSource: "", mermaidConfirmed: false });
  },

  setCurrentSkill: (slug, name) => set({ currentSkillSlug: slug, currentSkillName: name }),
  clearCurrentSkill: () => set({ currentSkillSlug: null, currentSkillName: null }),

  setMermaidSource: (source) => set({ mermaidSource: source, mermaidConfirmed: false }),
  confirmMermaid: () => set({ mermaidConfirmed: true }),
  resetMermaid: () => set({ mermaidSource: "", mermaidConfirmed: false }),

  enterWorkbench: async () => {
    const chatStore = useChatDockStore.getState();
    const { savedSessionKey, mode, currentSkillSlug } = get();
    // Use the currently active agent (e.g. "main") so the Gateway routes correctly.
    const agentId = chatStore.targetAgentId ?? "main";

    // Only save the original session on first entry; don't overwrite on mode switches.
    set({
      savedSessionKey: savedSessionKey ?? chatStore.currentSessionKey,
      sessionActive: true,
    });

    if (mode === "create") {
      // Use newSession to create a fresh, empty session with standard key format.
      // newSession sets isHistoryLoaded=true, preventing auto-load of stale history.
      chatStore.newSession(agentId);

      // Inject skill-workbench-creator instructions as system context
      // so the agent follows the structured skill creation workflow.
      try {
        const adapter = getAdapter();
        const creator = await adapter.agentsFilesGet("skill-workbench-creator", "SKILL.md");
        const sessionKey = chatStore.currentSessionKey;
        await adapter.chatInject(
          sessionKey,
          `[系统：本次对话请遵循以下 skill-workbench-creator 框架执行任务]\n\n${creator.file.content}`,
        );
      } catch {
        // Gracefully degrade: skill-workbench-creator may not be installed
      }
    } else if (mode === "edit" && currentSkillSlug) {
      const key = `agent:${agentId}:skill-workbench-edit-${currentSkillSlug}`;
      chatStore.switchSession(key);

      // Send pending auto-message AFTER session switch (correct key is now set).
      // Must happen here (not in WorkbenchChat useEffect) because child effects
      // fire before parent effects — sending from the child would use the old key.
      const pendingMsg = get().pendingAutoSendMessage;
      if (pendingMsg) {
        set({ pendingAutoSendMessage: null });
        void useChatDockStore.getState().sendMessage(pendingMsg);
      }
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
  setPendingAutoSendMessage: (msg) => set({ pendingAutoSendMessage: msg }),
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
