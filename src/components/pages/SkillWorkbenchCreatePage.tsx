import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { WorkbenchLayout } from "@/components/console/skills/WorkbenchLayout";
import { WorkbenchChat } from "@/components/console/skills/WorkbenchChat";
import { FlowchartPanel } from "@/components/console/skills/FlowchartPanel";
import { CreateSuggestionsPanel } from "@/components/console/skills/CreateSuggestionsPanel";
import { useSkillWorkbenchStore } from "@/store/console-stores/skill-workbench-store";

export function SkillWorkbenchCreatePage() {
  const { t } = useTranslation("console");
  const navigate = useNavigate();
  const setMode = useSkillWorkbenchStore((s) => s.setMode);
  const clearCurrentSkill = useSkillWorkbenchStore((s) => s.clearCurrentSkill);
  const resetMermaid = useSkillWorkbenchStore((s) => s.resetMermaid);
  const enterWorkbench = useSkillWorkbenchStore((s) => s.enterWorkbench);

  useEffect(() => {
    // Always start fresh when entering the create flow: no focused skill,
    // no leftover mermaid. enterWorkbench() will call chatStore.newSession()
    // which gives us an empty chat with system context injected.
    clearCurrentSkill();
    resetMermaid();
    setMode("create");
    void enterWorkbench();
    // NOTE: no cleanup here — the layout-level leaveWorkbench() handles it.
  }, [clearCurrentSkill, resetMermaid, setMode, enterWorkbench]);

  const handleBack = useCallback(() => {
    navigate("/skill-workbench");
  }, [navigate]);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          title={t("skillWorkbench.create.back")}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("skillWorkbench.create.back")}
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-400">{t("skillWorkbench.home.title")}</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="font-medium text-gray-800 dark:text-gray-100">
          {t("skillWorkbench.create.breadcrumb")}
        </span>
      </div>
      <WorkbenchLayout
        left={<WorkbenchChat mode="create" emptyStateSlot={<CreateSuggestionsPanel />} />}
        right={<FlowchartPanel />}
      />
    </>
  );
}
