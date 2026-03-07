import { Plus, BrainCircuit } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/console/shared/ConfirmDialog";
import { EmptyState } from "@/components/console/shared/EmptyState";
import type { ModelCatalogEntry } from "@/gateway/adapter-types";
import { useConfigStore } from "@/store/console-stores/config-store";
import { AddProviderDialog } from "./AddProviderDialog";
import { CatalogProviderCard } from "./CatalogProviderCard";
import { EditProviderDialog } from "./EditProviderDialog";
import { ProviderCard } from "./ProviderCard";

function extractProviders(
  config: Record<string, unknown> | null,
): Record<string, Record<string, unknown>> {
  if (!config) return {};
  const models = config.models as Record<string, unknown> | undefined;
  const providers = models?.providers as Record<string, Record<string, unknown>> | undefined;
  return providers ?? {};
}

function groupCatalogByProvider(
  catalog: ModelCatalogEntry[],
  configuredProviderIds: Set<string>,
): Map<string, ModelCatalogEntry[]> {
  const groups = new Map<string, ModelCatalogEntry[]>();
  for (const entry of catalog) {
    if (configuredProviderIds.has(entry.provider)) continue;
    if (!groups.has(entry.provider)) groups.set(entry.provider, []);
    groups.get(entry.provider)!.push(entry);
  }
  return groups;
}

export function ProvidersSection() {
  const { t } = useTranslation("console");
  const config = useConfigStore((s) => s.config);
  const saveConfig = useConfigStore((s) => s.saveConfig);
  const applyConfig = useConfigStore((s) => s.applyConfig);
  const catalogModels = useConfigStore((s) => s.catalogModels);
  const fetchCatalogModels = useConfigStore((s) => s.fetchCatalogModels);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    config: Record<string, unknown>;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (catalogModels.length === 0) fetchCatalogModels();
  }, [catalogModels.length, fetchCatalogModels]);

  const providers = extractProviders(config);
  const providerEntries = Object.entries(providers);
  const configuredIds = new Set(Object.keys(providers));
  const catalogGroups = groupCatalogByProvider(catalogModels, configuredIds);

  const handleAdd = async (
    id: string,
    provConfig: Record<string, unknown>,
    intent: "save" | "apply",
  ) => {
    const mutate = intent === "apply" ? applyConfig : saveConfig;
    await mutate((currentConfig) => {
      const nextConfig = currentConfig;
      const models = (nextConfig.models as Record<string, unknown> | undefined) ?? {};
      const existingProviders =
        (models.providers as Record<string, Record<string, unknown>> | undefined) ?? {};
      nextConfig.models = {
        ...models,
        providers: {
          ...existingProviders,
          [id]: provConfig,
        },
      };
      return nextConfig;
    });
    setAddOpen(false);
  };

  const handleEdit = async (patch: Record<string, unknown>, intent: "save" | "apply") => {
    if (!editTarget) return;
    const mutate = intent === "apply" ? applyConfig : saveConfig;
    await mutate((currentConfig) => {
      const nextConfig = currentConfig;
      const models = (nextConfig.models as Record<string, unknown> | undefined) ?? {};
      const existingProviders =
        (models.providers as Record<string, Record<string, unknown>> | undefined) ?? {};
      nextConfig.models = {
        ...models,
        providers: {
          ...existingProviders,
          [editTarget.id]: patch,
        },
      };
      return nextConfig;
    });
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await saveConfig((currentConfig) => {
      const nextConfig = currentConfig;
      const models = (nextConfig.models as Record<string, unknown> | undefined) ?? {};
      const existingProviders = {
        ...(((models.providers as Record<string, Record<string, unknown>> | undefined) ?? {})),
      };
      delete existingProviders[deleteTarget];
      nextConfig.models = {
        ...models,
        providers: existingProviders,
      };
      return nextConfig;
    });
    setDeleteTarget(null);
  };

  const hasAnyProvider = providerEntries.length > 0 || catalogGroups.size > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("settings.providers.title")}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("settings.providers.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("settings.providers.add")}
        </button>
      </div>

      {!hasAnyProvider ? (
        <EmptyState
          icon={BrainCircuit}
          title={t("settings.providers.empty")}
          description={t("settings.providers.emptyHint")}
        />
      ) : (
        <div className="space-y-2">
          {providerEntries.map(([id, cfg]) => (
            <ProviderCard
              key={id}
              providerId={id}
              config={cfg}
              onEdit={() => setEditTarget({ id, config: cfg })}
              onDelete={() => setDeleteTarget(id)}
            />
          ))}
          {Array.from(catalogGroups.entries()).map(([providerId, models]) => (
            <CatalogProviderCard
              key={`catalog-${providerId}`}
              providerId={providerId}
              models={models}
            />
          ))}
        </div>
      )}

      <AddProviderDialog
        open={addOpen}
        existingIds={Object.keys(providers)}
        onSave={handleAdd}
        onCancel={() => setAddOpen(false)}
      />

      {editTarget && (
        <EditProviderDialog
          key={editTarget.id}
          open={!!editTarget}
          providerId={editTarget.id}
          config={editTarget.config}
          onSave={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("settings.providers.deleteTitle")}
        description={t("settings.providers.deleteDescription", { name: deleteTarget ?? "" })}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
