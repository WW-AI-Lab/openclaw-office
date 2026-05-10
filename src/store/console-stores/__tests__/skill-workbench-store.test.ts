import { describe, expect, it } from "vitest";
import { readMermaidFromContent } from "../skill-workbench-store";

describe("readMermaidFromContent", () => {
  it("extracts the first fenced mermaid block from FLOWCHART markdown", () => {
    const content = `# Demo\n\nSome intro\n\n\
\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`
`;

    expect(readMermaidFromContent(content)).toBe(`flowchart TD
  A --> B`);
  });

  it("falls back to plain mermaid source after frontmatter", () => {
    const content = `---
title: Demo
---

flowchart TD
  Start --> End
`;

    expect(readMermaidFromContent(content)).toBe(`flowchart TD
  Start --> End`);
  });
});