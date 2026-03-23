import { describe, expect, it } from "vitest";
import {
  appendRemotePath,
  buildRemotePathBreadcrumbs,
  coerceRemotePathToRoot,
  filterRemotePathsWithinRoot,
  FIXED_REMOTE_WORKSPACE_ROOT,
  getRemotePathParent,
  isRemotePathWithinRoot,
  normalizeRemotePath,
  splitRemotePath,
} from "@/lib/remote-path-utils";

describe("remote-path-utils", () => {
  it("splits and rebuilds posix paths", () => {
    expect(splitRemotePath("/home/kylin/workspace")).toEqual({
      style: "posix",
      root: "/",
      segments: ["home", "kylin", "workspace"],
    });
    expect(normalizeRemotePath("~/workspace/output")).toBe("~/workspace/output");
  });

  it("appends child folders to the current remote path", () => {
    expect(appendRemotePath("/home/kylin/workspace", "openclaw-office/dist")).toBe(
      "/home/kylin/workspace/openclaw-office/dist",
    );
    expect(appendRemotePath("C:\\Users\\kylin", "projects\\openclaw")).toBe(
      "C:\\Users\\kylin\\projects\\openclaw",
    );
  });

  it("returns parent paths and breadcrumbs", () => {
    expect(getRemotePathParent("/home/kylin/workspace/openclaw-office")).toBe(
      "/home/kylin/workspace",
    );
    expect(buildRemotePathBreadcrumbs("/home/kylin/workspace")).toEqual([
      { label: "/", path: "/" },
      { label: "home", path: "/home" },
      { label: "kylin", path: "/home/kylin" },
      { label: "workspace", path: "/home/kylin/workspace" },
    ]);
  });

  it("coerces paths into the fixed workspace root", () => {
    expect(coerceRemotePathToRoot("openclaw-office")).toBe(
      `${FIXED_REMOTE_WORKSPACE_ROOT}/openclaw-office`,
    );
    expect(coerceRemotePathToRoot("/tmp/generated/assets")).toBe(FIXED_REMOTE_WORKSPACE_ROOT);
    expect(isRemotePathWithinRoot(`${FIXED_REMOTE_WORKSPACE_ROOT}/dist`)).toBe(true);
    expect(isRemotePathWithinRoot("/home/kylin/.openclaw")).toBe(false);
    expect(
      filterRemotePathsWithinRoot([
        `${FIXED_REMOTE_WORKSPACE_ROOT}/frontend`,
        "/home/kylin/.openclaw",
      ]),
    ).toEqual([`${FIXED_REMOTE_WORKSPACE_ROOT}/frontend`]);
  });
});
