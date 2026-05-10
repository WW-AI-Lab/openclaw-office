import { describe, expect, it } from "vitest";
import {
  looksLikeJson,
  parseSkillFrontmatter,
} from "@/lib/skill-frontmatter";

describe("parseSkillFrontmatter", () => {
  it("returns whole body untouched when there is no frontmatter", () => {
    const result = parseSkillFrontmatter("# Hello\n\nworld");
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe("# Hello\n\nworld");
    expect(result.rows).toEqual([]);
  });

  it("parses top-level key/value pairs", () => {
    const text = `---\nname: brain-sleep\ndescription: short desc\n---\n# body\n`;
    const result = parseSkillFrontmatter(text);
    expect(result.hasFrontmatter).toBe(true);
    expect(result.body).toBe("# body\n");
    expect(result.rows).toEqual([
      { depth: 0, key: "name", value: "brain-sleep" },
      { depth: 0, key: "description", value: "short desc" },
    ]);
  });

  it("tracks indentation as depth", () => {
    const text = [
      "---",
      "metadata:",
      "  openclaw:",
      "    user-invocable: true",
      "    emoji: \"🧠\"",
      "---",
      "",
      "body line",
    ].join("\n");
    const result = parseSkillFrontmatter(text);
    expect(result.hasFrontmatter).toBe(true);
    expect(result.body).toBe("body line");
    expect(result.rows).toEqual([
      { depth: 0, key: "metadata", value: "" },
      { depth: 1, key: "openclaw", value: "" },
      { depth: 2, key: "user-invocable", value: "true" },
      { depth: 2, key: "emoji", value: "🧠" },
    ]);
  });

  it("strips single and double quotes around values", () => {
    const text = `---\na: "quoted"\nb: 'single'\nc: bare\n---\n`;
    const result = parseSkillFrontmatter(text);
    expect(result.rows.map((r) => r.value)).toEqual(["quoted", "single", "bare"]);
  });

  it("skips comments and empty lines", () => {
    const text = `---\n# a comment\n\nname: x\n---\n`;
    const result = parseSkillFrontmatter(text);
    expect(result.rows).toEqual([{ depth: 0, key: "name", value: "x" }]);
  });

  it("degrades gracefully if closing fence is missing", () => {
    const text = `---\nname: x\n# no closing`;
    const result = parseSkillFrontmatter(text);
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe(text);
  });
});

describe("looksLikeJson", () => {
  it("recognises inline object and array literals", () => {
    expect(looksLikeJson('{"a":1}')).toBe(true);
    expect(looksLikeJson(" [1, 2, 3] ")).toBe(true);
    expect(looksLikeJson("not json")).toBe(false);
    expect(looksLikeJson("{unbalanced")).toBe(false);
  });
});
