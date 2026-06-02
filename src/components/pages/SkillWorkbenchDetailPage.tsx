import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, PanelRightClose, Pencil } from "lucide-react";
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
  const [editingSessionStarted, setEditingSessionStarted] = useState(false);
  const [isGeneratingFlowchart, setIsGeneratingFlowchart] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setEditingSessionStarted(false);
    setSidebarOpen(false);
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
    if (!editingSessionStarted) return;

    let cancelled = false;
    const refresh = async () => {
      await loadFlowchartFromDisk(slug, { markLoaded: true });
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
        // Ignore list refresh errors.
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [isChatStreaming, slug, editingSessionStarted, loadFlowchartFromDisk, loadUiJsonFromDisk]);

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
  const handleCopySlug = useCallback(() => {
    if (!slug) return;
    void navigator.clipboard.writeText(slug);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [slug]);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const handleStartEditing = useCallback(() => {
    setMode("edit");
    void enterWorkbench();
    setEditingSessionStarted(true);
    setSidebarOpen(true);
  }, [setMode, enterWorkbench]);

  // One-click flowchart generation: same interaction as "modify this skill",
  // but also asks enterWorkbench() to auto-send the flowchart generation prompt
  // (via pendingAutoSendMessage). The prompt itself lives in skill-workbench-store.
  const handleGenerateFlowchart = useCallback(() => {
    setPendingAutoSendMessage("generate");
    setMode("edit");
    void enterWorkbench();
    setEditingSessionStarted(true);
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
    if (editingSessionStarted) return;
    setMode("edit");
    await enterWorkbench();
    setEditingSessionStarted(true);
  }, [editingSessionStarted, setMode, enterWorkbench]);

  // Start the editing session automatically when the user opens the A2UI tab,
  // so the embedded debug chat is immediately usable.
  useEffect(() => {
    if (selectedItem !== A2UI_ITEM) return;
    if (editingSessionStarted) return;
    void ensureEditingSession();
  }, [selectedItem, editingSessionStarted, ensureEditingSession]);

  // The A2UI 调试 tab is the one place where the embedded chat is the
  // primary interaction surface (it drives ui.json generation + form
  // submission). Open the right sidebar automatically so the chat is
  // visible immediately, instead of forcing the user to click "open chat"
  // on top of opening the tab.
  useEffect(() => {
    if (selectedItem !== A2UI_ITEM) return;
    if (!editingSessionStarted) return;
    setSidebarOpen(true);
  }, [selectedItem, editingSessionStarted]);

  const handleGenerateInputUi = useCallback(async () => {
    setIsGeneratingUi(true);
    await ensureEditingSession();
    void useChatDockStore.getState().sendMessage(buildInputUiTaskPrompt(slug));
  }, [ensureEditingSession, slug]);

  const handleReloadInputUi = useCallback(() => {
    void loadUiJsonFromDisk(slug);
  }, [loadUiJsonFromDisk, slug]);

  const handleSubmitInputUi = useCallback(
    async (message: string, attachments?: ChatAttachment[]) => {
      await ensureEditingSession();
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

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCopySlug}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {t("skillWorkbench.detail.copySlug")}
          </button>
          {!editingSessionStarted ? (
            <button
              onClick={handleStartEditing}
              className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600"
              title={t("skillWorkbench.detail.editSkill")}
            >
              <Pencil className="h-3 w-3" />
              {t("skillWorkbench.detail.editSkill")}
            </button>
          ) : (
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              title={
                sidebarOpen
                  ? t("skillWorkbench.detail.closeChat")
                  : t("skillWorkbench.detail.openChat")
              }
            >
              {sidebarOpen ? (
                <PanelRightClose className="h-3 w-3" />
              ) : (
                <Pencil className="h-3 w-3" />
              )}
              {sidebarOpen
                ? t("skillWorkbench.detail.closeChat")
                : t("skillWorkbench.detail.openChat")}
            </button>
          )}
        </div>
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
              isGenerating={isGeneratingFlowchart}
            />
          ) : selectedItem === A2UI_ITEM ? (
            <A2uiDebugPanel
              uiJson={uiJsonContent}
              isLoading={isLoadingUiJson}
              isGenerating={isGeneratingUi}
              onGenerate={handleGenerateInputUi}
              onReload={handleReloadInputUi}
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

        {/* Right: chat sidebar (collapsible). In the A2UI 调试 tab we pass
            `disableA2uiForm` so the chat transcript does not duplicate the
            interactive A2uiForm that the middle panel is already showing. */}
        {sidebarOpen && (
          <div className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-gray-200 dark:border-gray-700">
            <WorkbenchChat mode="edit" disableA2uiForm={selectedItem === A2UI_ITEM} />
          </div>
        )}
      </div>
    </>
  );
}
