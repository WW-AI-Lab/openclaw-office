import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb, Workflow, ListChecks, AlertTriangle } from "lucide-react";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";

interface SuggestionItem {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  descKey: string;
  promptKey: string;
}

const SUGGESTIONS: SuggestionItem[] = [
  {
    icon: Workflow,
    titleKey: "skillWorkbench.create.suggestionSopTitle",
    descKey: "skillWorkbench.create.suggestionSopDesc",
    promptKey: "skillWorkbench.create.suggestionSopPrompt",
  },
  {
    icon: ListChecks,
    titleKey: "skillWorkbench.create.suggestionMethodTitle",
    descKey: "skillWorkbench.create.suggestionMethodDesc",
    promptKey: "skillWorkbench.create.suggestionMethodPrompt",
  },
  {
    icon: AlertTriangle,
    titleKey: "skillWorkbench.create.suggestionFaqTitle",
    descKey: "skillWorkbench.create.suggestionFaqDesc",
    promptKey: "skillWorkbench.create.suggestionFaqPrompt",
  },
];

/**
 * Rendered inside WorkbenchChat's empty state on the create page.
 * Offers quick-start prompts that populate the chat draft so users know
 * what kind of structured input yields the best SKILL.md output.
 */
export const CreateSuggestionsPanel = memo(function CreateSuggestionsPanel() {
  const { t } = useTranslation("console");
  const setDraft = useChatDockStore((s) => s.setDraft);

  const handleUse = (promptKey: string) => {
    setDraft(t(promptKey));
  };

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-400">
        <Lightbulb className="h-5 w-5" />
        <h2 className="text-base font-semibold">{t("skillWorkbench.create.guideTitle")}</h2>
      </div>
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
        {t("skillWorkbench.create.guideSubtitle")}
      </p>

      <div className="space-y-2">
        {SUGGESTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.titleKey}
              onClick={() => handleUse(item.promptKey)}
              className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t(item.titleKey)}
                </div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t(item.descKey)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
        {t("skillWorkbench.create.tip")}
      </p>
    </div>
  );
});
