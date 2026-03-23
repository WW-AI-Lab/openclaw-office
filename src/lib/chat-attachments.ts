import { generateMessageId } from "@/lib/message-utils";

export type ChatAttachmentKind = "text" | "image" | "binary";

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  kind: ChatAttachmentKind;
  previewText?: string;
  imagePreviewUrl?: string;
  transportValue?: string;
}

const TEXT_SIZE_LIMIT_BYTES = 256 * 1024;
const IMAGE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const TEXT_PREVIEW_CHAR_LIMIT = 12000;
const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".css",
  ".csv",
  ".go",
  ".graphql",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".php",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  return lastDot >= 0 ? name.slice(lastDot).toLowerCase() : "";
}

function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (
    file.type.includes("json") ||
    file.type.includes("xml") ||
    file.type.includes("javascript") ||
    file.type.includes("typescript")
  ) {
    return true;
  }

  return TEXT_EXTENSIONS.has(getFileExtension(file.name));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferCodeFenceLanguage(fileName: string): string {
  const extension = getFileExtension(fileName);
  const languageMap: Record<string, string> = {
    ".css": "css",
    ".go": "go",
    ".html": "html",
    ".java": "java",
    ".js": "js",
    ".json": "json",
    ".jsx": "jsx",
    ".md": "md",
    ".php": "php",
    ".ps1": "powershell",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".sh": "bash",
    ".sql": "sql",
    ".svg": "xml",
    ".toml": "toml",
    ".ts": "ts",
    ".tsx": "tsx",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
  };

  return languageMap[extension] ?? "";
}

function sanitizeCodeFenceContent(content: string): string {
  return content.replace(/```/g, "``\\`");
}

function buildTruncatedTextPreview(text: string): string {
  if (text.length <= TEXT_PREVIEW_CHAR_LIMIT) {
    return text;
  }

  return `${text.slice(0, TEXT_PREVIEW_CHAR_LIMIT)}\n...[truncated]`;
}

function readFileAsText(file: File): Promise<string> {
  return file.text();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const base = {
    id: generateMessageId(),
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };

  if (isTextLikeFile(file) && file.size <= TEXT_SIZE_LIMIT_BYTES) {
    const rawText = await readFileAsText(file);
    return {
      ...base,
      kind: "text",
      previewText: buildTruncatedTextPreview(rawText),
    };
  }

  if (file.type.startsWith("image/") && file.size <= IMAGE_SIZE_LIMIT_BYTES) {
    const imagePreviewUrl = await readFileAsDataUrl(file);
    return {
      ...base,
      kind: "image",
      imagePreviewUrl,
      transportValue: imagePreviewUrl,
    };
  }

  return {
    ...base,
    kind: file.type.startsWith("image/") ? "image" : "binary",
  };
}

export async function filesToChatAttachments(files: File[]): Promise<ChatAttachment[]> {
  return Promise.all(files.map((file) => fileToChatAttachment(file)));
}

export function buildAttachmentPrompt(attachments: ChatAttachment[]): string {
  if (attachments.length === 0) {
    return "";
  }

  const sections = attachments.map((attachment, index) => {
    const header = `附件 ${index + 1}: \`${attachment.name}\` (${attachment.mimeType}, ${formatFileSize(
      attachment.size,
    )})`;

    if (attachment.kind === "text" && attachment.previewText) {
      const language = inferCodeFenceLanguage(attachment.name);
      return `${header}\n\`\`\`${language}\n${sanitizeCodeFenceContent(attachment.previewText)}\n\`\`\``;
    }

    if (attachment.kind === "image") {
      return `${header}\n这是一个图片附件，已随消息附加。`;
    }

    return `${header}\n这是一个二进制附件，无法直接内联预览。`;
  });

  return sections.join("\n\n");
}

export function buildOutboundChatMessage(text: string, attachments: ChatAttachment[]): string {
  const trimmedText = text.trim();
  const attachmentPrompt = buildAttachmentPrompt(attachments);

  if (trimmedText && attachmentPrompt) {
    return `${trimmedText}\n\n${attachmentPrompt}`;
  }

  return trimmedText || attachmentPrompt;
}

export function buildTransportAttachments(attachments: ChatAttachment[]): string[] {
  return attachments.flatMap((attachment) =>
    attachment.transportValue ? [attachment.transportValue] : [],
  );
}

export function describeAttachment(attachment: ChatAttachment): string {
  return `${attachment.name} · ${formatFileSize(attachment.size)}`;
}
