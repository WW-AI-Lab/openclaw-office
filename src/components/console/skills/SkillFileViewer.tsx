import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, GitCommit, Pencil, Save, ChevronDown, ChevronRight } from "lucide-react";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import {
  looksLikeJson,
  parseSkillFrontmatter,
  pickEmoji,
  pickObject,
  pickString,
  pickStringList,
  KNOWN_TOP_LEVEL_FIELDS,
  type SkillFrontmatter,
  type SkillFrontmatterRow,
} from "@/lib/skill-frontmatter";
import {
  workspaceSkillsCommit,
  workspaceSkillsSave,
  type WorkspaceSkillsCommitResult,
} from "@/gateway/workspace-skills-client";

interface SkillFileViewerProps {
  skillSlug: string;
  fileName: string;
  content: string | null;
  isLoading: boolean;
  onSaved?: (nextContent: string) => void;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string; tone: "ok" | "warn" | "error" };

const SKILL_MD_NAME = "SKILL.MD";

function isSkillMd(fileName: string): boolean {
  const segs = fileName.split("/");
  return segs[segs.length - 1].toUpperCase() === SKILL_MD_NAME;
}

function formatRowValue(value: string): string {
  if (!value) return "";
  if (looksLikeJson(value)) {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return value;
}

/* ──────── Structured metadata renderer ──────── */

function SkillMetadataPanel({ parsed }: { parsed: SkillFrontmatter }) {
  const { t } = useTranslation("console");
  const data = parsed.data;

  if (!data) {
    // Fallback: show raw KV rows
    return <FallbackFrontmatterCard rows={parsed.rows} />;
  }

  const name = pickString(data, "name");
  const description = pickString(data, "description");
  const emoji = pickEmoji(data);
  const license = pickString(data, "license");
  const pattern = pickString(data, "pattern");
  const compatibility = pickString(data, "compatibility");
  const version = pickString(data, "version");
  const author = pickString(data, "author");
  const tags = pickStringList(data, "tags") ?? pickStringList(data, "keywords");
  const metadata = pickObject(data, "metadata");

  // Gather extra fields not in KNOWN_TOP_LEVEL_FIELDS
  const knownSet = new Set<string>(KNOWN_TOP_LEVEL_FIELDS);
  const extraKeys = Object.keys(data).filter((k) => !knownSet.has(k));

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header row: emoji + name + badges */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        {emoji && <span className="text-xl">{emoji}</span>}
        {name ? (
          <span className="font-mono text-base font-semibold text-gray-800 dark:text-gray-100">
            {name}
          </span>
        ) : (
          <span className="text-xs text-gray-400">{t("skillWorkbench.detail.frontmatterTitle")}</span>
        )}
        {version && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            v{version}
          </span>
        )}
        {license && (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {license}
          </span>
        )}
        {pattern && (
          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            {pattern}
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
            {description}
          </p>
        </div>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-4 py-2 dark:border-gray-800">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Additional info row: author / compatibility */}
      {(author || compatibility) && (
        <div className="flex flex-wrap gap-4 border-b border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {author && (
            <span>
              <span className="font-medium text-gray-600 dark:text-gray-300">Author:</span>{" "}
              {author}
            </span>
          )}
          {compatibility && (
            <span>
              <span className="font-medium text-gray-600 dark:text-gray-300">Compatibility:</span>{" "}
              {compatibility}
            </span>
          )}
        </div>
      )}

      {/* Nested metadata tree */}
      {metadata && <MetadataTree label="metadata" value={metadata} />}

      {/* Extra unknown fields */}
      {extraKeys.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
          <dl className="space-y-1 text-xs">
            {extraKeys.map((key) => {
              const v = data[key];
              const display =
                v && typeof v === "object" ? JSON.stringify(v, null, 2) : String(v ?? "");
              const multiline = display.includes("\n");
              return (
                <div key={key} className="flex items-start gap-2">
                  <dt className="w-32 shrink-0 font-mono text-gray-500 dark:text-gray-400">
                    {key}
                  </dt>
                  <dd className="min-w-0 flex-1 text-gray-700 dark:text-gray-200">
                    {multiline ? (
                      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                        {display}
                      </pre>
                    ) : (
                      <span className="break-words">{display}</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}

/* Collapsible metadata tree for nested objects */
function MetadataTree({ label, value }: { label: string; value: Record<string, unknown> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
      <button
        type="button"
        className="flex w-full items-center gap-1 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <pre className="mx-4 mb-3 overflow-x-auto rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-950 dark:text-gray-200">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* Fallback: raw KV table when js-yaml fails */
function FallbackFrontmatterCard({ rows }: { rows: SkillFrontmatterRow[] }) {
  const { t } = useTranslation("console");
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        {t("skillWorkbench.detail.frontmatterEmpty")}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
        {t("skillWorkbench.detail.frontmatterTitle")}
      </div>
      <dl className="divide-y divide-gray-100 text-xs dark:divide-gray-800">
        {rows.map((row, idx) => {
          const val = formatRowValue(row.value);
          const multiline = val.includes("\n");
          return (
            <div
              key={`${row.key}-${idx}`}
              className="flex flex-col gap-1 px-3 py-1.5 sm:flex-row sm:items-start sm:gap-3"
              style={{ paddingLeft: 12 + row.depth * 12 }}
            >
              <dt className="w-40 shrink-0 font-mono text-gray-500 dark:text-gray-400">
                {row.key}
              </dt>
              <dd className="min-w-0 flex-1 text-gray-800 dark:text-gray-100">
                {val === "" ? (
                  <span className="text-gray-300 dark:text-gray-600">—</span>
                ) : multiline ? (
                  <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
                    {val}
                  </pre>
                ) : (
                  <span className="break-words">{val}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export const SkillFileViewer = memo(function SkillFileViewer({
  skillSlug,
  fileName,
  content,
  isLoading,
  onSaved,
}: SkillFileViewerProps) {
  const { t } = useTranslation("console");

  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState<string>(content ?? "");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  // Reset local state whenever selection/content changes.
  useEffect(() => {
    setDraft(content ?? "");
    setMode("preview");
    setSaveState({ kind: "idle" });
  }, [fileName, content]);

  const isMarkdown = fileName.endsWith(".md");
  const skillMd = isMarkdown && isSkillMd(fileName);

  const parsed = useMemo(
    () => (skillMd && content !== null ? parseSkillFrontmatter(content) : null),
    [skillMd, content],
  );

  const reportCommitResult = useCallback(
    (r: WorkspaceSkillsCommitResult) => {
      if (r.committed) {
        setSaveState({
          kind: "saved",
          tone: "ok",
          message: t("skillWorkbench.detail.commitOk", { commit: r.commit ?? "" }),
        });
      } else if (r.reason === "not_a_git_repo") {
        setSaveState({
          kind: "saved",
          tone: "warn",
          message: t("skillWorkbench.detail.commitSkippedNoRepo"),
        });
      } else if (r.reason === "nothing_to_commit") {
        setSaveState({
          kind: "saved",
          tone: "warn",
          message: t("skillWorkbench.detail.commitSkippedNothing"),
        });
      } else {
        setSaveState({
          kind: "saved",
          tone: "error",
          message: t("skillWorkbench.detail.commitFailed", { error: r.error ?? "unknown" }),
        });
      }
    },
    [t],
  );

  const handleSave = useCallback(
    async (opts: { commit: boolean }) => {
      if (!skillSlug || !fileName) return;
      setSaveState({ kind: "saving" });
      try {
        await workspaceSkillsSave(skillSlug, fileName, draft);
        onSaved?.(draft);
        if (!opts.commit) {
          setSaveState({
            kind: "saved",
            tone: "ok",
            message: t("skillWorkbench.detail.saved"),
          });
          return;
        }
        const result = await workspaceSkillsCommit(skillSlug, fileName);
        reportCommitResult(result);
      } catch (err) {
        setSaveState({
          kind: "saved",
          tone: "error",
          message: t("skillWorkbench.detail.saveFailed", { error: String(err) }),
        });
      }
    },
    [draft, fileName, onSaved, reportCommitResult, skillSlug, t],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {t("skillWorkbench.browser.loading")}
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {t("skillWorkbench.browser.loadError")}
      </div>
    );
  }

  const toneClass =
    saveState.kind === "saved"
      ? saveState.tone === "ok"
        ? "text-emerald-600 dark:text-emerald-400"
        : saveState.tone === "warn"
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400"
      : "text-gray-400";

  return (
    <div className="flex h-full flex-col">
      {/* Header: filename + mode + actions */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900">
        <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{fileName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setMode("preview")}
              className={`flex items-center gap-1 px-2 py-1 ${
                mode === "preview"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              <Eye className="h-3 w-3" />
              {t("skillWorkbench.detail.preview")}
            </button>
            <button
              onClick={() => setMode("edit")}
              className={`flex items-center gap-1 border-l border-gray-200 px-2 py-1 dark:border-gray-700 ${
                mode === "edit"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              <Pencil className="h-3 w-3" />
              {t("skillWorkbench.detail.edit")}
            </button>
          </div>

          <button
            onClick={() => void handleSave({ commit: false })}
            disabled={saveState.kind === "saving" || draft === content}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Save className="h-3 w-3" />
            {t("skillWorkbench.detail.save")}
          </button>
          <button
            onClick={() => void handleSave({ commit: true })}
            disabled={saveState.kind === "saving" || draft === content}
            className="flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GitCommit className="h-3 w-3" />
            {t("skillWorkbench.detail.saveAndCommit")}
          </button>
        </div>
      </div>

      {/* Status line */}
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-950">
        {saveState.kind === "saving" ? (
          <span className="text-gray-500">{t("skillWorkbench.detail.saving")}</span>
        ) : saveState.kind === "saved" ? (
          <span className={toneClass}>{saveState.message}</span>
        ) : (
          <span className="text-gray-400">&nbsp;</span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {mode === "edit" ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label={fileName}
            title={fileName}
            className="h-full w-full resize-none rounded-md border border-gray-200 bg-white p-3 font-mono text-xs text-gray-800 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        ) : skillMd && parsed ? (
          <div className="space-y-4">
            <SkillMetadataPanel parsed={parsed} />
            {parsed.body.trim().length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {t("skillWorkbench.detail.bodyTitle")}
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <MarkdownContent content={parsed.body} />
                </div>
              </div>
            )}
          </div>
        ) : isMarkdown ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <MarkdownContent content={content} />
          </div>
        ) : (
          <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
});
