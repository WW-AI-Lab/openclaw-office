import {
  ExternalLink,
  Check,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getAdapter } from "@/gateway/adapter-provider";
import type { SkillInfo } from "@/gateway/adapter-types";

interface SkillDetailDialogProps {
  open: boolean;
  skill: SkillInfo | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SkillDetailDialog({ open, skill, onClose, onSaved }: SkillDetailDialogProps) {
  const { t } = useTranslation("console");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [configTab, setConfigTab] = useState<"info" | "config">("info");
  const [envExpanded, setEnvExpanded] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setConfigTab("info");
      setShowApiKey(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!skill) return;
    setApiKey(typeof skill.config?.apiKey === "string" ? skill.config.apiKey : "");

    const env = skill.config?.env;
    if (env && typeof env === "object") {
      setEnvVars(
        Object.entries(env).map(([key, value]) => ({
          key,
          value: String(value),
        })),
      );
    } else {
      setEnvVars([]);
    }
  }, [skill]);

  if (!skill) return null;

  const hasConfig = skill.primaryEnv || (skill.configChecks && skill.configChecks.length > 0);
  const isCoreLocked = skill.isCore && skill.always;

  const handleSave = async () => {
    setSaving(true);
    try {
      const env = envVars.reduce<Record<string, string>>((acc, item) => {
        const key = item.key.trim();
        if (!key) return acc;
        acc[key] = item.value.trim();
        return acc;
      }, {});
      await getAdapter().skillsUpdate(skill.id, {
        apiKey: apiKey || undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
      });
      onSaved();
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleAddEnv = () => setEnvVars((current) => [...current, { key: "", value: "" }]);
  const handleRemoveEnv = (index: number) => {
    setEnvVars((current) => current.filter((_, idx) => idx !== index));
  };
  const handleUpdateEnv = (index: number, field: "key" | "value", value: string) => {
    setEnvVars((current) =>
      current.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    );
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-[min(760px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="text-3xl">{skill.icon || "📦"}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {skill.name}
                  </h3>
                  {isCoreLocked && <Lock className="h-4 w-4 text-gray-400" />}
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {skill.version || "—"} · {skill.author ?? "—"}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfigTab("info")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${configTab === "info" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}
                  >
                    {t("skills.detail.info")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigTab("config")}
                    disabled={!hasConfig}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${configTab === "config" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {t("skills.detail.config")}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {configTab === "info" ? (
            <div className="space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">{skill.description}</p>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label={t("skills.detail.source")} value={skill.source ?? "—"} />
                <InfoRow label={t("skills.detail.version")} value={skill.version || "—"} />
                <InfoRow label={t("skills.detail.author")} value={skill.author ?? "—"} />
                <InfoRow label={t("skills.detail.primaryEnv")} value={skill.primaryEnv ?? "—"} />
              </div>

              {skill.homepage && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("skills.detail.homepage")}:
                  </span>
                  <a
                    href={skill.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {skill.homepage}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {skill.requirements && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("skills.detail.requirements")}
                  </h4>
                  <div className="space-y-2">
                    {skill.requirements.bins?.map((bin) => {
                      const isMissing = skill.missing?.bins?.includes(bin);
                      return (
                        <div key={bin} className="flex items-center gap-2 text-sm">
                          {isMissing ? (
                            <X className="h-4 w-4 text-red-500" />
                          ) : (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                          <code className="text-xs">{bin}</code>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : hasConfig ? (
            <div className="space-y-5">
              {skill.primaryEnv && (
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                    API Key ({skill.primaryEnv})
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t("skills.detail.apiKeyPlaceholder")}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setEnvExpanded((value) => !value)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {envExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {t("skills.detail.envVars")}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEnv}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Plus className="h-3 w-3" />
                    {t("skills.detail.addVariable")}
                  </button>
                </div>

                {envExpanded && (
                  <div className="mt-4 space-y-3">
                    {envVars.length === 0 ? (
                      <p className="text-xs italic text-gray-400">{t("skills.detail.noEnvVars")}</p>
                    ) : (
                      envVars.map((envVar, index) => (
                        <div key={`${envVar.key}-${index}`} className="flex items-center gap-2">
                          <input
                            value={envVar.key}
                            onChange={(e) => handleUpdateEnv(index, "key", e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            placeholder={t("skills.detail.keyPlaceholder")}
                          />
                          <span className="text-gray-400">=</span>
                          <input
                            value={envVar.value}
                            onChange={(e) => handleUpdateEnv(index, "value", e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            placeholder={t("skills.detail.valuePlaceholder")}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveEnv(index)}
                            className="rounded-md p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {skill.configChecks && skill.configChecks.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs text-gray-500 dark:text-gray-400">
                    {t("skills.detail.configChecks")}
                  </label>
                  <div className="space-y-1">
                    {skill.configChecks.map((check) => (
                      <div key={check.path} className="flex items-center gap-2 text-sm">
                        {check.satisfied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <code className="text-xs">{check.path}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? t("skills.detail.saving") : t("common:actions.save")}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t("skills.detail.noConfig")}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            {skill.enabled ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-gray-400" />
            )}
            <span
              className={
                skill.enabled
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400"
              }
            >
              {skill.enabled ? t("skills.detail.enabled") : t("skills.detail.disabled")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {t("common:actions.close")}
            </button>
            <label
              className="relative inline-flex cursor-pointer items-center"
              title={isCoreLocked ? t("skills.card.coreProtected") : undefined}
            >
              <input
                type="checkbox"
                checked={skill.enabled}
                onChange={() =>
                  getAdapter().skillsUpdate(skill.id, { enabled: !skill.enabled }).then(onSaved)
                }
                disabled={isCoreLocked}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-gray-700 dark:peer-checked:bg-blue-500" />
            </label>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 dark:text-gray-400">{label}:</span>
      <span className="text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
