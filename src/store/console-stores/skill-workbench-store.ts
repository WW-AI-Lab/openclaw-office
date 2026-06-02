import { create } from "zustand";
import { getAdapter } from "@/gateway/adapter-provider";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import { workspaceSkillsEnsureDefaults } from "@/gateway/workspace-skills-client";

/**
 * Workbench interaction mode.
 * - create: creating a brand-new skill with a fresh chat session
 * - browse: viewing an existing skill's files without an active chat session
 * - edit:   editing an existing skill via the workbench chat sidebar
 *
 * Prior to the detail-page redesign this type lived in WorkbenchToolbar.tsx;
 * it now lives in the store so modes stay independent from any UI component.
 */
export type WorkbenchMode = "create" | "browse" | "edit";

const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/g;
const MERMAID_PLAIN_RE = /(?:^|\n)(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|journey|gantt|mindmap|timeline|gitGraph|pie|xychart-beta|quadrantChart|requirementDiagram|sankey-beta|block-beta)\b[\s\S]*$/;
const WORKSPACE_SKILLS_DIR = "~/.openclaw/workspace/skills";
const WORKBENCH_CREATOR_SKILL = "skill-workbench-creator";
const MERMAID_GUARD_SKILL = "skill-workbench-mermaid-guard";
const DEFAULT_WORKBENCH_SKILLS = [WORKBENCH_CREATOR_SKILL, MERMAID_GUARD_SKILL] as const;

function formatInjectedSkillSection(skillSlug: string, content: string): string {
  return [`[默认 Skill：${skillSlug}/SKILL.md]`, content.trim()].join("\n");
}

async function loadInjectedSkillSections(adapter: ReturnType<typeof getAdapter>, skillSlugs: readonly string[]): Promise<string[]> {
  const sections = await Promise.all(skillSlugs.map(async (skillSlug) => {
    try {
      const file = await adapter.agentsFilesGet(skillSlug, "SKILL.md");
      return formatInjectedSkillSection(skillSlug, file.file.content);
    } catch {
      return null;
    }
  }));

  return sections.filter((section): section is string => Boolean(section));
}

function buildFlowchartTaskPrompt(skillSlug: string): string {
  const skillDir = `${WORKSPACE_SKILLS_DIR}/${skillSlug}`;
  return `使用Skill「skill-workbench-mermaid-guard」为 skill ${skillSlug} 生成或更新工作流程图，写入 ${skillDir}/FLOWCHART.md。直接执行，不要先解释。`;
}

export function buildInputUiTaskPrompt(skillSlug: string): string {
  const skillDir = `${WORKSPACE_SKILLS_DIR}/${skillSlug}`;
  return `使用Skill「skill-workbench-mermaid-guard」为 skill ${skillSlug} 生成或更新 A2UI 首次交互输入表单，写入 ${skillDir}/ui.json，并幂等注入 SKILL.md 使用提示。直接执行，不要先解释。`;
}

function stripYamlFrontmatter(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("---\n")) {
    return trimmed;
  }

  const end = trimmed.indexOf("\n---\n", 4);
  if (end === -1) {
    return trimmed;
  }

  return trimmed.slice(end + 5).trim();
}

function extractMermaidFromText(text: string): string | null {
  let match: RegExpExecArray | null;
  MERMAID_FENCE_RE.lastIndex = 0;
  while ((match = MERMAID_FENCE_RE.exec(text)) !== null) {
    return stripYamlFrontmatter(match[1].trim());
  }

  const plain = stripYamlFrontmatter(text);
  const plainMatch = plain.match(MERMAID_PLAIN_RE);
  if (!plainMatch) {
    return null;
  }

  const candidate = plainMatch[0].trim();
  if (!/(-->|subgraph\b|classDef\b|participant\b|state\b|erDiagram\b|journey\b|gantt\b)/.test(candidate)) {
    return null;
  }

  return candidate;
}

export function readMermaidFromContent(text: string): string {
  return extractMermaidFromText(text) ?? "";
}

/**
 * Count the number of ```mermaid``` fenced code blocks in a text.
 * Used by FlowchartPanel to decide whether to fall back to single-chart
 * preview or keep multi-chart document preview while the user edits.
 */
export function countMermaidBlocks(text: string): number {
  if (!text) return 0;
  const re = /```mermaid\s*\n[\s\S]*?```/g;
  return (text.match(re) ?? []).length;
}

interface SkillWorkbenchState {
  mode: WorkbenchMode;
  currentSkillSlug: string | null;
  currentSkillName: string | null;

  mermaidSource: string;
  flowchartDocument: string;
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
  setFlowchartDocument: (document: string) => void;
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
  mode: "browse",
  currentSkillSlug: null,
  currentSkillName: null,

  mermaidSource: "",
  flowchartDocument: "",
  mermaidConfirmed: false,

  savedSessionKey: null,
  sessionActive: false,

  fileTree: [],
  fileContent: null,
  selectedFile: null,
  isLoadingFiles: false,
  pendingAutoSendMessage: null,

  setMode: (mode) => {
    set({ mode });
  },

  setCurrentSkill: (slug, name) => set({ currentSkillSlug: slug, currentSkillName: name }),
  clearCurrentSkill: () => set({
    currentSkillSlug: null,
    currentSkillName: null,
    mermaidSource: "",
    flowchartDocument: "",
    mermaidConfirmed: false,
  }),

  setMermaidSource: (source) => set({ mermaidSource: source, mermaidConfirmed: false }),
  setFlowchartDocument: (flowchartDocument) => set({ flowchartDocument }),
  confirmMermaid: () => set({ mermaidConfirmed: true }),
  resetMermaid: () => set({ mermaidSource: "", flowchartDocument: "", mermaidConfirmed: false }),

  enterWorkbench: async () => {
    // Ensure that the built-in default workbench skills (e.g. the mermaid
    // guard) are installed into the user's ~/.openclaw/workspace/skills/
    // directory before we try to inject them as system context. The embedded
    // server ships these skills inside the npm package and will copy them
    // on demand. Failures here are silent: the workbench still works, the
    // injected skill section for a missing skill will just be dropped.
    try {
      await workspaceSkillsEnsureDefaults(DEFAULT_WORKBENCH_SKILLS);
    } catch (err) {
      console.warn("[skill-workbench] ensure default skills failed:", err);
    }

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
        const sections = await loadInjectedSkillSections(adapter, DEFAULT_WORKBENCH_SKILLS);
        const sessionKey = chatStore.currentSessionKey;
        if (sections.length > 0) {
          await adapter.chatInject(
            sessionKey,
            [`[系统：本次对话请遵循 Skills 工作台默认技能执行任务]`, ...sections].join("\n\n"),
          );
        }
      } catch {
        // Gracefully degrade when default workbench skills are unavailable.
      }
    } else if ((mode === "edit" || mode === "browse") && currentSkillSlug) {
      const pendingMsg = get().pendingAutoSendMessage;
      // Always stamp the session key with the entry timestamp so that each
      // "edit this skill" click starts a brand-new chat session without
      // leftover history from a previous edit.
      const key = pendingMsg
        ? `agent:${agentId}:skill-workbench-flowchart-${currentSkillSlug}:${Date.now()}`
        : `agent:${agentId}:skill-workbench-${mode}-${currentSkillSlug}:${Date.now()}`;
      chatStore.switchSession(key);

      try {
        const adapter = getAdapter();
        const sections = await loadInjectedSkillSections(adapter, DEFAULT_WORKBENCH_SKILLS);
        const skillDir = `${WORKSPACE_SKILLS_DIR}/${currentSkillSlug}`;
        await adapter.chatInject(
          key,
          [
            `[系统：当前正在${mode === "browse" ? "浏览并修改" : "修改"} skill ${currentSkillSlug}]`,
            `目标目录：${skillDir}`,
            "【严格范围限制 - 违反视为错误】",
            `1. 仅允许读写 ${skillDir}/ 目录下的文件（SKILL.md / FLOWCHART.md / ui.json / _meta.json / scripts/ / references/ / tests/ 等）。`,
            "2. 禁止修改任何其他 skill 目录、全局配置文件（如 ~/.openclaw/config.* 、~/.openclaw/agents/* 、~/.openclaw/settings/*）以及 ~/.openclaw/workspace/skills/ 之外的任何路径。",
            "3. 禁止创建/删除/重命名其他 skill；禁止修改本 skill 的 slug 与目录名。",
            "4. 执行任何 read / write / edit / shell 之前，必须先确认目标路径以 " + skillDir + "/ 开头；若用户请求超出该范围，请拒绝并提示“仅在技能工作台中修改当前 skill”。",
            "5. 流程图结构调整 → FLOWCHART.md；技能说明/行为 → SKILL.md；A2UI 表单 → ui.json；必要时多个同时修改。",
            ...sections,
          ].join("\n"),
        );
      } catch {
        // Ignore context injection failures; the user can still continue manually.
      }

      // Send pending auto-message AFTER session switch (correct key is now set).
      // Must happen here (not in WorkbenchChat useEffect) because child effects
      // fire before parent effects — sending from the child would use the old key.
      if (pendingMsg) {
        set({ pendingAutoSendMessage: null });
        await useChatDockStore.getState().clearMessages();
        void useChatDockStore.getState().sendMessage(buildFlowchartTaskPrompt(currentSkillSlug));
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
    const mermaid = extractMermaidFromText(text);
    if (mermaid) return mermaid;
  }
  return null;
}
