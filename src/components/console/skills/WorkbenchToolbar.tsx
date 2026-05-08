import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Eye, Pencil } from "lucide-react";

export type WorkbenchMode = "create" | "browse" | "edit";

interface WorkbenchToolbarProps {
  mode: WorkbenchMode;
  onModeChange: (mode: WorkbenchMode) => void;
  currentSkillName?: string;
}

const modeIcons = { create: Plus, browse: Eye, edit: Pencil } as const;
const modeKeys = ["create", "browse", "edit"] as const;

export const WorkbenchToolbar = memo(function WorkbenchToolbar({
  mode,
  onModeChange,
  currentSkillName,
}: WorkbenchToolbarProps) {
  const { t } = useTranslation("console");

  return (
    <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
      {/* Mode switch */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
        {modeKeys.map((m) => {
          const Icon = modeIcons[m];
          const isActive = mode === m;
          return (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors first:rounded-l-lg last:rounded-r-lg ${
                isActive
                  ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t(`skillWorkbench.toolbar.${m}`)}</span>
            </button>
          );
        })}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>{t(`skillWorkbench.status.${mode === "create" ? "creating" : mode === "edit" ? "editing" : "browsing"}`)}</span>
        {currentSkillName && (
          <>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{currentSkillName}</span>
          </>
        )}
      </div>
    </div>
  );
});
