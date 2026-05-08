import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Pencil, Sparkles, Loader2 } from "lucide-react";
import { getAdapter } from "@/gateway/adapter-provider";
import { useSkillsStore } from "@/store/console-stores/skills-store";
import { useSkillWorkbenchStore } from "@/store/console-stores/skill-workbench-store";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import type { SkillInfo } from "@/gateway/adapter-types";
import { SkillFileTree } from "./SkillFileTree";
import { SkillFileViewer } from "./SkillFileViewer";

export const SkillBrowser = memo(function SkillBrowser() {
  const { t } = useTranslation("console");
  const skills = useSkillsStore((s) => s.skills);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);
  const setMode = useSkillWorkbenchStore((s) => s.setMode);
  const setCurrentSkill = useSkillWorkbenchStore((s) => s.setCurrentSkill);
  const setMermaidSource = useSkillWorkbenchStore((s) => s.setMermaidSource);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [hasFlowchart, setHasFlowchart] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const workspaceSkills = skills.filter(
    (s) => s.source === "openclaw-workspace" || (!s.isBundled && !s.isCore),
  );

  const filtered = workspaceSkills.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q)
    );
  });

  const handleSelectSkill = useCallback(
    async (skill: SkillInfo) => {
      setSelectedSkill(skill);
      setSelectedFile(null);
      setFileContent(null);
      setHasFlowchart(false);
      setIsLoadingFiles(true);
      try {
        const adapter = getAdapter();
        const result = await adapter.agentsFilesList(skill.slug);
        const names = result.files.map((f) => f.name);
        setFileList(names);

        // Try to load FLOWCHART.md for the right panel
        const flowchartFile = names.find(
          (n) => n.toUpperCase() === "FLOWCHART.MD",
        );
        if (flowchartFile) {
          setHasFlowchart(true);
          try {
            const fc = await adapter.agentsFilesGet(skill.slug, flowchartFile);
            // Extract mermaid from the file content
            const mermaidMatch = fc.file.content.match(/```mermaid\s*\n([\s\S]*?)```/);
            if (mermaidMatch) {
              setMermaidSource(mermaidMatch[1].trim());
            }
          } catch {
            // Ignore flowchart load errors
          }
        }
      } catch {
        setFileList([]);
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [setMermaidSource],
  );

  const handleSelectFile = useCallback(
    async (fileName: string) => {
      if (!selectedSkill) return;
      setSelectedFile(fileName);
      setIsLoadingContent(true);
      try {
        const adapter = getAdapter();
        const result = await adapter.agentsFilesGet(selectedSkill.slug, fileName);
        setFileContent(result.file.content);
      } catch {
        setFileContent(null);
      } finally {
        setIsLoadingContent(false);
      }
    },
    [selectedSkill],
  );

  const handleEditSkill = useCallback(() => {
    if (!selectedSkill) return;
    setCurrentSkill(selectedSkill.slug, selectedSkill.name);
    setMode("edit");
  }, [selectedSkill, setCurrentSkill, setMode]);

  const handleGenerateFlowchart = useCallback(async () => {
    if (!selectedSkill) return;
    setIsGenerating(true);

    // Switch to edit mode — switchSession is synchronous in Zustand,
    // so currentSessionKey is updated immediately after setMode.
    setCurrentSkill(selectedSkill.slug, selectedSkill.name);
    setMode("edit");

    const sessionKey = `agent:default:skill-workbench-edit-${selectedSkill.slug}`;

    try {
      const adapter = getAdapter();

      // Inject skill-flow-visualizer skill instructions as system context
      // so the agent follows the structured analysis framework.
      try {
        const sfv = await adapter.agentsFilesGet("skill-flow-visualizer", "SKILL.md");
        await adapter.chatInject(
          sessionKey,
          `[系统：本次对话请遵循以下 skill-flow-visualizer 分析框架执行任务]\n\n${sfv.file.content}`,
        );
      } catch {
        // Gracefully degrade: skill-flow-visualizer may not be installed
      }

      // Send the structured task message matching skill-flow-visualizer's trigger format
      const taskMessage = `分析 skills/${selectedSkill.slug} 的工作流程，生成 Mermaid 流程图。生成完成后，将流程图保存为该技能目录下的 FLOWCHART.md 文件。`;
      void useChatDockStore.getState().sendMessage(taskMessage);
    } catch {
      // sendMessage error is handled by the store
    } finally {
      setIsGenerating(false);
    }
  }, [selectedSkill, setCurrentSkill, setMode]);

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
          <Search className="h-3.5 w-3.5 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("skillWorkbench.browser.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Skill list + file tree */}
        <div className="w-48 shrink-0 overflow-y-auto border-r border-gray-200 px-2 py-2 dark:border-gray-700">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-gray-400">
              {t("skillWorkbench.browser.noSkills")}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((skill) => {
                const isActive = selectedSkill?.id === skill.id;
                return (
                  <div key={skill.id}>
                    <button
                      onClick={() => void handleSelectSkill(skill)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="truncate font-medium">{skill.name}</div>
                      <div className="mt-0.5 truncate text-[10px] text-gray-400">{skill.slug}</div>
                    </button>
                    {isActive && fileList.length > 0 && (
                      <div className="ml-2 mt-1">
                        <SkillFileTree
                          files={fileList}
                          selectedFile={selectedFile}
                          onSelectFile={(f) => void handleSelectFile(f)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* File viewer */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <SkillFileViewer
                fileName={selectedFile}
                content={fileContent}
                isLoading={isLoadingContent}
              />
              <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-2 dark:border-gray-700">
                <button
                  onClick={handleEditSkill}
                  className="flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                >
                  <Pencil className="h-3 w-3" />
                  {t("skillWorkbench.browser.editSkill")}
                </button>
                {!hasFlowchart && (
                  <button
                    onClick={handleGenerateFlowchart}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {isGenerating
                      ? t("skillWorkbench.browser.generating")
                      : t("skillWorkbench.browser.generateFlowchart")}
                  </button>
                )}
              </div>
            </>
          ) : selectedSkill && !selectedFile ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-gray-400">
              <span>
                {isLoadingFiles
                  ? t("skillWorkbench.browser.loading")
                  : fileList.length === 0
                    ? t("skillWorkbench.browser.noFlowchart")
                    : t("skillWorkbench.browser.noFlowchartHint")}
              </span>
              {!isLoadingFiles && !hasFlowchart && (
                <button
                  onClick={handleGenerateFlowchart}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {isGenerating
                    ? t("skillWorkbench.browser.generating")
                    : t("skillWorkbench.browser.generateFlowchart")}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              {t("skillWorkbench.browser.title")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
