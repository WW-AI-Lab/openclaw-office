import { AlertTriangle, FolderOpen, WandSparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { waitForAdapter } from "@/gateway/adapter-provider";
import {
  AGENT_PATH_DEFINITIONS,
  type AgentPathDefinition,
} from "@/lib/chat-path-context";
import {
  extractDiscoveredRemotePaths,
  mergeDiscoveredRemotePaths,
  type DiscoveredRemotePath,
} from "@/lib/remote-path-discovery";
import {
  coerceRemotePathToRoot,
  filterRemotePathsWithinRoot,
  FIXED_REMOTE_WORKSPACE_ROOT,
} from "@/lib/remote-path-utils";
import { useConfigStore } from "@/store/console-stores/config-store";
import { useConsoleSettingsStore } from "@/store/console-stores/settings-store";
import { RemotePathPickerDialog } from "./RemotePathPickerDialog";

export function WorkspacePathsSection() {
  const { t } = useTranslation("console");
  const agentPaths = useConsoleSettingsStore((s) => s.agentPaths);
  const setAgentPath = useConsoleSettingsStore((s) => s.setAgentPath);
  const config = useConfigStore((s) => s.config);
  const configPath = useConfigStore((s) => s.configPath);
  const resolvedHostLabel = agentPaths.hostLabel || t("settings.workspacePaths.hostAutoFallback");
  const [pickerKey, setPickerKey] = useState<AgentPathDefinition["key"] | null>(null);
  const [discoveredPaths, setDiscoveredPaths] = useState<DiscoveredRemotePath[]>([]);
  const [isLoadingDiscoveredPaths, setIsLoadingDiscoveredPaths] = useState(false);
  const [discoveredPathsError, setDiscoveredPathsError] = useState<string | null>(null);
  const activeDefinition = pickerKey
    ? AGENT_PATH_DEFINITIONS.find((definition) => definition.key === pickerKey) ?? null
    : null;
  const loadDiscoveredPaths = useCallback(async () => {
    const configHints = extractDiscoveredRemotePaths(config, configPath);
    setIsLoadingDiscoveredPaths(true);
    setDiscoveredPathsError(null);

    try {
      const adapter = await waitForAdapter();
      const agents = await adapter.agentsList();
      const workspaceResults = await Promise.allSettled(
        agents.agents.map(async (agent) => {
          const files = await adapter.agentsFilesList(agent.id);
          return {
            path: files.workspace,
            source: `agent:${agent.id}.workspace`,
            kind: "workspace" as const,
          };
        }),
      );

      const workspaceHints = workspaceResults.flatMap((result) =>
        result.status === "fulfilled" && result.value.path
          ? [result.value]
          : [],
      );

      setDiscoveredPaths(
        mergeDiscoveredRemotePaths(configHints, workspaceHints).filter((item) =>
          filterRemotePathsWithinRoot([item.path], FIXED_REMOTE_WORKSPACE_ROOT).length > 0,
        ),
      );
    } catch (error) {
      setDiscoveredPaths(
        configHints.filter((item) =>
          filterRemotePathsWithinRoot([item.path], FIXED_REMOTE_WORKSPACE_ROOT).length > 0,
        ),
      );
      setDiscoveredPathsError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingDiscoveredPaths(false);
    }
  }, [config, configPath]);

  useEffect(() => {
    void loadDiscoveredPaths();
  }, [loadDiscoveredPaths]);

  const pickerSuggestions = useMemo(() => {
    if (!activeDefinition) {
      return [];
    }

    return filterRemotePathsWithinRoot([
      FIXED_REMOTE_WORKSPACE_ROOT,
      ...AGENT_PATH_DEFINITIONS.map((definition) => agentPaths[definition.key]),
      ...discoveredPaths.map((item) => item.path),
    ]);
  }, [activeDefinition, agentPaths, discoveredPaths]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
          <FolderOpen className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("settings.workspacePaths.title")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("settings.workspacePaths.description")}
          </p>
          <p className="mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200">
            {t("settings.workspacePaths.fixedRootBadge", { root: FIXED_REMOTE_WORKSPACE_ROOT })}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("settings.workspacePaths.remoteHint")}</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("settings.workspacePaths.hostLabel")}
          </span>
          <input
            type="text"
            value={agentPaths.hostLabel}
            onChange={(event) => setAgentPath("hostLabel", event.target.value)}
            placeholder={t("settings.workspacePaths.hostPlaceholder")}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-500"
          />
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
            {t("settings.workspacePaths.hostHelp", { host: resolvedHostLabel })}
          </span>
        </label>
        {AGENT_PATH_DEFINITIONS.map((definition) => (
          <label key={definition.key} className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t(definition.consoleLabelKey)}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={agentPaths[definition.key]}
                onChange={(event) =>
                  setAgentPath(
                    definition.key,
                    coerceRemotePathToRoot(event.target.value, FIXED_REMOTE_WORKSPACE_ROOT),
                  )
                }
                placeholder={t(definition.consolePlaceholderKey)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setPickerKey(definition.key)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:border-blue-400/60 dark:hover:bg-blue-900/30"
              >
                <WandSparkles className="h-4 w-4" />
                <span>{t("settings.workspacePaths.pickerOpen")}</span>
              </button>
            </div>
          </label>
        ))}
      </div>

      {activeDefinition && (
        <RemotePathPickerDialog
          open={Boolean(activeDefinition)}
          title={t(activeDefinition.consoleLabelKey)}
          value={agentPaths[activeDefinition.key]}
          hostLabel={resolvedHostLabel}
          workspaceRoot={FIXED_REMOTE_WORKSPACE_ROOT}
          suggestedPaths={pickerSuggestions}
          discoveredPaths={discoveredPaths}
          discoveredPathsLoading={isLoadingDiscoveredPaths}
          discoveredPathsError={discoveredPathsError}
          onRefreshDiscoveredPaths={() => {
            void loadDiscoveredPaths();
          }}
          onClose={() => setPickerKey(null)}
          onApply={(value) => {
            setAgentPath(activeDefinition.key, coerceRemotePathToRoot(value, FIXED_REMOTE_WORKSPACE_ROOT));
            setPickerKey(null);
          }}
        />
      )}
    </div>
  );
}
