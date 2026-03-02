import { Copy, Check, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface CommandResultDetailProps {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  warnings?: string[];
}

export function CommandResultDetail({
  stdout,
  stderr,
  exitCode,
  warnings,
}: CommandResultDetailProps) {
  const { t } = useTranslation("console");
  const [copied, setCopied] = useState(false);

  const hasOutput = Boolean(stdout?.trim() || stderr?.trim());

  const handleCopy = async () => {
    const parts: string[] = [];
    if (warnings?.length) parts.push(`Warnings:\n${warnings.join("\n")}`);
    if (stdout?.trim()) parts.push(`stdout:\n${stdout}`);
    if (stderr?.trim()) parts.push(`stderr:\n${stderr}`);
    if (exitCode != null) parts.push(`exit code: ${exitCode}`);

    await navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 dark:border-yellow-700 dark:bg-yellow-900/20">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-300"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {exitCode != null && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 dark:text-gray-400">{t("commandResult.exitCode")}:</span>
          <span
            className={
              exitCode === 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {exitCode}
          </span>
        </div>
      )}

      {hasOutput && (
        <div className="relative max-h-[300px] overflow-auto rounded-lg bg-gray-900 dark:bg-gray-800">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title={t("commandResult.copyAll")}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {stdout?.trim() && <pre className="p-3 text-xs text-gray-200">{stdout}</pre>}
          {stderr?.trim() && (
            <pre className="border-t border-red-700/50 p-3 text-xs text-red-300">{stderr}</pre>
          )}
        </div>
      )}
    </div>
  );
}
