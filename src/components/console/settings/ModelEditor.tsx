import { ChevronDown, ChevronUp, Trash2, Plus, Brain, Image, Type, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MODEL_APIS,
  MODEL_INPUT_TYPES,
  THINKING_FORMATS,
  MAX_TOKENS_FIELDS,
  type ModelDefinitionConfig,
  type ModelApi,
  type ModelInputType,
  type ModelCost,
  type ModelCompatConfig,
  type ThinkingFormat,
  type MaxTokensField,
  createDefaultModel,
} from "@/lib/provider-types";

/* ------------------------------------------------------------------ */
/*  Single model form                                                  */
/* ------------------------------------------------------------------ */

interface ModelFormProps {
  model: ModelDefinitionConfig;
  onChange: (model: ModelDefinitionConfig) => void;
  onRemove: () => void;
  defaultCollapsed?: boolean;
}

function ModelForm({ model, onChange, onRemove, defaultCollapsed = false }: ModelFormProps) {
  const { t } = useTranslation("console");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<ModelDefinitionConfig>) => onChange({ ...model, ...partial });

  const updateCost = (field: keyof ModelCost, value: number) => {
    const cost = model.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    onChange({ ...model, cost: { ...cost, [field]: value } });
  };

  const toggleInput = (type: ModelInputType) => {
    const current = model.input ?? ["text"];
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    if (next.length === 0) return;
    update({ input: next });
  };

  const updateCompat = (partial: Partial<ModelCompatConfig>) => {
    onChange({ ...model, compat: { ...(model.compat ?? {}), ...partial } });
  };

  const label = model.name || model.id || t("settings.providers.models.untitled");

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-600 dark:bg-gray-700/30">
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="truncate max-w-xs">{label}</span>
          {model.reasoning && (
            <span title="reasoning">
              <Brain className="h-3.5 w-3.5 text-purple-500" />
            </span>
          )}
          {model.input?.includes("image") && (
            <span title="image">
              <Image className="h-3.5 w-3.5 text-green-500" />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
          title={t("settings.providers.models.remove")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="space-y-4 border-t border-gray-200 px-4 py-4 dark:border-gray-600">
          {/* Row 1: id + name */}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("settings.providers.models.id")}>
              <input
                type="text"
                value={model.id}
                onChange={(e) => update({ id: e.target.value })}
                className={inputCls}
                placeholder="gpt-4o"
              />
            </Field>
            <Field label={t("settings.providers.models.name")}>
              <input
                type="text"
                value={model.name}
                onChange={(e) => update({ name: e.target.value })}
                className={inputCls}
                placeholder="GPT-4o"
              />
            </Field>
          </div>

          {/* Row 2: reasoning toggle + input types */}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("settings.providers.models.reasoning")}>
              <ToggleButton
                active={model.reasoning === true}
                onClick={() => update({ reasoning: !model.reasoning })}
                icon={<Brain className="h-4 w-4" />}
                label={
                  model.reasoning
                    ? t("settings.providers.models.yes")
                    : t("settings.providers.models.no")
                }
              />
            </Field>
            <Field label={t("settings.providers.models.inputTypes")}>
              <div className="flex gap-2">
                {MODEL_INPUT_TYPES.map((type) => (
                  <ToggleButton
                    key={type}
                    active={(model.input ?? ["text"]).includes(type)}
                    onClick={() => toggleInput(type)}
                    icon={
                      type === "text" ? <Type className="h-4 w-4" /> : <Image className="h-4 w-4" />
                    }
                    label={t(`settings.providers.models.input_${type}`)}
                  />
                ))}
              </div>
            </Field>
          </div>

          {/* Row 3: API override + contextWindow + maxTokens */}
          <div className="grid grid-cols-3 gap-4">
            <Field label={t("settings.providers.models.apiOverride")}>
              <div className="relative">
                <select
                  value={model.api ?? ""}
                  onChange={(e) =>
                    update({ api: e.target.value ? (e.target.value as ModelApi) : undefined })
                  }
                  className={selectCls}
                  aria-label={t("settings.providers.models.apiOverride")}
                >
                  <option value="">{t("settings.providers.models.inheritProvider")}</option>
                  {MODEL_APIS.map((api) => (
                    <option key={api} value={api}>
                      {api}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </Field>
            <Field label={t("settings.providers.models.contextWindow")}>
              <input
                type="number"
                value={model.contextWindow ?? ""}
                onChange={(e) =>
                  update({ contextWindow: e.target.value ? Number(e.target.value) : undefined })
                }
                className={inputCls}
                placeholder="128000"
                min={1}
              />
            </Field>
            <Field label={t("settings.providers.models.maxTokens")}>
              <input
                type="number"
                value={model.maxTokens ?? ""}
                onChange={(e) =>
                  update({ maxTokens: e.target.value ? Number(e.target.value) : undefined })
                }
                className={inputCls}
                placeholder="8192"
                min={1}
              />
            </Field>
          </div>

          {/* Row 4: Cost */}
          <Field label={t("settings.providers.models.cost")}>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              {t("settings.providers.models.costHint")}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {(["input", "output", "cacheRead", "cacheWrite"] as const).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                    {t(`settings.providers.models.cost_${field}`)}
                  </label>
                  <input
                    type="number"
                    value={model.cost?.[field] ?? ""}
                    onChange={(e) => updateCost(field, e.target.value ? Number(e.target.value) : 0)}
                    className={inputCls}
                    placeholder="0"
                    min={0}
                    step="0.01"
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* Advanced: compat */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              <Zap className="h-3 w-3" />
              {showAdvanced
                ? t("settings.providers.models.hideAdvanced")
                : t("settings.providers.models.showAdvanced")}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-600 dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t("settings.providers.models.thinkingFormat")}>
                    <div className="relative">
                      <select
                        value={model.compat?.thinkingFormat ?? ""}
                        onChange={(e) =>
                          updateCompat({
                            thinkingFormat: e.target.value
                              ? (e.target.value as ThinkingFormat)
                              : undefined,
                          })
                        }
                        className={selectCls}
                        aria-label={t("settings.providers.models.thinkingFormat")}
                      >
                        <option value="">{t("settings.providers.models.default")}</option>
                        {THINKING_FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </Field>
                  <Field label={t("settings.providers.models.maxTokensField")}>
                    <div className="relative">
                      <select
                        value={model.compat?.maxTokensField ?? ""}
                        onChange={(e) =>
                          updateCompat({
                            maxTokensField: e.target.value
                              ? (e.target.value as MaxTokensField)
                              : undefined,
                          })
                        }
                        className={selectCls}
                        aria-label={t("settings.providers.models.maxTokensField")}
                      >
                        <option value="">{t("settings.providers.models.default")}</option>
                        {MAX_TOKENS_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {(
                    [
                      "supportsStore",
                      "supportsDeveloperRole",
                      "supportsReasoningEffort",
                      "supportsUsageInStreaming",
                      "supportsStrictMode",
                      "requiresToolResultName",
                      "requiresAssistantAfterToolResult",
                      "requiresThinkingAsText",
                      "requiresMistralToolIds",
                    ] as const
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={model.compat?.[key] === true}
                        onChange={(e) => updateCompat({ [key]: e.target.checked || undefined })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {t(`settings.providers.models.compat_${key}`)}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Model list editor                                                  */
/* ------------------------------------------------------------------ */

interface ModelListEditorProps {
  models: ModelDefinitionConfig[];
  onChange: (models: ModelDefinitionConfig[]) => void;
}

export function ModelListEditor({ models, onChange }: ModelListEditorProps) {
  const { t } = useTranslation("console");

  const handleAdd = () => {
    onChange([...models, createDefaultModel()]);
  };

  const handleChange = (idx: number, updated: ModelDefinitionConfig) => {
    const next = [...models];
    next[idx] = updated;
    onChange(next);
  };

  const handleRemove = (idx: number) => {
    onChange(models.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("settings.providers.models.title")} ({models.length})
        </h4>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-500 dark:text-gray-400 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("settings.providers.models.add")}
        </button>
      </div>

      {models.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-600">
          {t("settings.providers.models.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((model, idx) => (
            <ModelForm
              key={idx}
              model={model}
              onChange={(m) => handleChange(idx, m)}
              onRemove={() => handleRemove(idx)}
              defaultCollapsed={model.id.length > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared UI primitives                                               */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 transition-colors";

const selectCls =
  "w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 transition-colors";

function SelectChevron() {
  return (
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ToggleButton({ active, onClick, icon, label }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
          : "border-gray-300 bg-white text-gray-500 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
