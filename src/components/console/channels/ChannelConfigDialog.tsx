import { Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ChannelType } from "@/gateway/adapter-types";
import { CHANNEL_SCHEMAS, type ChannelFieldDef } from "@/lib/channel-schemas";
import { WhatsAppQrFlow } from "./WhatsAppQrFlow";

interface ChannelConfigDialogProps {
  open: boolean;
  channelType: ChannelType | null;
  onClose: () => void;
}

export function ChannelConfigDialog({ open, channelType, onClose }: ChannelConfigDialogProps) {
  const { t } = useTranslation("console");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const schema = channelType ? CHANNEL_SCHEMAS[channelType] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setValues({});
      setErrors({});
      setVisibleSecrets(new Set());
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!schema) return null;

  if (schema.hasQrFlow) {
    return (
      <dialog
        ref={dialogRef}
        onClose={onClose}
        className="fixed inset-0 z-50 m-auto max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">{schema.icon}</span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t(schema.nameKey)}
            </h3>
          </div>
          <WhatsAppQrFlow onClose={onClose} />
        </div>
      </dialog>
    );
  }

  const handleSave = () => {
    const newErrors: Record<string, boolean> = {};
    let hasError = false;
    for (const field of schema.fields) {
      if (field.required && !values[field.key]?.trim()) {
        newErrors[field.key] = true;
        hasError = true;
      }
    }
    setErrors(newErrors);
    if (!hasError) {
      onClose();
    }
  };

  const toggleSecret = (key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xl">{schema.icon}</span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t(schema.nameKey)}
          </h3>
        </div>

        <div className="space-y-4">
          {schema.fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={values[field.key] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
              hasError={errors[field.key] ?? false}
              isSecretVisible={visibleSecrets.has(field.key)}
              onToggleSecret={() => toggleSecret(field.key)}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            {t("channels.configDialog.cancel", { defaultValue: t("common:actions.cancel") })}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {t("channels.configDialog.save", { defaultValue: t("common:actions.save") })}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  hasError,
  isSecretVisible,
  onToggleSecret,
}: {
  field: ChannelFieldDef;
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
  isSecretVisible: boolean;
  onToggleSecret: () => void;
}) {
  const { t } = useTranslation("console");
  const borderClass = hasError ? "border-red-500" : "border-gray-300 dark:border-gray-600";

  if (field.type === "textarea") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t(field.labelKey)} {field.required && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t(field.placeholderKey)}
          rows={4}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-100 ${borderClass}`}
        />
        {hasError && (
          <p className="mt-1 text-xs text-red-500">{t("channels.configDialog.required")}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {t(field.labelKey)} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={field.type === "secret" && !isSecretVisible ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t(field.placeholderKey)}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-100 ${borderClass} ${field.type === "secret" ? "pr-10" : ""}`}
        />
        {field.type === "secret" && (
          <button
            type="button"
            onClick={onToggleSecret}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {isSecretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hasError && (
        <p className="mt-1 text-xs text-red-500">{t("channels.configDialog.required")}</p>
      )}
    </div>
  );
}
