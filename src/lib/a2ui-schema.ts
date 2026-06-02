import type { ChatAttachment } from "@/gateway/adapter-types";

/**
 * A2UI (Agent-to-UI) declarative form schema + parser.
 *
 * A2UI forms are used in two places that share this single parser/serializer:
 *  - As a stable "first-interaction" UI persisted to a skill's `ui.json`
 *    (raw JSON, like `FLOWCHART.md` lives in the skill directory).
 *  - As a runtime, on-demand HITL form carried inside a ` ```a2ui ` fenced
 *    code block in an assistant chat message.
 *
 * The schema is intentionally minimal and declarative so it can be rendered,
 * validated, and version-controlled without a general-purpose form engine.
 */

export type A2uiFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "multiselect"
  | "file";

const SUPPORTED_TYPES: readonly A2uiFieldType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "multiselect",
  "file",
];

const OPTION_TYPES: readonly A2uiFieldType[] = ["select", "radio", "multiselect"];

/** Structured file value produced by a "file" type field. */
export interface A2uiFileValue {
  name: string;
  mimeType: string;
  dataUrl: string;
}

/** A single value carried by an A2UI field. */
export type A2uiValue = string | string[] | boolean | A2uiFileValue | A2uiFileValue[];

export interface A2uiOption {
  label: string;
  value: string;
}

export interface A2uiField {
  /** Unique field name; used as the key when the form is submitted. */
  key: string;
  label: string;
  type: A2uiFieldType;
  required?: boolean;
  /** Prefilled value identified by the agent. */
  value?: A2uiValue;
  placeholder?: string;
  /** Required for select/radio/multiselect. */
  options?: A2uiOption[];
  /** MIME type filter for "file" type (e.g. ".pdf,.docx", "image/*"). */
  accept?: string;
  /** Allow multiple file selection for "file" type. */
  multiple?: boolean;
}

export interface A2uiForm {
  version: number;
  skill: string;
  title?: string;
  description?: string;
  fields: A2uiField[];
  submit?: { label?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileValue(value: unknown): value is A2uiFileValue {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.dataUrl === "string"
  );
}

function normalizeOptions(raw: unknown): A2uiOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options: A2uiOption[] = [];
  for (const item of raw) {
    if (isRecord(item) && (typeof item.value === "string" || typeof item.value === "number")) {
      const value = String(item.value);
      const label = typeof item.label === "string" ? item.label : value;
      options.push({ label, value });
    } else if (typeof item === "string" || typeof item === "number") {
      options.push({ label: String(item), value: String(item) });
    }
  }
  return options.length > 0 ? options : undefined;
}

function normalizeField(raw: unknown): A2uiField | null {
  if (!isRecord(raw)) return null;
  const key = typeof raw.key === "string" ? raw.key.trim() : "";
  const label = typeof raw.label === "string" ? raw.label : key;
  if (!key) return null;

  let type: A2uiFieldType = SUPPORTED_TYPES.includes(raw.type as A2uiFieldType)
    ? (raw.type as A2uiFieldType)
    : "text";

  let options = normalizeOptions(raw.options);
  // Option-based types without options degrade to a single-line text input.
  if (OPTION_TYPES.includes(type) && !options) {
    type = "text";
    options = undefined;
  }

  const field: A2uiField = { key, label, type };
  if (raw.required === true) field.required = true;
  if (typeof raw.placeholder === "string") field.placeholder = raw.placeholder;
  if (options) field.options = options;
  if (typeof raw.accept === "string") field.accept = raw.accept;
  if (raw.multiple === true) field.multiple = true;

  // Parse file value(s) for "file" type fields.
  if (type === "file") {
    if (Array.isArray(raw.value)) {
      const files = raw.value.filter(isFileValue);
      if (files.length > 0) field.value = files;
    } else if (isFileValue(raw.value)) {
      field.value = raw.value;
    }
  } else if (Array.isArray(raw.value)) {
    field.value = raw.value.filter((v): v is string => typeof v === "string");
  } else if (typeof raw.value === "boolean") {
    field.value = raw.value;
  } else if (typeof raw.value === "string") {
    field.value = raw.value;
  } else if (typeof raw.value === "number") {
    field.value = String(raw.value);
  }

  return field;
}

/**
 * Extract the inner JSON text of the first ` ```a2ui ` fenced block.
 * Returns the original text unchanged when no fence is present (so callers can
 * pass a raw `ui.json` string directly).
 */
export function extractA2uiBlock(text: string): string {
  const match = /```a2ui\s*\n([\s\S]*?)```/.exec(text);
  return match ? match[1] : text;
}

/**
 * Parse A2UI content (raw `ui.json` text or a ` ```a2ui ` block body) into a
 * form model. Returns `null` when the content cannot be parsed or is missing
 * required structure, so the rendering layer can gracefully fall back to a
 * plain code block instead of throwing.
 */
export function parseA2ui(text: string): A2uiForm | null {
  if (!text || !text.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractA2uiBlock(text).trim());
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (!Array.isArray(parsed.fields)) return null;

  const fields = parsed.fields
    .map(normalizeField)
    .filter((field): field is A2uiField => field !== null);
  if (fields.length === 0) return null;

  const form: A2uiForm = {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    skill: typeof parsed.skill === "string" ? parsed.skill : "",
    fields,
  };
  if (typeof parsed.title === "string") form.title = parsed.title;
  if (typeof parsed.description === "string") form.description = parsed.description;
  if (isRecord(parsed.submit) && typeof parsed.submit.label === "string") {
    form.submit = { label: parsed.submit.label };
  }

  return form;
}

function isEmptyValue(field: A2uiField, value: A2uiValue | undefined): boolean {
  if (field.type === "checkbox") return value !== true;
  if (field.type === "file") {
    if (!value) return true;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }
  if (field.type === "multiselect") return !Array.isArray(value) || value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === "";
}

/**
 * Return the keys of required fields that are still empty in `values`.
 */
export function validateRequired(
  form: A2uiForm,
  values: Record<string, A2uiValue | undefined>,
): string[] {
  return form.fields
    .filter((field) => field.required && isEmptyValue(field, values[field.key]))
    .map((field) => field.key);
}

function optionLabel(field: A2uiField, value: string): string {
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

function displayValue(field: A2uiField, value: A2uiValue | undefined): string {
  if (field.type === "checkbox") return value === true ? "是" : "否";
  if (field.type === "file") {
    if (!value) return "（空）";
    if (Array.isArray(value)) {
      if (value.length === 0) return "（空）";
      return (value as A2uiFileValue[]).map((f) => f.name).join("、");
    }
    return (value as A2uiFileValue).name;
  }
  if (Array.isArray(value)) {
    return (value as string[]).map((item) => optionLabel(field, item)).join("、");
  }
  if (value === undefined || value === "") return "（空）";
  if (field.type === "select" || field.type === "radio") {
    return optionLabel(field, String(value));
  }
  return String(value);
}

/**
 * Aggregate the submitted form values into a single structured chat message.
 * The message is primarily human-readable (one line per field) and carries a
 * trailing machine-readable JSON payload so the agent can re-parse the answers.
 */
export function buildSubmissionMessage(
  form: A2uiForm,
  values: Record<string, A2uiValue | undefined>,
): string {
  const heading = form.title?.trim() || form.skill || "表单";
  const lines = form.fields.map((field) => `- ${field.label}：${displayValue(field, values[field.key])}`);

  const payload: Record<string, unknown> = {};
  for (const field of form.fields) {
    const value = values[field.key];
    if (value === undefined) continue;
    if (field.type === "file") {
      // Strip dataUrl from payload to keep message size manageable.
      if (Array.isArray(value)) {
        payload[field.key] = (value as A2uiFileValue[]).map((f) => ({ name: f.name, mimeType: f.mimeType }));
      } else {
        const fv = value as A2uiFileValue;
        payload[field.key] = { name: fv.name, mimeType: fv.mimeType };
      }
    } else {
      payload[field.key] = value;
    }
  }

  return [
    `已通过表单补全「${heading}」的输入：`,
    ...lines,
    "",
    `[a2ui-data] ${JSON.stringify(payload)}`,
  ].join("\n");
}

/**
 * Extract file attachments from form values for all "file" type fields.
 * The returned array is suitable for passing as the `attachments` parameter
 * of `sendMessage(text, attachments)`.
 */
export function extractFileAttachments(
  form: A2uiForm,
  values: Record<string, A2uiValue | undefined>,
): ChatAttachment[] {
  const attachments: ChatAttachment[] = [];
  for (const field of form.fields) {
    if (field.type !== "file") continue;
    const value = values[field.key];
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const fv of value as A2uiFileValue[]) {
        attachments.push({
          id: `${field.key}-${fv.name}`,
          name: fv.name,
          mimeType: fv.mimeType,
          dataUrl: fv.dataUrl,
        });
      }
    } else {
      const fv = value as A2uiFileValue;
      attachments.push({
        id: `${field.key}-${fv.name}`,
        name: fv.name,
        mimeType: fv.mimeType,
        dataUrl: fv.dataUrl,
      });
    }
  }
  return attachments;
}
