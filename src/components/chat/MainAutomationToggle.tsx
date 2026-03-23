import { Bot, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConsoleSettingsStore } from "@/store/console-stores/settings-store";

interface MainAutomationToggleProps {
  visible: boolean;
}

export function MainAutomationToggle({ visible }: MainAutomationToggleProps) {
  const { t } = useTranslation("chat");
  const enabled = useConsoleSettingsStore((s) => s.mainAutomationEnabled);
  const setEnabled = useConsoleSettingsStore((s) => s.setMainAutomationEnabled);

  if (!visible) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:from-amber-950/30 dark:via-gray-900 dark:to-orange-950/20 dark:text-amber-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
            <span>{t("dock.mainAutomationLabel")}</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-amber-800/90 dark:text-amber-100/80">
            {t("dock.mainAutomationHint")}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700/80 dark:text-amber-200/70">
            <Bot className="h-3.5 w-3.5 shrink-0" />
            <span>{t("dock.mainAutomationBypassHint")}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 font-medium transition-colors ${
            enabled
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-white text-amber-800 ring-1 ring-amber-300 hover:bg-amber-50 dark:bg-gray-900 dark:text-amber-100 dark:ring-amber-400/40 dark:hover:bg-amber-950/30"
          }`}
        >
          {enabled ? t("dock.mainAutomationEnabled") : t("dock.mainAutomationDisabled")}
        </button>
      </div>
    </div>
  );
}
