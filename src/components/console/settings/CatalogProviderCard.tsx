import { Brain, Image, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ModelCatalogEntry } from "@/gateway/adapter-types";
import { inferProviderType } from "@/lib/provider-types";

interface CatalogProviderCardProps {
  providerId: string;
  models: ModelCatalogEntry[];
}

export function CatalogProviderCard({ providerId, models }: CatalogProviderCardProps) {
  const { t } = useTranslation("console");
  const meta = inferProviderType(providerId);
  const reasoningCount = models.filter((m) => m.reasoning === true).length;
  const imageCount = models.filter((m) => m.input?.includes("image")).length;

  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-900/10">
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
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300">
                <Shield className="h-3 w-3" />
                {t("settings.providers.systemDiscovered")}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {models.map((m) => (
                <span
                  key={m.id}
                  className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  title={`${providerId}/${m.id}`}
                >
                  {m.name || m.id}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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

          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            {meta.requiresApiKey ? "OAuth" : t("settings.providers.apiKeyConfigured")}
          </span>
        </div>
      </div>
    </div>
  );
}
