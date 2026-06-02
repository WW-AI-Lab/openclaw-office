import { memo, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Code,
  File,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  LayoutDashboard,
} from "lucide-react";
import {
  buildFileTree,
  expandedPathsForSelection,
  type FileTreeNode,
} from "@/lib/build-file-tree";

export const FLOWCHART_ITEM = "__flowchart__";
export const A2UI_ITEM = "__a2ui__";
const FLOWCHART_FILE_NAME = "FLOWCHART.md";
const A2UI_FILE_NAME = "ui.json";

interface DetailFileSidebarProps {
  files: string[];
  selected: string;
  hasFlowchart: boolean;
  hasInputUi: boolean;
  isLoading: boolean;
  onSelect: (item: string) => void;
}

function iconForFile(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md")) return FileText;
  if (/\.(py|js|mjs|cjs|ts|tsx|jsx|json|yaml|yml|sh|ps1|rb|go|rs|toml|html|css)$/.test(lower)) {
    return Code;
  }
  if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/.test(lower)) return ImageIcon;
  return File;
}

interface TreeRowProps {
  node: FileTreeNode;
  depth: number;
  selected: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function TreeRow({ node, depth, selected, expanded, onToggle, onSelect }: TreeRowProps) {
  const padding = 8 + depth * 14;

  if (node.kind === "dir") {
    const isOpen = expanded.has(node.path);
    return (
      <>
        <button
          onClick={() => onToggle(node.path)}
          className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          style={{ paddingLeft: padding }}
          title={node.path}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
          )}
          {isOpen ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
          <span className="flex-1 truncate">{node.name}</span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
      </>
    );
  }

  const isSelected = selected === node.path;
  const Icon = iconForFile(node.name);
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs transition-colors ${
        isSelected
          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      }`}
      style={{ paddingLeft: padding + 12 }}
      title={node.path}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="flex-1 truncate font-mono">{node.name}</span>
    </button>
  );
}

/**
 * Sidebar for the skill detail page. Always shows the "Flowchart" tab first
 * (which maps to the Mermaid preview in the main pane), followed by a
 * GitHub-style directory tree of real workspace files from workspace-skills-list.
 */
export const DetailFileSidebar = memo(function DetailFileSidebar({
  files,
  selected,
  hasFlowchart,
  hasInputUi,
  isLoading,
  onSelect,
}: DetailFileSidebarProps) {
  const { t } = useTranslation("console");

  const fileEntries = useMemo(
    () =>
      files.filter(
        (name) =>
          name.toUpperCase() !== FLOWCHART_FILE_NAME.toUpperCase() &&
          name.toLowerCase() !== A2UI_FILE_NAME.toLowerCase(),
      ),
    [files],
  );

  const tree = useMemo(() => buildFileTree(fileEntries), [fileEntries]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Auto-expand ancestors of the currently selected file whenever selection
  // changes (but only add; never collapse what the user already opened).
  useEffect(() => {
    if (!selected || selected === FLOWCHART_ITEM) return;
    const ancestors = expandedPathsForSelection(selected);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const p of ancestors) {
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selected]);

  const handleToggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {t("skillWorkbench.detail.filesTitle")}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {/* Flowchart virtual entry */}
        <button
          onClick={() => onSelect(FLOWCHART_ITEM)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            selected === FLOWCHART_ITEM
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          <GitBranch className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{t("skillWorkbench.detail.flowchartTab")}</span>
          {!hasFlowchart && (
            <span className="text-[10px] text-gray-400">
              {t("skillWorkbench.detail.flowchartMissing")}
            </span>
          )}
        </button>

        {/* A2UI debug virtual entry */}
        <button
          onClick={() => onSelect(A2UI_ITEM)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            selected === A2UI_ITEM
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{t("skillWorkbench.detail.a2uiTab")}</span>
          {!hasInputUi && (
            <span className="text-[10px] text-gray-400">
              {t("skillWorkbench.detail.a2uiMissing")}
            </span>
          )}
        </button>

        {/* File tree */}
        {isLoading && (
          <div className="px-3 py-4 text-xs text-gray-400">
            {t("skillWorkbench.browser.loading")}
          </div>
        )}
        {!isLoading && fileEntries.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-400">
            {t("skillWorkbench.detail.noFiles")}
          </div>
        )}
        {!isLoading &&
          tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              selected={selected}
              expanded={expanded}
              onToggle={handleToggle}
              onSelect={onSelect}
            />
          ))}
      </div>
    </div>
  );
});
