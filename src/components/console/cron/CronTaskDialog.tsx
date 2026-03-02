import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CronPayload, CronTask, CronSchedule, CronTaskInput } from "@/gateway/adapter-types";
import { CRON_PRESETS, cronScheduleToExpr } from "@/lib/cron-presets";

interface CronTaskDialogProps {
  open: boolean;
  editingTask: CronTask | null;
  onSave: (input: CronTaskInput) => void;
  onUpdate: (id: string, patch: Partial<CronTaskInput>) => void;
  onClose: () => void;
}

export function buildCronTaskInput(params: {
  name: string;
  description: string;
  schedule: CronSchedule;
  message: string;
  payloadKind?: "agentTurn" | "systemEvent";
}): CronTaskInput {
  const payloadKind = params.payloadKind ?? "agentTurn";
  const payload: CronPayload =
    payloadKind === "systemEvent"
      ? { kind: "systemEvent", text: params.message.trim() }
      : { kind: "agentTurn", message: params.message.trim() };

  return {
    name: params.name.trim(),
    description: params.description.trim() || undefined,
    schedule: params.schedule,
    sessionTarget: payloadKind === "systemEvent" ? "main" : "isolated",
    wakeMode: "now",
    payload,
  };
}

export function CronTaskDialog({
  open,
  editingTask,
  onSave,
  onUpdate,
  onClose,
}: CronTaskDialogProps) {
  const { t } = useTranslation("console");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState<CronSchedule>({ kind: "cron", expr: "0 18 * * *" });
  const [cronExpr, setCronExpr] = useState("0 18 * * *");
  const [message, setMessage] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (editingTask) {
        setName(editingTask.name);
        setDescription(editingTask.description ?? "");
        setSchedule(editingTask.schedule);
        setCronExpr(cronScheduleToExpr(editingTask.schedule));
        setMessage(
          editingTask.payload.kind === "agentTurn"
            ? editingTask.payload.message
            : editingTask.payload.kind === "systemEvent"
              ? editingTask.payload.text
              : "",
        );
        setSelectedPreset(null);
      } else {
        setName("");
        setDescription("");
        setSchedule({ kind: "cron", expr: "0 18 * * *" });
        setCronExpr("0 18 * * *");
        setMessage("");
        setSelectedPreset(null);
      }
      setErrors({});
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, editingTask]);

  const handlePresetSelect = (index: number) => {
    const preset = CRON_PRESETS[index];
    setSelectedPreset(index);
    setSchedule(preset.schedule);
    setCronExpr(cronScheduleToExpr(preset.schedule));
  };

  const handleCronExprChange = (expr: string) => {
    setCronExpr(expr);
    setSelectedPreset(null);
    setSchedule({ kind: "cron", expr });
  };

  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    if (!name.trim()) newErrors.name = true;
    if (!message.trim()) newErrors.message = true;
    if (!cronExpr.trim()) newErrors.cronExpr = true;

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const input = buildCronTaskInput({
      name,
      description,
      schedule,
      message,
      payloadKind: editingTask?.payload.kind === "systemEvent" ? "systemEvent" : "agentTurn",
    });

    if (editingTask) {
      onUpdate(editingTask.id, input);
    } else {
      onSave(input);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="max-h-[80vh] overflow-y-auto p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {editingTask ? t("cron.dialog.editTitle") : t("cron.dialog.createTitle")}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("cron.dialog.name")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("cron.dialog.namePlaceholder")}
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-100 ${errors.name ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{t("cron.dialog.required")}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("cron.dialog.description")}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("cron.dialog.descriptionPlaceholder")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("cron.dialog.schedule")}
            </label>
            <div className="mb-3 flex flex-wrap gap-2">
              {CRON_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePresetSelect(i)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${selectedPreset === i ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400" : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"}`}
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={cronExpr}
              onChange={(e) => handleCronExprChange(e.target.value)}
              placeholder="0 * * * *"
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm font-mono dark:bg-gray-700 dark:text-gray-100 ${errors.cronExpr ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            <p className="mt-1 text-xs text-gray-400">{t("cron.dialog.cronHelp")}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("cron.dialog.message")} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("cron.dialog.messagePlaceholder")}
              rows={3}
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-100 ${errors.message ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            {errors.message && (
              <p className="mt-1 text-xs text-red-500">{t("cron.dialog.required")}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {editingTask ? t("common:actions.save") : t("common:actions.create")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
