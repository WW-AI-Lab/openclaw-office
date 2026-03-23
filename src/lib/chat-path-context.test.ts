import { describe, expect, it } from "vitest";
import {
  buildChatPathReference,
  buildChatPathReferenceBundle,
} from "@/lib/chat-path-context";

describe("chat-path-context", () => {
  it("adds remote host context before a single path reference", () => {
    expect(
      buildChatPathReference(
        "OpenClaw 主机代码目录",
        "/home/kylin/workspace/openclaw-office",
        "OpenClaw 主机: `kylin@192.168.177.128`",
      ),
    ).toBe(
      "OpenClaw 主机: `kylin@192.168.177.128`\nOpenClaw 主机代码目录: `/home/kylin/workspace/openclaw-office`",
    );
  });

  it("builds a full environment reference bundle without empty lines", () => {
    expect(
      buildChatPathReferenceBundle([
        "OpenClaw 主机: `kylin@192.168.177.128`",
        "",
        "OpenClaw 主机代码目录: `/home/kylin/workspace/openclaw-office`",
        "OpenClaw 主机服务端目录: `/home/kylin/workspace/openclaw-gateway`",
      ]),
    ).toBe(
      "OpenClaw 主机: `kylin@192.168.177.128`\nOpenClaw 主机代码目录: `/home/kylin/workspace/openclaw-office`\nOpenClaw 主机服务端目录: `/home/kylin/workspace/openclaw-gateway`",
    );
  });
});
