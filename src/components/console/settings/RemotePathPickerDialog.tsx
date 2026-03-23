import { ChevronRight, FolderPlus, FolderTree, Loader2, RefreshCcw, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildDiscoveredChildDirectories,
  type DiscoveredRemotePath,
} from "@/lib/remote-path-discovery";
import {
  appendRemotePath,
  buildRemotePathBreadcrumbs,
  coerceRemotePathToRoot,
  dedupeRemotePaths,
  filterRemotePathsWithinRoot,
  getRemotePathParent,
  isRemotePathWithinRoot,
  normalizeRemotePath,
} from "@/lib/remote-path-utils";

interface RemotePathPickerDialogProps {
  open: boolean;
  title: string;
  value: string;
  hostLabel: string;
  workspaceRoot: string;
  suggestedPaths: string[];
  discoveredPaths: DiscoveredRemotePath[];
  discoveredPathsLoading?: boolean;
  discoveredPathsError?: string | null;
  onRefreshDiscoveredPaths?: () => void;
  onClose: () => void;
  onApply: (value: string) => void;
}

export function RemotePathPickerDialog({
  open,
  title,
  value,
  hostLabel,
  workspaceRoot,
  suggestedPaths,
  discoveredPaths,
  discoveredPathsLoading = false,
  discoveredPathsError = null,
  onRefreshDiscoveredPaths,
  onClose,
  onApply,
}: RemotePathPickerDialogProps) {
  const { t } = useTranslation(["console", "common"]);
  const [draftPath, setDraftPath] = useState(value);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftPath(value.trim() ? coerceRemotePathToRoot(value, workspaceRoot) : workspaceRoot);
    setNewFolderName("");
  }, [open, value, workspaceRoot]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const effectiveSuggestions = useMemo(
    () => filterRemotePathsWithinRoot(dedupeRemotePaths([workspaceRoot, ...suggestedPaths, draftPath]), workspaceRoot),
    [draftPath, suggestedPaths, workspaceRoot],
  );
  const breadcrumbs = useMemo(() => buildRemotePathBreadcrumbs(draftPath), [draftPath]);
  const parentPath = useMemo(() => {
    const nextParent = getRemotePathParent(draftPath);
    if (!nextParent) {
      return workspaceRoot;
    }
    return isRemotePathWithinRoot(nextParent, workspaceRoot) ? nextParent : workspaceRoot;
  }, [draftPath, workspaceRoot]);
  const discoveredChildren = useMemo(
    () => buildDiscoveredChildDirectories(draftPath, discoveredPaths),
    [discoveredPaths, draftPath],
  );

  const handleAppendFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      return;
    }

    setDraftPath((current) =>
      coerceRemotePathToRoot(
        normalizeRemotePath(appendRemotePath(current || workspaceRoot, trimmed)),
        workspaceRoot,
      ),
    );
    setNewFolderName("");
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[88vh] w-[min(860px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-blue-500" />
              <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("settings.workspacePaths.pickerTitle", { label: title })}
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("settings.workspacePaths.pickerDescription")}
            </p>
            <p className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200">
              {t("settings.workspacePaths.fixedRootBadge", { root: workspaceRoot })}
            </p>
            {hostLabel && (
              <p className="mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200">
                {t("settings.workspacePaths.pickerHostBadge", { host: hostLabel })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title={t("common:actions.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("settings.workspacePaths.pickerManualInput")}
              </label>
              <input
                type="text"
                value={draftPath}
                onChange={(event) =>
                  setDraftPath(coerceRemotePathToRoot(event.target.value, workspaceRoot))
                }
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-500"
                placeholder={t("settings.workspacePaths.pickerManualPlaceholder", { root: workspaceRoot })}
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("settings.workspacePaths.pickerQuickStarts")}
              </div>
              <div className="flex flex-wrap gap-2">
                {effectiveSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setDraftPath(suggestion)}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-900/20 dark:hover:text-blue-200"
                    title={t("settings.workspacePaths.pickerUseSuggestion", { path: suggestion })}
                  >
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("settings.workspacePaths.pickerDiscoveredTitle")}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("settings.workspacePaths.pickerDiscoveredDescription")}
                  </p>
                </div>
                {onRefreshDiscoveredPaths && (
                  <button
                    type="button"
                    onClick={onRefreshDiscoveredPaths}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500/50 dark:hover:text-blue-200"
                    disabled={discoveredPathsLoading}
                  >
                    {discoveredPathsLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-3.5 w-3.5" />
                    )}
                    <span>{t("settings.workspacePaths.pickerRefreshDiscovered")}</span>
                  </button>
                )}
              </div>

              {discoveredPathsError ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                  {t("settings.workspacePaths.pickerDiscoveredError", { error: discoveredPathsError })}
                </p>
              ) : discoveredPaths.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {discoveredPaths.map((item) => (
                      <button
                        key={`${item.kind}:${item.source}:${item.path}`}
                        type="button"
                        onClick={() => setDraftPath(item.path)}
                        className="inline-flex max-w-full flex-col items-start rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500/50 dark:hover:bg-blue-900/20 dark:hover:text-blue-200"
                      >
                        <span className="truncate font-medium">{item.path}</span>
                        <span className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                          {item.source}
                        </span>
                      </button>
                    ))}
                  </div>

                  {draftPath && discoveredChildren.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t("settings.workspacePaths.pickerChildDirectories")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {discoveredChildren.map((item) => (
                          <button
                            key={`child:${item.path}`}
                            type="button"
                            onClick={() => setDraftPath(item.path)}
                            className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:border-blue-400/60 dark:hover:bg-blue-900/30"
                          >
                            <span className="truncate">{item.path}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : discoveredPathsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("settings.workspacePaths.pickerDiscoveredLoading")}</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("settings.workspacePaths.pickerDiscoveredEmpty")}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("settings.workspacePaths.pickerBreadcrumbs")}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftPath(parentPath || workspaceRoot)}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500/50 dark:hover:text-blue-200"
                    disabled={!draftPath || parentPath === draftPath || draftPath === workspaceRoot}
                  >
                    {t("settings.workspacePaths.pickerUpLevel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftPath(workspaceRoot)}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition-colors hover:border-red-300 hover:text-red-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-red-500/50 dark:hover:text-red-300"
                    disabled={!draftPath || draftPath === workspaceRoot}
                  >
                    {t("settings.workspacePaths.pickerClear")}
                  </button>
                </div>
              </div>

              {breadcrumbs.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={`${crumb.path}-${index}`} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftPath(crumb.path)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-500/50 dark:hover:text-blue-200"
                      >
                        {crumb.label}
                      </button>
                      {index < breadcrumbs.length - 1 && (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("settings.workspacePaths.pickerEmpty")}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/70 p-4 dark:border-blue-500/40 dark:bg-blue-900/10">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <FolderPlus className="h-4 w-4" />
                <span>{t("settings.workspacePaths.pickerCreateFolder")}</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAppendFolder();
                    }
                  }}
                  placeholder={t("settings.workspacePaths.pickerCreateFolderPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 dark:border-blue-500/40 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAppendFolder}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                  disabled={!newFolderName.trim()}
                >
                  {t("settings.workspacePaths.pickerAppendFolder")}
                </button>
              </div>
              <p className="mt-2 text-xs text-blue-700/80 dark:text-blue-200/80">
                {t("settings.workspacePaths.pickerCreateFolderHelp")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setDraftPath(value)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
          >
            <RotateCcw className="h-4 w-4" />
            {t("settings.workspacePaths.pickerReset")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onApply(coerceRemotePathToRoot(draftPath || workspaceRoot, workspaceRoot))}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t("settings.workspacePaths.pickerApply")}
          </button>
        </div>
      </div>
    </div>
  );
}
