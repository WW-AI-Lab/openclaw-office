import { describe, expect, it } from "vitest";
import {
  looksLikeJson,
  parseSkillFrontmatter,
  pickEmoji,
  pickObject,
  pickString,
  pickStringList,
  type SkillFrontmatterRow,
} from "../skill-frontmatter";

describe("parseSkillFrontmatter", () => {
  it("returns whole body untouched when there is no frontmatter", () => {
    const result = parseSkillFrontmatter("# Hello\n\nworld");
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe("# Hello\n\nworld");
    expect(result.rows).toEqual([]);
    expect(result.data).toBeNull();
  });

  it("parses top-level key/value pairs", () => {
    const text = `---\nname: brain-sleep\ndescription: short desc\n---\n# body\n`;
    const result = parseSkillFrontmatter(text);
    expect(result.hasFrontmatter).toBe(true);
    expect(result.body).toBe("# body\n");
    expect(result.data).toEqual({ name: "brain-sleep", description: "short desc" });
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
      '    emoji: "🧠"',
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
    expect(result.rows.map((r: SkillFrontmatterRow) => r.value)).toEqual([
      "quoted",
      "single",
      "bare",
    ]);
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

  it("supports YAML folded scalars (>-) for multi-line description", () => {
    const text = [
      "---",
      "name: brain-sleep",
      "description: >-",
      "  🧠💤 当用户提到\"睡眠\"、\"记忆整理\" 时触发。",
      "  执行三阶段流水线，写入 ClawBrain Wiki 记忆体系。",
      "pattern: pipeline+generator+reviewer",
      "---",
      "",
      "# Body",
    ].join("\n");
    const result = parseSkillFrontmatter(text);
    expect(result.hasFrontmatter).toBe(true);
    expect(result.data?.name).toBe("brain-sleep");
    expect(typeof result.data?.description).toBe("string");
    expect(result.data?.description as string).toContain("睡眠");
    expect(result.data?.description as string).toContain("三阶段");
    expect(result.data?.pattern).toBe("pipeline+generator+reviewer");
    expect(result.body).toBe("# Body");
  });

  it("supports nested metadata and inline flow lists", () => {
    const text = [
      "---",
      "name: brain-sleep",
      "metadata:",
      "  openclaw:",
      "    user-invocable: true",
      '    emoji: "🧠💤"',
      "    requires:",
      "      bins: [python3]",
      "    integrations: [obsidian-vault-integration]",
      "---",
      "",
    ].join("\n");
    const result = parseSkillFrontmatter(text);
    expect(result.hasFrontmatter).toBe(true);
    const meta = pickObject(result.data, "metadata");
    const openclaw = pickObject(meta, "openclaw");
    expect(openclaw?.["user-invocable"]).toBe(true);
    expect(openclaw?.emoji).toBe("🧠💤");
    expect((openclaw?.integrations as string[])[0]).toBe("obsidian-vault-integration");
    expect(pickEmoji(result.data)).toBe("🧠💤");
  });

  it("falls back to line parser when YAML is malformed", () => {
    // Tab indentation makes js-yaml throw; the fallback parser should still
    // produce something useful so the UI does not blow up.
    const text = ["---", "name: skill-x", "metadata:", "\tbroken-tab: true", "---", ""].join("\n");
    const result = parseSkillFrontmatter(text);
    expect(result.hasFrontmatter).toBe(true);
    expect(result.rows.find((r: SkillFrontmatterRow) => r.key === "name")?.value).toBe("skill-x");
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

describe("frontmatter pickers", () => {
  const data = {
    name: "x",
    license: "MIT",
    tags: ["alpha", "beta"],
    metadata: { openclaw: { emoji: "✨" } },
  };

  it("picks string fields", () => {
    expect(pickString(data, "name")).toBe("x");
    expect(pickString(data, "missing")).toBeNull();
  });

  it("picks string lists", () => {
    expect(pickStringList(data, "tags")).toEqual(["alpha", "beta"]);
    expect(pickStringList(data, "missing")).toBeNull();
  });

  it("walks nested emoji from metadata.openclaw", () => {
    expect(pickEmoji(data)).toBe("✨");
  });
});
