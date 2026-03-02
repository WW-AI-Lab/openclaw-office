import { ArrowLeft, Eye, EyeOff, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  PROVIDER_TYPE_INFO,
  MODEL_APIS,
  type ProviderTypeMeta,
  type ModelApi,
  type ModelDefinitionConfig,
  serializeModel,
} from "@/lib/provider-types";
import { ModelListEditor } from "./ModelEditor";

interface AddProviderDialogProps {
  open: boolean;
  existingIds: string[];
  onSave: (id: string, config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function AddProviderDialog({ open, existingIds, onSave, onCancel }: AddProviderDialogProps) {
  const { t } = useTranslation("console");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ProviderTypeMeta | null>(null);
  const [providerId, setProviderId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiType, setApiType] = useState<ModelApi>("openai-completions");
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<ModelDefinitionConfig[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setStep(1);
      setSelectedType(null);
      setProviderId("");
      setBaseUrl("");
      setApiKey("");
      setApiType("openai-completions");
      setShowApiKey(false);
      setModels([]);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSelectType = (meta: ProviderTypeMeta) => {
    setSelectedType(meta);
    setProviderId(meta.id === "custom" ? "" : meta.id);
    setBaseUrl(meta.defaultBaseUrl);
    setApiType(meta.defaultApi);
    setStep(2);
  };

  const idConflict = existingIds.includes(providerId);
  const canSave = providerId.length > 0 && !idConflict;

  const handleSave = () => {
    if (!canSave) return;
    const config: Record<string, unknown> = {
      baseUrl,
      api: apiType,
      models: models.filter((m) => m.id.length > 0).map(serializeModel),
    };
    if (apiKey) config.apiKey = apiKey;
    onSave(providerId, config);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto w-[92vw] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="p-8">
        {step === 1 && (
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t("settings.providers.addDialog.title")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("settings.providers.addDialog.selectType")}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {PROVIDER_TYPE_INFO.map((meta) => (
                <button
                  key={meta.id}
                  type="button"
                  onClick={() => handleSelectType(meta)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 px-4 py-5 text-center hover:border-blue-400 hover:bg-blue-50/80 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 transition-all"
                >
                  <span className="text-2xl">{meta.icon}</span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {meta.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                {t("settings.providers.addDialog.cancel")}
              </button>
            </div>
          </div>
        )}

        {step === 2 && selectedType && (
          <div>
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedType.icon}</span>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {t("settings.providers.addDialog.title")} — {selectedType.name}
                </h3>
              </div>
            </div>

            <div className="space-y-5">
              {/* Provider ID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("settings.providers.addDialog.providerId")}
                  </label>
                  <input
                    type="text"
                    value={providerId}
                    onChange={(e) =>
                      setProviderId(e.target.value.replace(/\s/g, "-").toLowerCase())
                    }
                    className={inputCls}
                    placeholder={selectedType.id}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("settings.providers.addDialog.providerIdHint")}
                  </p>
                  {idConflict && (
                    <p className="mt-1 text-xs text-red-500">
                      {t("settings.providers.addDialog.idConflict")}
                    </p>
                  )}
                </div>

                {/* API Type */}
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
              </div>

              {/* Base URL */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("settings.providers.addDialog.baseUrl")}
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://api.example.com/v1"
                />
              </div>

              {/* API Key */}
              {selectedType.requiresApiKey && (
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
                      placeholder={selectedType.placeholder ?? "sk-..."}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
                {t("settings.providers.addDialog.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("settings.providers.addDialog.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 transition-colors";

const selectCls =
  "w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 transition-colors";
