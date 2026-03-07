import { Trash2, Plus, X, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { AgentModelConfig } from "@/gateway/adapter-types";
import type { AgentSummary } from "@/gateway/types";
import { useAgentsStore } from "@/store/console-stores/agents-store";

interface OverviewTabProps {
  agent: AgentSummary;
}

export function OverviewTab({ agent }: OverviewTabProps) {
  const { t } = useTranslation("console");
  const {
    defaultAgentId,
    updateAgentModel,
    setDeleteDialogOpen,
    systemModels,
    fetchSystemModels,
    agentModelConfigs,
  } = useAgentsStore();
  const isDefault = agent.id === defaultAgentId;

  const savedConfig = agentModelConfigs[agent.id];
  const [primaryModel, setPrimaryModel] = useState(savedConfig?.primary ?? "");
  const [fallbacks, setFallbacks] = useState<string[]>(savedConfig?.fallbacks ?? []);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (systemModels.length === 0) fetchSystemModels();
  }, [systemModels.length, fetchSystemModels]);

  useEffect(() => {
    const cfg = agentModelConfigs[agent.id];
    setPrimaryModel(cfg?.primary ?? "");
    setFallbacks(cfg?.fallbacks ?? []);
    setSaveStatus("idle");
  }, [agent.id, agentModelConfigs]);

  const handleSaveModel = async () => {
    setSaving(true);
    setSaveStatus("idle");
    const cleanFallbacks = fallbacks.filter((f) => f.length > 0);
    const model: AgentModelConfig =
      cleanFallbacks.length > 0
        ? { primary: primaryModel || undefined, fallbacks: cleanFallbacks }
        : primaryModel || "";
    const ok = await updateAgentModel(agent.id, model);
    setSaving(false);
    setSaveStatus(ok ? "success" : "error");
    if (ok) {
      await fetchSystemModels();
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const addFallback = () => setFallbacks([...fallbacks, ""]);
  const removeFallback = (i: number) => setFallbacks(fallbacks.filter((_, idx) => idx !== i));
  const updateFallback = (i: number, val: string) => {
    const updated = [...fallbacks];
    updated[i] = val;
    setFallbacks(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("agents.overview.title")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label={t("agents.overview.agentId")} value={agent.id} mono />
          <InfoRow
            label={t("agents.overview.name")}
            value={agent.identity?.name ?? agent.name ?? agent.id}
          />
          <InfoRow
            label={t("agents.overview.isDefault")}
            value={isDefault ? t("agents.overview.yes") : t("agents.overview.no")}
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("agents.overview.modelConfig")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t("agents.overview.primaryModel")}
            </label>
            <ModelSelect
              value={primaryModel}
              onChange={setPrimaryModel}
              models={systemModels}
              placeholder={t("agents.overview.primaryModelPlaceholder")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t("agents.overview.fallbackModels")}
            </label>
            {fallbacks.map((fb, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <ModelSelect
                  value={fb}
                  onChange={(v) => updateFallback(i, v)}
                  models={systemModels}
                  placeholder={t("agents.overview.fallbackPlaceholder")}
                />
                <button
                  onClick={() => removeFallback(i)}
                  className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addFallback}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <Plus className="h-3 w-3" />
              {t("agents.overview.addFallback")}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveModel}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t("agents.overview.saving") : t("agents.overview.save")}
            </button>
            {saveStatus === "success" && (
              <span className="text-xs text-green-600">{t("agents.overview.saveSuccess")}</span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-red-600">{t("agents.overview.saveError")}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("agents.overview.runtimeHint")}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
        <button
          onClick={() => setDeleteDialogOpen(true)}
          disabled={isDefault}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          title={isDefault ? t("agents.overview.cannotDeleteDefault") : undefined}
        >
          <Trash2 className="h-4 w-4" />
          {t("agents.overview.deleteAgent")}
        </button>
        {isDefault && (
          <p className="mt-1 text-xs text-gray-400">{t("agents.overview.cannotDeleteDefault")}</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-gray-900 dark:text-gray-100 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  models: Array<{ id: string; label: string; provider: string }>;
  placeholder: string;
}

function ModelSelect({ value, onChange, models, placeholder }: ModelSelectProps) {
  const providers = [...new Set(models.map((m) => m.provider))];
  const hasMatchingOption = models.some((m) => m.id === value);

  return (
    <div className="relative w-full">
      <select
        value={hasMatchingOption ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      >
        <option value="">{placeholder}</option>
        {!hasMatchingOption && value && <option value={value}>{value}</option>}
        {providers.map((provider) => (
          <optgroup key={provider} label={provider}>
            {models
              .filter((m) => m.provider === provider)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.id})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
