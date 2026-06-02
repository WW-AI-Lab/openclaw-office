import { describe, it, expect } from "vitest";
import {
  parseA2ui,
  validateRequired,
  buildSubmissionMessage,
  extractA2uiBlock,
  extractFileAttachments,
  type A2uiForm,
  type A2uiFileValue,
} from "./a2ui-schema";

const VALID_JSON = JSON.stringify({
  version: 1,
  skill: "summarizer",
  title: "文章摘要输入",
  description: "请补全必要信息",
  fields: [
    { key: "source_text", label: "文章内容", type: "textarea", required: true, value: "已识别正文" },
    { key: "count", label: "条数", type: "select", value: "3", options: [{ label: "3 条", value: "3" }, { label: "5 条", value: "5" }] },
    { key: "tone", label: "语气", type: "text", placeholder: "可选" },
  ],
  submit: { label: "开始" },
});

describe("parseA2ui", () => {
  it("parses a valid A2UI JSON string into a form model", () => {
    const form = parseA2ui(VALID_JSON);
    expect(form).not.toBeNull();
    expect(form?.skill).toBe("summarizer");
    expect(form?.title).toBe("文章摘要输入");
    expect(form?.fields).toHaveLength(3);
    expect(form?.fields[0]).toMatchObject({ key: "source_text", type: "textarea", required: true, value: "已识别正文" });
    expect(form?.fields[1].options).toEqual([
      { label: "3 条", value: "3" },
      { label: "5 条", value: "5" },
    ]);
    expect(form?.submit?.label).toBe("开始");
  });

  it("parses content wrapped in a ```a2ui fenced block", () => {
    const text = "前言\n\n```a2ui\n" + VALID_JSON + "\n```\n尾部";
    const form = parseA2ui(text);
    expect(form?.skill).toBe("summarizer");
  });

  it("returns null for invalid JSON", () => {
    expect(parseA2ui("{not json")).toBeNull();
  });

  it("returns null when the required fields array is missing", () => {
    expect(parseA2ui(JSON.stringify({ version: 1, skill: "x" }))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseA2ui("   ")).toBeNull();
  });

  it("defaults version and skill when omitted", () => {
    const form = parseA2ui(JSON.stringify({ fields: [{ key: "a", label: "A", type: "text" }] }));
    expect(form?.version).toBe(1);
    expect(form?.skill).toBe("");
  });

  it("degrades an unknown field type to text", () => {
    const form = parseA2ui(JSON.stringify({ fields: [{ key: "a", label: "A", type: "wizard" }] }));
    expect(form?.fields[0].type).toBe("text");
  });

  it("degrades an option-based field missing options to text", () => {
    const form = parseA2ui(JSON.stringify({ fields: [{ key: "a", label: "A", type: "select" }] }));
    expect(form?.fields[0].type).toBe("text");
    expect(form?.fields[0].options).toBeUndefined();
  });

  it("drops fields without a key", () => {
    const form = parseA2ui(
      JSON.stringify({ fields: [{ label: "no key", type: "text" }, { key: "ok", label: "OK", type: "text" }] }),
    );
    expect(form?.fields).toHaveLength(1);
    expect(form?.fields[0].key).toBe("ok");
  });

  it("parses a file type field with accept and multiple attributes", () => {
    const form = parseA2ui(
      JSON.stringify({
        fields: [
          { key: "doc", label: "数据来源", type: "file", required: true, accept: ".pdf,.docx" },
          { key: "images", label: "截图", type: "file", multiple: true, accept: "image/*" },
        ],
      }),
    );
    expect(form).not.toBeNull();
    expect(form?.fields).toHaveLength(2);
    expect(form?.fields[0]).toMatchObject({ key: "doc", type: "file", required: true, accept: ".pdf,.docx" });
    expect(form?.fields[0].multiple).toBeUndefined();
    expect(form?.fields[1]).toMatchObject({ key: "images", type: "file", multiple: true, accept: "image/*" });
  });

  it("parses prefilled file values", () => {
    const fileValue = { name: "data.csv", mimeType: "text/csv", dataUrl: "data:text/csv;base64,abc" };
    const form = parseA2ui(
      JSON.stringify({
        fields: [{ key: "source", label: "数据", type: "file", value: fileValue }],
      }),
    );
    expect(form?.fields[0].value).toEqual(fileValue);
  });
});

describe("extractA2uiBlock", () => {
  it("returns the inner text of a fenced block", () => {
    expect(extractA2uiBlock("```a2ui\n{\"a\":1}\n```").trim()).toBe('{"a":1}');
  });

  it("returns the original text when no fence exists", () => {
    expect(extractA2uiBlock('{"a":1}')).toBe('{"a":1}');
  });
});

describe("validateRequired", () => {
  const form = parseA2ui(VALID_JSON) as A2uiForm;

  it("reports a required field that is empty", () => {
    expect(validateRequired(form, { source_text: "" })).toContain("source_text");
  });

  it("passes when a required field is filled", () => {
    expect(validateRequired(form, { source_text: "内容" })).toEqual([]);
  });

  it("treats an unchecked required checkbox as missing", () => {
    const checkboxForm = parseA2ui(
      JSON.stringify({ fields: [{ key: "agree", label: "同意", type: "checkbox", required: true }] }),
    ) as A2uiForm;
    expect(validateRequired(checkboxForm, { agree: false })).toEqual(["agree"]);
    expect(validateRequired(checkboxForm, { agree: true })).toEqual([]);
  });

  it("treats an empty required multiselect as missing", () => {
    const msForm = parseA2ui(
      JSON.stringify({
        fields: [{ key: "tags", label: "标签", type: "multiselect", required: true, options: [{ label: "A", value: "a" }] }],
      }),
    ) as A2uiForm;
    expect(validateRequired(msForm, { tags: [] })).toEqual(["tags"]);
    expect(validateRequired(msForm, { tags: ["a"] })).toEqual([]);
  });

  it("treats a required file field without a file as missing", () => {
    const fileForm = parseA2ui(
      JSON.stringify({
        fields: [{ key: "doc", label: "数据来源", type: "file", required: true }],
      }),
    ) as A2uiForm;
    expect(validateRequired(fileForm, { doc: "" })).toEqual(["doc"]);
    expect(validateRequired(fileForm, {})).toEqual(["doc"]);
    expect(validateRequired(fileForm, { doc: { name: "a.pdf", mimeType: "application/pdf", dataUrl: "data:..." } })).toEqual([]);
  });

  it("treats a required multi-file field with empty array as missing", () => {
    const fileForm = parseA2ui(
      JSON.stringify({
        fields: [{ key: "docs", label: "文件", type: "file", required: true, multiple: true }],
      }),
    ) as A2uiForm;
    expect(validateRequired(fileForm, { docs: [] })).toEqual(["docs"]);
    expect(validateRequired(fileForm, { docs: [{ name: "a.pdf", mimeType: "application/pdf", dataUrl: "data:..." }] })).toEqual([]);
  });
});

describe("buildSubmissionMessage", () => {
  const form = parseA2ui(VALID_JSON) as A2uiForm;

  it("produces a human-readable summary with option labels", () => {
    const message = buildSubmissionMessage(form, { source_text: "正文", count: "5", tone: "正式" });
    expect(message).toContain("已通过表单补全「文章摘要输入」的输入：");
    expect(message).toContain("- 文章内容：正文");
    expect(message).toContain("- 条数：5 条");
    expect(message).toContain("- 语气：正式");
  });

  it("appends a machine-readable JSON payload", () => {
    const message = buildSubmissionMessage(form, { source_text: "正文", count: "5" });
    const line = message.split("\n").find((l) => l.startsWith("[a2ui-data] "));
    expect(line).toBeDefined();
    const json = JSON.parse(line!.replace("[a2ui-data] ", ""));
    expect(json).toEqual({ source_text: "正文", count: "5" });
  });

  it("renders checkbox and multiselect values", () => {
    const f = parseA2ui(
      JSON.stringify({
        skill: "x",
        fields: [
          { key: "agree", label: "同意", type: "checkbox" },
          { key: "tags", label: "标签", type: "multiselect", options: [{ label: "甲", value: "a" }, { label: "乙", value: "b" }] },
        ],
      }),
    ) as A2uiForm;
    const message = buildSubmissionMessage(f, { agree: true, tags: ["a", "b"] });
    expect(message).toContain("- 同意：是");
    expect(message).toContain("- 标签：甲、乙");
  });

  it("renders file field as filename and strips dataUrl from payload", () => {
    const f = parseA2ui(
      JSON.stringify({
        skill: "analyzer",
        fields: [
          { key: "source", label: "数据来源", type: "file", required: true },
        ],
      }),
    ) as A2uiForm;
    const fileVal: A2uiFileValue = { name: "report.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,JVBERi..." };
    const message = buildSubmissionMessage(f, { source: fileVal });
    expect(message).toContain("- 数据来源：report.pdf");
    const line = message.split("\n").find((l) => l.startsWith("[a2ui-data] "));
    expect(line).toBeDefined();
    const json = JSON.parse(line!.replace("[a2ui-data] ", ""));
    expect(json.source).toEqual({ name: "report.pdf", mimeType: "application/pdf" });
    expect(json.source.dataUrl).toBeUndefined();
  });
});

describe("extractFileAttachments", () => {
  it("extracts a single file field as ChatAttachment array", () => {
    const f = parseA2ui(
      JSON.stringify({
        fields: [{ key: "doc", label: "文档", type: "file" }],
      }),
    ) as A2uiForm;
    const fileVal: A2uiFileValue = { name: "a.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,abc" };
    const attachments = extractFileAttachments(f, { doc: fileVal });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ name: "a.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,abc" });
  });

  it("extracts multiple files from a multi-file field", () => {
    const f = parseA2ui(
      JSON.stringify({
        fields: [{ key: "docs", label: "文件", type: "file", multiple: true }],
      }),
    ) as A2uiForm;
    const files: A2uiFileValue[] = [
      { name: "a.pdf", mimeType: "application/pdf", dataUrl: "data:1" },
      { name: "b.csv", mimeType: "text/csv", dataUrl: "data:2" },
    ];
    const attachments = extractFileAttachments(f, { docs: files });
    expect(attachments).toHaveLength(2);
    expect(attachments[0].name).toBe("a.pdf");
    expect(attachments[1].name).toBe("b.csv");
  });

  it("returns empty array when no file fields have values", () => {
    const f = parseA2ui(
      JSON.stringify({
        fields: [
          { key: "name", label: "名称", type: "text" },
          { key: "doc", label: "文档", type: "file" },
        ],
      }),
    ) as A2uiForm;
    const attachments = extractFileAttachments(f, { name: "test", doc: "" });
    expect(attachments).toHaveLength(0);
  });
});
