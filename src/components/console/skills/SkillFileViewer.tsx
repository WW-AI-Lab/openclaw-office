import { memo } from "react";
import { useTranslation } from "react-i18next";
import { MarkdownContent } from "@/components/chat/MarkdownContent";

interface SkillFileViewerProps {
  fileName: string;
  content: string | null;
  isLoading: boolean;
}

export const SkillFileViewer = memo(function SkillFileViewer({
  fileName,
  content,
  isLoading,
}: SkillFileViewerProps) {
  const { t } = useTranslation("console");

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

  const isMarkdown = fileName.endsWith(".md");

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{fileName}</div>
      {isMarkdown ? (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <MarkdownContent content={content} />
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
});
