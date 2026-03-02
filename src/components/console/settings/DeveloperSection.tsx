import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { REDACTED_SENTINEL } from "@/lib/provider-types";
import { useConfigStore } from "@/store/console-stores/config-store";

export function DeveloperSection() {
  const { t } = useTranslation("console");
  const config = useConfigStore((s) => s.config);
  const storeConfigPath = useConfigStore((s) => s.configPath);
  const status = useConfigStore((s) => s.status);
  const configRaw = useConfigStore((s) => s.configRaw);
  const configPath = (status?.configPath as string | undefined) ?? storeConfigPath;

  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const gatewayAuth = (config?.gateway as Record<string, unknown> | undefined)?.auth as
    | Record<string, unknown>
    | undefined;
  const tokenConfigured = gatewayAuth?.token === REDACTED_SENTINEL;
  const wsUrl = import.meta.env.VITE_GATEWAY_URL || "ws://localhost:18789";

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
        {t("settings.developer.title")}
      </h3>

      <div className="space-y-3">
        <DevRow
          label={t("settings.developer.gatewayToken")}
          value={tokenConfigured ? t("settings.developer.tokenConfigured") : "—"}
          hint={t("settings.developer.tokenHint")}
        />

        <DevRow
          label={t("settings.developer.configPath")}
          value={configPath ?? "—"}
          copyable
          onCopy={() => configPath && copyToClipboard(configPath, "path")}
          copied={copied === "path"}
          copiedLabel={t("settings.developer.copied")}
        />

        <DevRow
          label={t("settings.developer.wsUrl")}
          value={wsUrl}
          copyable
          onCopy={() => copyToClipboard(wsUrl, "ws")}
          copied={copied === "ws"}
          copiedLabel={t("settings.developer.copied")}
        />

        {configRaw && (
          <div>
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {showRaw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showRaw
                ? t("settings.developer.hideConfig")
                : t("settings.developer.showConfig")}{" "}
              {t("settings.developer.rawConfig")}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-gray-100 p-3 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                {configRaw}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DevRow({
  label,
  value,
  hint,
  copyable,
  onCopy,
  copied,
  copiedLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  copiedLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">{value}</p>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {copyable && onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title={copiedLabel}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
