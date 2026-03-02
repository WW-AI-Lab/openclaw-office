import { Eye, EyeOff, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  inferProviderType,
  REDACTED_SENTINEL,
  MODEL_APIS,
  type ModelApi,
  type ModelDefinitionConfig,
  parseModels,
  serializeModel,
} from "@/lib/provider-types";
import { ModelListEditor } from "./ModelEditor";

interface EditProviderDialogProps {
  open: boolean;
  providerId: string;
  config: Record<string, unknown>;
  onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function EditProviderDialog({
  open,
  providerId,
  config,
  onSave,
  onCancel,
}: EditProviderDialogProps) {
  const { t } = useTranslation("console");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const meta = inferProviderType(
    providerId,
    config.api as string | undefined,
    config.baseUrl as string | undefined,
  );

  const [baseUrl, setBaseUrl] = useState(String(config.baseUrl ?? ""));
  const [apiKey, setApiKey] = useState("");
  const [apiType, setApiType] = useState<ModelApi>(
    (config.api as ModelApi) ?? "openai-completions",
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<ModelDefinitionConfig[]>(() => parseModels(config.models));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSave = () => {
    const patch: Record<string, unknown> = {
      baseUrl,
      api: apiType,
      models: models.filter((m) => m.id.length > 0).map(serializeModel),
    };
    if (apiKey.length > 0) patch.apiKey = apiKey;
    onSave(patch);
  };

  const hasExistingAuth = typeof config.auth === "string" && config.auth.length > 0;
  const hasExistingKey =
    hasExistingAuth ||
    config.apiKey === REDACTED_SENTINEL ||
    (typeof config.apiKey === "string" && config.apiKey.length > 0);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto w-[92vw] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t("settings.providers.editDialog.title")} — {providerId}
            </h3>
            {meta.id !== providerId && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{meta.name}</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Row: API Type + Base URL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("settings.providers.addDialog.apiType")}
              </label>
              <div className="relative">
                <select
                  value={apiType}
                  onChange={(e) => setApiType(e.target.value as ModelApi)}
                  className={selectCls}
                >
                  {MODEL_APIS.map((api) => (
                    <option key={api} value={api}>
                      {api}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("settings.providers.addDialog.baseUrl")}
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* API Key */}
          {meta.requiresApiKey && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("settings.providers.addDialog.apiKey")}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={`${inputCls} pr-11`}
                  placeholder={
                    hasExistingKey
                      ? t("settings.providers.editDialog.apiKeyPlaceholder")
                      : meta.placeholder
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {hasExistingKey && !apiKey && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  {t("settings.providers.apiKeyConfigured")}
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-600" />

          {/* Models */}
          <ModelListEditor models={models} onChange={setModels} />
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            {t("settings.providers.editDialog.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {t("settings.providers.editDialog.save")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 transition-colors";

const selectCls =
  "w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 transition-colors";
