import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2 } from "lucide-react";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { useSkillWorkbenchStore } from "@/store/console-stores/skill-workbench-store";

interface FlowchartPanelProps {
  /**
   * Optional callback for the empty-state "Generate flowchart" action.
   * When provided, the empty state renders a primary button that triggers
   * the same chat-based interaction as "Modify this skill", but also
   * auto-sends a flowchart-generation prompt.
   */
  onGenerate?: () => void;
  /**
   * When true, the empty state renders a "generating" placeholder (spinner
   * + hint) instead of the generate button, to indicate that the user has
   * already triggered generation and the AI is working on it.
   */
  isGenerating?: boolean;
}

/**
 * Flowchart preview panel — intentionally minimal.
 *
 * Renders FLOWCHART.md as Markdown directly. Any embedded ```mermaid```
 * code blocks are rendered individually by MarkdownContent via MermaidPreview.
 * No view-mode toggle, no zoom/pan, no single-chart fallback — keep this
 * page a pure, faithful preview of whatever the AI wrote to disk.
 */
export const FlowchartPanel = memo(function FlowchartPanel({
  onGenerate,
  isGenerating = false,
}: FlowchartPanelProps = {}) {
  const { t } = useTranslation("console");
  const flowchartDocument = useSkillWorkbenchStore((s) => s.flowchartDocument);

  const hasDocument = flowchartDocument.trim().length > 0;

  if (!hasDocument) {
    return (
      <div className="flex h-full flex-col bg-white dark:bg-gray-900">
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-400">
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <p className="text-gray-500 dark:text-gray-300">
                {t("skillWorkbench.flowchart.generating")}
              </p>
              <p className="text-xs">{t("skillWorkbench.flowchart.generatingHint")}</p>
            </>
          ) : (
            <>
              <p>{t("skillWorkbench.flowchart.emptyState")}</p>
              <p className="text-xs">{t("skillWorkbench.flowchart.emptyHint")}</p>
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-600"
                  title={t("skillWorkbench.flowchart.generateHint")}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("skillWorkbench.flowchart.generate")}
                </button>
              )}
              {onGenerate && (
                <p className="text-[11px] text-gray-400">
                  {t("skillWorkbench.flowchart.generateHint")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex-1 overflow-auto p-4">
        <MarkdownContent content={flowchartDocument} />
      </div>
    </div>
  );
});
