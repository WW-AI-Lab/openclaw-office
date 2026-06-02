import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Pencil, Sparkles } from "lucide-react";
import { parseA2ui, buildSubmissionMessage, type A2uiValue } from "@/lib/a2ui-schema";
import type { ChatAttachment } from "@/gateway/adapter-types";
import { A2uiForm } from "@/components/chat/A2uiForm";

interface A2uiDebugPanelProps {
  /** Raw ui.json content loaded from the skill directory, or null if absent. */
  uiJson: string | null;
  isLoading: boolean;
  isGenerating: boolean;
  /** Fired when the user requests one-click generation / regeneration of ui.json. */
  onGenerate: () => void;
  /** Fired when the user requests to start an edit session for this skill. */
  onEditSkill?: () => void;
  /** Fired when the preview form is submitted with collected values and optional file attachments. */
  onSubmitForm: (message: string, attachments?: ChatAttachment[]) => void;
}

/**
 * A2UI input form preview panel.
 *
 * Renders ui.json as a live A2uiForm so the user can see what end-users will
 * see, and submits collected values back into the workbench chat via
 * `onSubmitForm`. The chat itself lives in the right sidebar (shared with the
 * FLOWCHART.md view) — keeping it here too would duplicate the interactive
 * form whenever the agent echoes a ```a2ui``` block back.
 */
export const A2uiDebugPanel = memo(function A2uiDebugPanel({
  uiJson,
  isLoading,
  isGenerating,
  onGenerate,
  onEditSkill,
  onSubmitForm,
}: A2uiDebugPanelProps) {
  const { t } = useTranslation("console");

  const form = useMemo(() => (uiJson ? parseA2ui(uiJson) : null), [uiJson]);

  const handleSubmit = (values: Record<string, A2uiValue>, attachments?: ChatAttachment[]) => {
    if (!form) return;
    onSubmitForm(buildSubmissionMessage(form, values), attachments);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <LayoutDashboard className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {t("skillWorkbench.a2ui.title")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onEditSkill && (
            <button
              onClick={onEditSkill}
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              title={t("skillWorkbench.detail.editSkill")}
            >
              <Pencil className="h-3 w-3" />
              {t("skillWorkbench.detail.editSkill")}
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            {form
              ? t("skillWorkbench.a2ui.regenerate")
              : t("skillWorkbench.a2ui.generate")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-sm text-gray-400">{t("skillWorkbench.browser.loading")}</div>
        ) : form ? (
          <A2uiForm form={form} onSubmit={handleSubmit} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <LayoutDashboard className="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
              {isGenerating
                ? t("skillWorkbench.a2ui.generating")
                : t("skillWorkbench.a2ui.empty")}
            </p>
            {!isGenerating && (
              <button
                onClick={onGenerate}
                className="flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
              >
                <Sparkles className="h-4 w-4" />
                {t("skillWorkbench.a2ui.generate")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
