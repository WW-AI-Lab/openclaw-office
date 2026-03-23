import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AGENT_PATH_DEFINITIONS,
  buildChatPathReference,
  buildChatPathReferenceBundle,
  getConfiguredAgentPaths,
} from "@/lib/chat-path-context";
import { useConsoleSettingsStore } from "@/store/console-stores/settings-store";

interface ChatPathReferenceBarProps {
  onInsertReference: (reference: string) => void;
}

export function ChatPathReferenceBar({ onInsertReference }: ChatPathReferenceBarProps) {
  const { t } = useTranslation("chat");
  const navigate = useNavigate();
  const agentPaths = useConsoleSettingsStore((s) => s.agentPaths);
  const configuredPaths = getConfiguredAgentPaths(agentPaths);
  const hostLabel = agentPaths.hostLabel.trim();
  const hostReference = hostLabel ? `${t("dock.pathReferenceHost")}: \`${hostLabel}\`` : "";
  const bundleReference = buildChatPathReferenceBundle([
    hostReference,
    ...configuredPaths.map(({ key, value }) => {
      const definition = AGENT_PATH_DEFINITIONS.find((item) => item.key === key);
      if (!definition) return "";
      return `${t(definition.chatLabelKey)}: \`${value}\``;
    }),
  ]);

  if (configuredPaths.length === 0) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {t("dock.pathReferences")}
        </span>
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="inline-flex items-center rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
        >
          {t("dock.configurePathReferences")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {t("dock.pathReferences")}
      </span>
      <button
        type="button"
        onClick={() => onInsertReference(bundleReference)}
        className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:border-blue-400/60 dark:hover:bg-blue-900/30"
        title={t("dock.insertPathBundle")}
      >
        <span className="shrink-0 font-medium">{t("dock.pathReferenceBundle")}</span>
      </button>
      {configuredPaths.map(({ key, value }) => {
        const definition = AGENT_PATH_DEFINITIONS.find((item) => item.key === key);
        if (!definition) {
          return null;
        }

        const label = t(definition.chatLabelKey);

        return (
          <button
            key={key}
            type="button"
            onClick={() => onInsertReference(buildChatPathReference(label, value, hostReference || undefined))}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-900/20 dark:hover:text-blue-200"
            title={t("dock.insertPathReference", { label })}
          >
            <span className="shrink-0 font-medium">{label}</span>
            <span className="truncate text-gray-400 dark:text-gray-500">{value}</span>
          </button>
        );
      })}
    </div>
  );
}
