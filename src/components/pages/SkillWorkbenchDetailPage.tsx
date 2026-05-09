import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, PanelRightClose, Pencil } from "lucide-react";
import { workspaceSkillsGet, workspaceSkillsList } from "@/gateway/workspace-skills-client";
import { useSkillsStore } from "@/store/console-stores/skills-store";
import {
  readMermaidFromContent,
  useSkillWorkbenchStore,
} from "@/store/console-stores/skill-workbench-store";
import { WorkbenchChat } from "@/components/console/skills/WorkbenchChat";
import { FlowchartPanel } from "@/components/console/skills/FlowchartPanel";
import { SkillFileViewer } from "@/components/console/skills/SkillFileViewer";
import { DetailFileSidebar, FLOWCHART_ITEM } from "@/components/console/skills/DetailFileSidebar";

const FLOWCHART_FILE_NAME = "FLOWCHART.md";

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

  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>(FLOWCHART_ITEM);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [hasFlowchart, setHasFlowchart] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingSessionStarted, setEditingSessionStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  const skill = useMemo(() => skills.find((s) => s.slug === slug), [skills, slug]);
  const displayName = skill?.name ?? slug;

  // Resolve slug → trigger workbench edit session + load files.
  useEffect(() => {
    if (!slug) return;
    void fetchSkills();
  }, [slug, fetchSkills]);

  // Default behavior: mark the current skill and reset mermaid, but DO NOT
  // create a chat session or inject skill context. The chat/edit session only
  // starts when the user clicks "modify this skill".
  useEffect(() => {
    if (!slug) return;
    setCurrentSkill(slug, skill?.name ?? slug);
    setMode("browse");
    resetMermaid();
    setEditingSessionStarted(false);
    setSidebarOpen(false);
  }, [slug, skill?.name, setCurrentSkill, setMode, resetMermaid]);

  // Load file tree + flowchart for this skill.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      setIsLoadingFiles(true);
      setFileList([]);
      setHasFlowchart(false);
      try {
        try {
          const flowchart = await workspaceSkillsGet(slug, FLOWCHART_FILE_NAME);
          if (cancelled) return;
          const mermaid = readMermaidFromContent(flowchart.file.content);
          setFlowchartDocument(flowchart.file.content);
          if (mermaid) {
            setMermaidSource(mermaid);
            setHasFlowchart(true);
          }
        } catch {
          // FLOWCHART.md may not exist yet.
        }

        try {
          const result = await workspaceSkillsList(slug);
          if (cancelled) return;
          const names = result.files.map((f) => f.name);
          setFileList(names);
          if (names.some((n) => n.toUpperCase() === FLOWCHART_FILE_NAME.toUpperCase())) {
            setHasFlowchart(true);
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
  }, [slug, setFlowchartDocument, setMermaidSource]);

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
            isLoading={isLoadingFiles}
            onSelect={setSelectedItem}
          />
        </div>

        {/* Middle: main view */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedItem === FLOWCHART_ITEM ? (
            <FlowchartPanel />
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

        {/* Right: chat sidebar (collapsible) */}
        {sidebarOpen && (
          <div className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-gray-200 dark:border-gray-700">
            <WorkbenchChat mode="edit" />
          </div>
        )}
      </div>
    </>
  );
}
