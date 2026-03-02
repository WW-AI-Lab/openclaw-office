import { Pencil, Trash2, CheckCircle, XCircle, Brain, Image } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inferProviderType, REDACTED_SENTINEL } from "@/lib/provider-types";

interface ProviderCardProps {
  providerId: string;
  config: Record<string, unknown>;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProviderCard({ providerId, config, onEdit, onDelete }: ProviderCardProps) {
  const { t } = useTranslation("console");
  const meta = inferProviderType(
    providerId,
    config.api as string | undefined,
    config.baseUrl as string | undefined,
  );
  const hasAuth = typeof config.auth === "string" && config.auth.length > 0;
  const hasApiKey =
    hasAuth ||
    config.apiKey === REDACTED_SENTINEL ||
    (typeof config.apiKey === "string" && config.apiKey.length > 0);
  const models = Array.isArray(config.models) ? config.models : [];
  const reasoningCount = models.filter((m: Record<string, unknown>) => m.reasoning === true).length;
  const imageCount = models.filter(
    (m: Record<string, unknown>) =>
      Array.isArray(m.input) && (m.input as string[]).includes("image"),
  ).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl" title={meta.name}>
            {meta.icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {providerId}
              </span>
              {meta.id !== providerId && (
                <span className="text-xs text-gray-500 dark:text-gray-400">({meta.name})</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {typeof config.baseUrl === "string" && config.baseUrl && (
                <span className="truncate max-w-48" title={config.baseUrl}>
                  {config.baseUrl}
                </span>
              )}
              {typeof config.api === "string" && <span>{config.api}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Model badges */}
          {models.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t("settings.providers.modelCount", { count: models.length })}
              </span>
              {reasoningCount > 0 && (
                <span
                  className="flex items-center gap-0.5 text-xs text-purple-600 dark:text-purple-400"
                  title={t("settings.providers.models.reasoning")}
                >
                  <Brain className="h-3 w-3" />
                  {reasoningCount}
                </span>
              )}
              {imageCount > 0 && (
                <span
                  className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400"
                  title={t("settings.providers.models.input_image")}
                >
                  <Image className="h-3 w-3" />
                  {imageCount}
                </span>
              )}
            </div>
          )}

          {meta.requiresApiKey && (
            <span className="flex items-center gap-1 text-xs">
              {hasApiKey ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    {t("settings.providers.apiKeyConfigured")}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">
                    {t("settings.providers.apiKeyNotConfigured")}
                  </span>
                </>
              )}
            </span>
          )}

          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
