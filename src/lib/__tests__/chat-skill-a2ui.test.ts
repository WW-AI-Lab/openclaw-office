import { describe, expect, it } from "vitest";
import { detectSkillReference } from "@/lib/chat-skill-a2ui";

describe("detectSkillReference", () => {
  it("detects Chinese '使用Skill X' pattern", () => {
    expect(detectSkillReference("使用Skill data-analyst 分析数据")).toBe("data-analyst");
  });

  it("detects English 'Use Skill X' pattern", () => {
    expect(detectSkillReference("Use Skill data-analyst for analysis")).toBe("data-analyst");
  });

  it("detects '/skill X' pattern", () => {
    expect(detectSkillReference("/skill data-analyst")).toBe("data-analyst");
  });

  it("detects '使用技能 X' pattern", () => {
    expect(detectSkillReference("使用技能 data-analyst")).toBe("data-analyst");
  });

  it("is case-insensitive for 'Skill'", () => {
    expect(detectSkillReference("使用skill data-analyst")).toBe("data-analyst");
  });

  it("supports slugs with hyphens", () => {
    expect(detectSkillReference("使用Skill my-cool-skill")).toBe("my-cool-skill");
  });

  it("returns null for messages without skill references", () => {
    expect(detectSkillReference("今天天气怎么样")).toBeNull();
    expect(detectSkillReference("帮我写一段代码")).toBeNull();
    expect(detectSkillReference("")).toBeNull();
  });

  it("returns null for partial matches without a slug", () => {
    expect(detectSkillReference("使用Skill ")).toBeNull();
    expect(detectSkillReference("/skill ")).toBeNull();
  });
});
