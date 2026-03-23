import { describe, expect, it } from "vitest";
import {
  buildAttachmentPrompt,
  buildOutboundChatMessage,
  buildTransportAttachments,
  type ChatAttachment,
} from "@/lib/chat-attachments";

const textAttachment: ChatAttachment = {
  id: "att-text",
  name: "notes.md",
  size: 128,
  mimeType: "text/markdown",
  kind: "text",
  previewText: "# hello",
};

const imageAttachment: ChatAttachment = {
  id: "att-image",
  name: "screen.png",
  size: 256,
  mimeType: "image/png",
  kind: "image",
  imagePreviewUrl: "data:image/png;base64,abc",
  transportValue: "data:image/png;base64,abc",
};

describe("chat-attachments", () => {
  it("builds outbound chat text with inline attachment context", () => {
    expect(buildOutboundChatMessage("请处理", [textAttachment])).toContain("附件 1: `notes.md`");
    expect(buildOutboundChatMessage("请处理", [textAttachment])).toContain("# hello");
  });

  it("returns only transport-ready attachment payloads", () => {
    expect(buildTransportAttachments([textAttachment, imageAttachment])).toEqual([
      "data:image/png;base64,abc",
    ]);
  });

  it("builds attachment prompt for binary-safe summaries", () => {
    expect(buildAttachmentPrompt([imageAttachment])).toContain("这是一个图片附件");
  });
});
