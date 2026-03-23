import { describe, expect, it } from "vitest";
import {
  MAIN_AUTOMATION_RAW_PREFIX,
  buildMainAutomationPrompt,
  getMainAutomationStatus,
  prepareMainAutomationMessage,
} from "./main-auto-orchestration";

describe("main-auto-orchestration", () => {
  it("builds a fixed-team orchestration prompt with environment hints", () => {
    const prompt = buildMainAutomationPrompt("写一份a股监控系统", {
      enabled: true,
      hostLabel: "kylin@192.168.177.128",
      codeOutputDirectory: "/home/kylin/workspace/openclaw-office/dist",
      resourceOutputDirectory: "/home/kylin/workspace/openclaw-office/public/generated",
    });

    expect(prompt).toContain("agent:architect:main");
    expect(prompt).toContain("agent:backend:main");
    expect(prompt).toContain("agent:frontend:main");
    expect(prompt).toContain("agent:qa:main");
    expect(prompt).toContain("agent:devops:main");
    expect(prompt).toContain("OpenClaw 主机: kylin@192.168.177.128");
    expect(prompt).toContain("/home/kylin/workspace/openclaw-office/dist");
    expect(prompt).toContain("/home/kylin/workspace/openclaw-office/public/generated");
    expect(prompt).toContain("不要只回复计划");
    expect(prompt).toContain("STATUS: CONTINUE");
    expect(prompt).toContain("STATUS: COMPLETE");
  });

  it("supports a raw bypass prefix", () => {
    const result = prepareMainAutomationMessage(
      `${MAIN_AUTOMATION_RAW_PREFIX}直接发送原文`,
      { enabled: true },
    );

    expect(result.automated).toBe(false);
    expect(result.text).toBe("直接发送原文");
  });

  it("parses automation status markers", () => {
    expect(getMainAutomationStatus("还没做完\nSTATUS: CONTINUE")).toBe("continue");
    expect(getMainAutomationStatus("全部完成\nSTATUS: COMPLETE")).toBe("complete");
    expect(getMainAutomationStatus("普通回复")).toBe("unknown");
  });
});
