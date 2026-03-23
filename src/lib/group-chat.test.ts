import {
  GROUP_CHAT_SESSION_KEY,
  buildGroupRelaySessionKey,
  parseGroupMentions,
} from "./group-chat";

describe("group-chat helpers", () => {
  it("parses direct @mentions and strips them from the relay text", () => {
    const result = parseGroupMentions(
      "@architect @frontend build the mario landing page",
      [
        { id: "architect", name: "Architect" },
        { id: "frontend", name: "Frontend" },
        { id: "qa", name: "QA" },
      ],
    );

    expect(result.agentIds).toEqual(["architect", "frontend"]);
    expect(result.cleanedText).toBe("build the mario landing page");
  });

  it("expands @all to every available agent", () => {
    const result = parseGroupMentions("@all review this release", [
      { id: "architect", name: "Architect" },
      { id: "backend", name: "Backend" },
      { id: "frontend", name: "Frontend" },
    ]);

    expect(result.agentIds).toEqual(["architect", "backend", "frontend"]);
    expect(result.cleanedText).toBe("review this release");
  });

  it("supports @所有人 and non-ascii mention labels", () => {
    const result = parseGroupMentions("@所有人 请和 @前端 一起检查首页", [
      { id: "architect", name: "架构师" },
      { id: "frontend", name: "前端" },
      { id: "qa", name: "测试" },
    ]);

    expect(result.agentIds).toEqual(["architect", "frontend", "qa"]);
    expect(result.cleanedText).toBe("请和 一起检查首页");
  });

  it("builds a stable relay session key for the main group room", () => {
    expect(buildGroupRelaySessionKey("architect", GROUP_CHAT_SESSION_KEY)).toBe(
      "agent:architect:group-main",
    );
  });
});
