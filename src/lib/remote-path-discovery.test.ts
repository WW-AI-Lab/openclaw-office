import { describe, expect, it } from "vitest";
import {
  buildDiscoveredChildDirectories,
  extractDiscoveredRemotePaths,
  mergeDiscoveredRemotePaths,
} from "@/lib/remote-path-discovery";

describe("remote-path-discovery", () => {
  it("extracts path-like values from config and config path", () => {
    const discovered = extractDiscoveredRemotePaths(
      {
        agents: {
          list: [
            { id: "main", workspace: "/home/kylin/workspace/openclaw-office" },
          ],
        },
        outputs: {
          resourceDirectory: "/home/kylin/workspace/openclaw-office/public/generated",
        },
      },
      "~/.openclaw/openclaw.json",
    );

    expect(discovered.map((item) => item.path)).toContain("/home/kylin/workspace/openclaw-office");
    expect(discovered.map((item) => item.path)).toContain("~/.openclaw");
  });

  it("merges discovered paths without duplicates", () => {
    const merged = mergeDiscoveredRemotePaths(
      [{ path: "/home/kylin/workspace", source: "config.a", kind: "config" }],
      [{ path: "/home/kylin/workspace", source: "workspace.main", kind: "workspace" }],
    );

    expect(merged).toHaveLength(1);
  });

  it("builds clickable child directory options under the current path", () => {
    const children = buildDiscoveredChildDirectories("/home/kylin/workspace", [
      {
        path: "/home/kylin/workspace/openclaw-office",
        source: "workspace.main",
        kind: "workspace",
      },
      {
        path: "/home/kylin/workspace/openclaw-gateway",
        source: "workspace.devops",
        kind: "workspace",
      },
    ]);

    expect(children.map((item) => item.path)).toEqual([
      "/home/kylin/workspace/openclaw-office",
      "/home/kylin/workspace/openclaw-gateway",
    ]);
  });
});
