import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PanelRightClose } from "lucide-react";
import { workspaceSkillsGet, workspaceSkillsList } from "@/gateway/workspace-skills-client";
import { useSkillsStore } from "@/store/console-stores/skills-store";
import {
  readMermaidFromContent,
  buildInputUiTaskPrompt,
  useSkillWorkbenchStore,
} from "@/store/console-stores/skill-workbench-store";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import type { ChatAttachment } from "@/gateway/adapter-types";
import { WorkbenchChat } from "@/components/console/skills/WorkbenchChat";
import { FlowchartPanel } from "@/components/console/skills/FlowchartPanel";
import { A2uiDebugPanel } from "@/components/console/skills/A2uiDebugPanel";
import { SkillFileViewer } from "@/components/console/skills/SkillFileViewer";
import {
  DetailFileSidebar,
  FLOWCHART_ITEM,
  A2UI_ITEM,
} from "@/components/console/skills/DetailFileSidebar";

const FLOWCHART_FILE_NAME = "FLOWCHART.md";
const A2UI_FILE_NAME = "ui.json";

export function SkillWorkbenchDetailPage() {
  const { t } = useTranslation("console");
  const navigate = useNavigate();
  const { slug = "" } = useParams<{ slug: string }>();

  const skills = useSkillsStore((s) => s.skills);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);
  const setMode = useSkillWorkbenchStore((s) => s.setMode);
  const setCurrentSkill = useSkillWorkbenchStore((s) => s.setCurrentSkill);
  const enterWorkbench = useSkillWorkbenchStore((s) => s.enterWorkbench);
  const setMermaidSource = useSkillWorkbenchStore((s) => s.setMermaidSource);
  const setFlowchartDocument = useSkillWorkbenchStore((s) => s.setFlowchartDocument);
  const resetMermaid = useSkillWorkbenchStore((s) => s.resetMermaid);
  const setPendingAutoSendMessage = useSkillWorkbenchStore((s) => s.setPendingAutoSendMessage);
  const flowchartDocument = useSkillWorkbenchStore((s) => s.flowchartDocument);
  const isChatStreaming = useChatDockStore((s) => s.isStreaming);

  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>(FLOWCHART_ITEM);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [hasFlowchart, setHasFlowchart] = useState(false);
  const [hasInputUi, setHasInputUi] = useState(false);
  const [uiJsonContent, setUiJsonContent] = useState<string | null>(null);
  const [isLoadingUiJson, setIsLoadingUiJson] = useState(false);
  const [isGeneratingUi, setIsGeneratingUi] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isGeneratingFlowchart, setIsGeneratingFlowchart] = useState(false);

  const skill = useMemo(() => skills.find((s) => s.slug === slug), [skills, slug]);
  const displayName = skill?.name ?? slug;

  // Resolve slug → trigger workbench edit session + load files.
  useEffect(() => {
    if (!slug) return;
    void fetchSkills();
  }, [slug, fetchSkills]);

  // Reset all local UI state only when the slug actually changes (i.e. the
  // user navigates to a different skill). Using a ref to track the previous
  // slug prevents the effect from re-firing when `skill?.name` resolves
  // after fetchSkills() — which previously caused a race condition that
  // wiped flowchartDocument and uiJsonContent that had just been loaded
  // from disk.
  const prevSlugRef = useRef("");
  useEffect(() => {
    if (!slug) return;
    if (prevSlugRef.current === slug) return;
    prevSlugRef.current = slug;

    setMode("browse");
    resetMermaid();
    setIsGeneratingFlowchart(false);
    setIsGeneratingUi(false);
    setUiJsonContent(null);
    setHasInputUi(false);
  }, [slug, setMode, resetMermaid]);

  // Keep the store's currentSkill in sync whenever slug or skill name
  // changes — without triggering the full state reset above.
  useEffect(() => {
    if (!slug) return;
    setCurrentSkill(slug, skill?.name ?? slug);
  }, [slug, skill?.name, setCurrentSkill]);

  // Load file tree + flowchart for this skill.
  const loadFlowchartFromDisk = useCallback(
    async (targetSlug: string, opts?: { markLoaded?: boolean }) => {
      try {
        const flowchart = await workspaceSkillsGet(targetSlug, FLOWCHART_FILE_NAME);
        const mermaid = readMermaidFromContent(flowchart.file.content);
        setFlowchartDocument(flowchart.file.content);
        if (mermaid) {
          setMermaidSource(mermaid);
          if (opts?.markLoaded) setHasFlowchart(true);
        }
        return true;
      } catch {
        // FLOWCHART.md may not exist yet.
        return false;
      }
    },
    [setFlowchartDocument, setMermaidSource],
  );

  const loadUiJsonFromDisk = useCallback(async (targetSlug: string) => {
    setIsLoadingUiJson(true);
    try {
      const file = await workspaceSkillsGet(targetSlug, A2UI_FILE_NAME);
      setUiJsonContent(file.file.content);
      setHasInputUi(true);
      return true;
    } catch {
      // ui.json may not exist yet.
      setUiJsonContent(null);
      setHasInputUi(false);
      return false;
    } finally {
      setIsLoadingUiJson(false);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      setIsLoadingFiles(true);
      setFileList([]);
      setHasFlowchart(false);
      try {
        const loaded = await loadFlowchartFromDisk(slug, { markLoaded: true });
        if (cancelled) return;
        if (!loaded) {
          // Nothing on disk yet; keep state cleared.
        }

        await loadUiJsonFromDisk(slug);
        if (cancelled) return;

        try {
          const result = await workspaceSkillsList(slug);
          if (cancelled) return;
          const names = result.files.map((f) => f.name);
          setFileList(names);
          if (names.some((n) => n.toUpperCase() === FLOWCHART_FILE_NAME.toUpperCase())) {
            setHasFlowchart(true);
          }
          if (names.some((n) => n.toLowerCase() === A2UI_FILE_NAME.toLowerCase())) {
            setHasInputUi(true);
          }
        } catch {
          if (!cancelled) setFileList([]);
        }
      } finally {
        if (!cancelled) setIsLoadingFiles(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, loadFlowchartFromDisk, loadUiJsonFromDisk]);

  // Refresh FLOWCHART.md + file list from disk when a chat streaming turn
  // finishes while the user is actively editing/generating in this detail
  // page. This keeps the multi-chart preview in sync after the AI writes
  // FLOWCHART.md via tools, without requiring a manual page refresh.
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (!slug) return;
    const prev = wasStreamingRef.current;
    wasStreamingRef.current = isChatStreaming;
    if (!prev || isChatStreaming) return;

    let cancelled = false;
    const refresh = async () => {
      await loadFlowchartFromDisk(slug, { markLoaded: true });
      await loadUiJsonFromDisk(slug);
      if (cancelled) return;
      // Always reset generating flags once streaming ends, even if the agent
      // failed to produce the expected files (the dedicated useEffects only
      // reset when the content becomes non-empty).
      setIsGeneratingUi(false);
      setIsGeneratingFlowchart(false);
      try {
        const result = await workspaceSkillsList(slug);
        if (cancelled) return;
        const names = result.files.map((f) => f.name);
        setFileList(names);
        if (names.some((n) => n.toUpperCase() === FLOWCHART_FILE_NAME.toUpperCase())) {
          setHasFlowchart(true);
        }
        if (names.some((n) => n.toLowerCase() === A2UI_FILE_NAME.toLowerCase())) {
          setHasInputUi(true);
        }
      } catch {
        // Ignore list refresh errors.
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [isChatStreaming, slug, loadFlowchartFromDisk, loadUiJsonFromDisk]);

  // Load selected file content.
  useEffect(() => {
    if (!slug) return;
    if (selectedItem === FLOWCHART_ITEM) {
      setFileContent(null);
      return;
    }
    let cancelled = false;
    setIsLoadingContent(true);
    void workspaceSkillsGet(slug, selectedItem)
      .then((result) => {
        if (!cancelled) setFileContent(result.file.content);
      })
      .catch(() => {
        if (!cancelled) setFileContent(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, selectedItem]);

  const handleBack = useCallback(() => navigate("/skill-workbench"), [navigate]);
  const handleEditSkill = useCallback(() => {
    setMode("edit");
    void enterWorkbench();
    setSidebarOpen(true);
  }, [setMode, enterWorkbench]);

  // One-click flowchart generation: same interaction as "modify this skill",
  // but also asks enterWorkbench() to auto-send the flowchart generation prompt
  // (via pendingAutoSendMessage). The prompt itself lives in skill-workbench-store.
  const handleGenerateFlowchart = useCallback(() => {
    setPendingAutoSendMessage("generate");
    setMode("edit");
    void enterWorkbench();
    setSidebarOpen(true);
    // Mark the preview as "generating" so the empty state shows a spinner
    // instead of the generate button while the AI is working.
    setIsGeneratingFlowchart(true);
  }, [setPendingAutoSendMessage, setMode, enterWorkbench]);

  // Clear the generating flag only once FLOWCHART.md has actually been
  // loaded from disk. The panel now renders the full markdown document
  // directly, so streaming-extracted mermaid source alone is not enough
  // to dismiss the "generating" placeholder.
  useEffect(() => {
    if (!isGeneratingFlowchart) return;
    if (flowchartDocument.trim()) {
      setIsGeneratingFlowchart(false);
    }
  }, [isGeneratingFlowchart, flowchartDocument]);

  // Clear the A2UI generating flag once ui.json has been loaded from disk.
  useEffect(() => {
    if (!isGeneratingUi) return;
    if (uiJsonContent && uiJsonContent.trim()) {
      setIsGeneratingUi(false);
    }
  }, [isGeneratingUi, uiJsonContent]);

  // Ensure an edit session is active so the embedded debug chat can talk to
  // the Gateway. Returns once the session has been established.
  const ensureEditingSession = useCallback(async () => {
    setMode("edit");
    await enterWorkbench();
  }, [setMode, enterWorkbench]);

  // The A2UI debug panel and the flowchart panel now expose "修改技能" /
  // "重新生成" actions in their own header bars. Those are the only entry
  // points that should actively start an edit session and open the chat
  // sidebar — switching tabs is just a preview action and must not create
  // sessions or send messages on the user's behalf.

  const handleGenerateInputUi = useCallback(async () => {
    setIsGeneratingUi(true);
    await ensureEditingSession();
    setSidebarOpen(true);
    void useChatDockStore.getState().sendMessage(buildInputUiTaskPrompt(slug));
  }, [ensureEditingSession, slug]);

  const handleSubmitInputUi = useCallback(
    async (message: string, attachments?: ChatAttachment[]) => {
      await ensureEditingSession();
      setSidebarOpen(true);
      void useChatDockStore.getState().sendMessage(message, attachments);
    },
    [ensureEditingSession],
  );

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("skillWorkbench.detail.back")}
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-400">{t("skillWorkbench.home.title")}</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="font-medium text-gray-800 dark:text-gray-100">{displayName}</span>
        <span className="ml-1 font-mono text-xs text-gray-400">{slug}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: file tree */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <DetailFileSidebar
            files={fileList}
            selected={selectedItem}
            hasFlowchart={hasFlowchart}
            hasInputUi={hasInputUi}
            isLoading={isLoadingFiles}
            onSelect={setSelectedItem}
          />
        </div>

        {/* Middle: main view */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedItem === FLOWCHART_ITEM ? (
            <FlowchartPanel
              onGenerate={handleGenerateFlowchart}
              onRegenerate={handleGenerateFlowchart}
              onEditSkill={handleEditSkill}
              isGenerating={isGeneratingFlowchart}
            />
          ) : selectedItem === A2UI_ITEM ? (
            <A2uiDebugPanel
              uiJson={uiJsonContent}
              isLoading={isLoadingUiJson}
              isGenerating={isGeneratingUi}
              onGenerate={handleGenerateInputUi}
              onEditSkill={handleEditSkill}
              onSubmitForm={handleSubmitInputUi}
            />
          ) : (
            <SkillFileViewer
              skillSlug={slug}
              fileName={selectedItem}
              content={fileContent}
              isLoading={isLoadingContent}
              onSaved={(next) => {
                setFileContent(next);
                if (selectedItem.toUpperCase() === FLOWCHART_FILE_NAME.toUpperCase()) {
                  const mermaid = readMermaidFromContent(next);
                  setFlowchartDocument(next);
                  if (mermaid) setMermaidSource(mermaid);
                }
              }}
            />
          )}
        </div>

        {/* Right: chat sidebar. Collapsed by default — the user can open it
            via the panel's "修改技能" / "重新生成" actions, and close it via
            the close button rendered on the sidebar's own header bar. The
            WorkbenchChat component stays mounted in both states (we just
            collapse its width to 0) so an in-flight stream or unsent draft
            is never interrupted by toggling the sidebar. */}
        <div
          className={
            "flex shrink-0 flex-col overflow-hidden border-l border-gray-200 dark:border-gray-700 transition-[width] " +
            (sidebarOpen ? "w-[380px]" : "w-0 border-l-0")
          }
        >
          <div className="flex items-center justify-end border-b border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title={t("skillWorkbench.detail.closeChat")}
            >
              <PanelRightClose className="h-3.5 w-3.5" />
              {t("skillWorkbench.detail.closeChat")}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorkbenchChat mode="edit" disableA2uiForm={selectedItem === A2UI_ITEM} />
          </div>
        </div>
      </div>
    </>
  );
}
