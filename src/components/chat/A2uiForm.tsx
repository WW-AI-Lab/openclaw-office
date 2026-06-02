import { memo, useRef, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X } from "lucide-react";
import {
  type A2uiForm as A2uiFormModel,
  type A2uiField,
  type A2uiValue,
  type A2uiFileValue,
  validateRequired,
  extractFileAttachments,
} from "@/lib/a2ui-schema";
import type { ChatAttachment } from "@/gateway/adapter-types";

interface A2uiFormProps {
  form: A2uiFormModel;
  /** Render the form in a non-interactive, locked state. */
  readOnly?: boolean;
  /** Called with the collected values and file attachments when the user submits. */
  onSubmit?: (values: Record<string, A2uiValue>, attachments?: ChatAttachment[]) => void;
  /** Called when the user opts out of the form to answer with free text. */
  onUseText?: () => void;
}

type ValueMap = Record<string, A2uiValue>;

function initialValues(form: A2uiFormModel): ValueMap {
  const values: ValueMap = {};
  for (const field of form.fields) {
    if (field.value !== undefined) {
      values[field.key] = field.value;
    } else if (field.type === "checkbox") {
      values[field.key] = false;
    } else if (field.type === "multiselect") {
      values[field.key] = [];
    } else if (field.type === "file" && field.multiple) {
      values[field.key] = [];
    } else {
      values[field.key] = "";
    }
  }
  return values;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FieldControl({
  field,
  value,
  disabled,
  invalid,
  onChange,
  selectPlaceholder,
  t,
}: {
  field: A2uiField;
  value: A2uiValue;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: A2uiValue) => void;
  selectPlaceholder: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const base =
    "w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-950";
  const border = invalid ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700";

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${base} ${border} min-h-[72px] resize-y`}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        className={`${base} ${border}`}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{selectPlaceholder}</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="flex flex-wrap gap-3">
        {field.options?.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="radio"
              name={field.key}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.placeholder ?? field.label}</span>
      </label>
    );
  }

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-3">
        {field.options?.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label key={option.value} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  const next = checked
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value];
                  onChange(next);
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  // --- file upload ---
  if (field.type === "file") {
    return (
      <FileUploadControl
        field={field}
        value={value}
        disabled={disabled}
        invalid={invalid}
        onChange={onChange}
        t={t}
      />
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      className={`${base} ${border}`}
      value={typeof value === "string" ? value : ""}
      placeholder={field.placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FileUploadControl({
  field,
  value,
  disabled,
  invalid,
  onChange,
  t,
}: {
  field: A2uiField;
  value: A2uiValue;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: A2uiValue) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMultiple = field.multiple === true;
  const border = invalid ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700";

  const files: A2uiFileValue[] = isMultiple
    ? Array.isArray(value)
      ? (value as A2uiFileValue[])
      : []
    : value && typeof value === "object" && !Array.isArray(value) && "dataUrl" in value
      ? [value as A2uiFileValue]
      : [];

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;

    const newFiles: A2uiFileValue[] = [];
    for (const file of selected) {
      const dataUrl = await readFileAsDataUrl(file);
      newFiles.push({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
    }

    if (isMultiple) {
      onChange([...files, ...newFiles]);
    } else {
      onChange(newFiles[0]);
    }
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    if (isMultiple) {
      const next = files.filter((_, i) => i !== index);
      onChange(next);
    } else {
      onChange("");
    }
  };

  return (
    <div className={`rounded-lg border ${border} p-2.5`}>
      <input
        ref={inputRef}
        type="file"
        accept={field.accept}
        multiple={isMultiple}
        onChange={handleFiles}
        disabled={disabled}
        aria-label={field.label}
        className="hidden"
      />

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              <span className="max-w-[120px] truncate">{file.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="rounded-full p-0.5 hover:bg-blue-200/50 dark:hover:bg-blue-800/50"
                  title={t("a2ui.removeFile")}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || (!isMultiple && files.length > 0)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:text-blue-400"
      >
        <Upload className="h-3.5 w-3.5" />
        <span>{isMultiple ? t("a2ui.uploadFiles") : t("a2ui.uploadFile")}</span>
      </button>
    </div>
  );
}

export const A2uiForm = memo(function A2uiForm({ form, readOnly = false, onSubmit, onUseText }: A2uiFormProps) {
  const { t } = useTranslation("chat");
  const [values, setValues] = useState<ValueMap>(() => initialValues(form));
  const [submitted, setSubmitted] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  const disabled = readOnly || submitted;

  const missingLabels = useMemo(() => {
    if (missing.length === 0) return "";
    const byKey = new Map(form.fields.map((field) => [field.key, field.label]));
    return missing.map((key) => byKey.get(key) ?? key).join("、");
  }, [missing, form.fields]);

  const setValue = (key: string, value: A2uiValue) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (missing.includes(key)) {
      setMissing((current) => current.filter((item) => item !== key));
    }
  };

  const handleSubmit = () => {
    const missingKeys = validateRequired(form, values);
    if (missingKeys.length > 0) {
      setMissing(missingKeys);
      return;
    }
    setSubmitted(true);
    const attachments = extractFileAttachments(form, values);
    onSubmit?.(values, attachments.length > 0 ? attachments : undefined);
  };

  return (
    <div className="my-2 rounded-xl border border-blue-200/70 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
      {form.title && <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{form.title}</div>}
      {form.description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{form.description}</p>
      )}

      <div className="mt-3 space-y-3">
        {form.fields.map((field) => (
          <div key={field.key}>
            {field.type !== "checkbox" && (
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                {field.label}
                {field.required && (
                  <span className="ml-1 text-red-500" title={t("a2ui.requiredMark")}>
                    *
                  </span>
                )}
              </label>
            )}
            <FieldControl
              field={field}
              value={values[field.key]}
              disabled={disabled}
              invalid={missing.includes(field.key)}
              onChange={(value) => setValue(field.key, value)}
              selectPlaceholder={t("a2ui.selectPlaceholder")}
              t={t}
            />
          </div>
        ))}
      </div>

      {missingLabels && !submitted && (
        <p className="mt-2 text-xs text-red-500">{t("a2ui.requiredHint", { fields: missingLabels })}</p>
      )}

      {submitted ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t("a2ui.submittedNotice")}</p>
      ) : readOnly ? null : (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {form.submit?.label || t("a2ui.submit")}
          </button>
          {onUseText && !readOnly && (
            <button
              type="button"
              onClick={onUseText}
              className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t("a2ui.useText")}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
