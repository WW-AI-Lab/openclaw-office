import { X, Copy, Check, Terminal, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ClawHubInstallDialogProps {
  open: boolean;
  slug: string;
  displayName: string;
  onClose: () => void;
  onConfirmDone: () => void;
}

export function ClawHubInstallDialog({
  open,
  slug,
  displayName,
  onClose,
  onConfirmDone,
}: ClawHubInstallDialogProps) {
  const { t } = useTranslation("console");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const command = `clawhub install ${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t("clawhub.installTitle", { name: displayName })}
        </h2>

        <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              {t("clawhub.securityWarning")}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
            {t("clawhub.installCommand")}
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 dark:bg-gray-800">
            <Terminal className="h-4 w-4 shrink-0 text-gray-400" />
            <code className="flex-1 text-sm text-green-400">{command}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {t("clawhub.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirmDone}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("clawhub.installDone")}
          </button>
        </div>
      </div>
    </div>
  );
}
