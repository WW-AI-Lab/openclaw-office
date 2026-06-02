import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/chat/MarkdownContent";

const A2UI_BLOCK = [
  "```a2ui",
  JSON.stringify({
    skill: "demo",
    title: "Demo 表单",
    fields: [{ key: "name", label: "名称", type: "text", required: true }],
  }),
  "```",
].join("\n");

describe("MarkdownContent", () => {
  it("renders ```a2ui blocks as an interactive form by default", async () => {
    render(<MarkdownContent content={A2UI_BLOCK} messageId="m1" />);
    await waitFor(() => {
      expect(screen.getByText("Demo 表单")).toBeInTheDocument();
    });
    // No raw JSON should leak when the form is rendered.
    expect(screen.queryByText(/"skill": "demo"/)).not.toBeInTheDocument();
  });

  it("renders ```a2ui blocks as plain code fences when disableA2uiForm is set", () => {
    render(<MarkdownContent content={A2UI_BLOCK} messageId="m1" disableA2uiForm />);
    // The interactive form must not appear — we render the raw JSON instead.
    expect(screen.queryByText("Demo 表单")).not.toBeInTheDocument();
    // A <pre> with the JSON body is the expected code-fence fallback.
    expect(document.querySelector("pre code")?.textContent).toContain("Demo 表单");
  });

  it("falls back to a code fence for malformed ```a2ui blocks", () => {
    const broken = ["```a2ui", "{ not valid json", "```"].join("\n");
    render(<MarkdownContent content={broken} messageId="m1" />);
    expect(document.querySelector("pre code")?.textContent).toContain("not valid json");
  });
});
