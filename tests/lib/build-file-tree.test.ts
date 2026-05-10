import { describe, expect, it } from "vitest";
import { buildFileTree, expandedPathsForSelection } from "@/lib/build-file-tree";

describe("buildFileTree", () => {
  it("flat files stay flat", () => {
    const tree = buildFileTree(["SKILL.md", "FLOWCHART.md"]);
    expect(tree).toEqual([
      { name: "FLOWCHART.md", path: "FLOWCHART.md", kind: "file" },
      { name: "SKILL.md", path: "SKILL.md", kind: "file" },
    ]);
  });

  it("groups nested paths into directory nodes", () => {
    const tree = buildFileTree([
      "SKILL.md",
      "scripts/graph-analysis.py",
      "scripts/__pycache__/graph.cpython-313.pyc",
    ]);

    expect(tree).toHaveLength(2);
    const [dir, file] = tree;
    expect(dir.kind).toBe("dir");
    expect(dir.name).toBe("scripts");
    expect(file).toEqual({ name: "SKILL.md", path: "SKILL.md", kind: "file" });

    if (dir.kind !== "dir") throw new Error("unreachable");
    expect(dir.children).toHaveLength(2);
    const [sub, py] = dir.children;
    expect(sub.kind).toBe("dir");
    expect(sub.name).toBe("__pycache__");
    expect(py).toEqual({
      name: "graph-analysis.py",
      path: "scripts/graph-analysis.py",
      kind: "file",
    });

    if (sub.kind !== "dir") throw new Error("unreachable");
    expect(sub.children).toEqual([
      {
        name: "graph.cpython-313.pyc",
        path: "scripts/__pycache__/graph.cpython-313.pyc",
        kind: "file",
      },
    ]);
  });

  it("sorts directories before files and case-insensitive", () => {
    const tree = buildFileTree([
      "zeta.md",
      "alpha.md",
      "beta/file.txt",
      "Aardvark/x.txt",
    ]);
    expect(tree.map((n) => `${n.kind}:${n.name}`)).toEqual([
      "dir:Aardvark",
      "dir:beta",
      "file:alpha.md",
      "file:zeta.md",
    ]);
  });

  it("normalizes leading ./ and //", () => {
    const tree = buildFileTree(["./a.md", "//b/c.md", ""]);
    expect(tree.map((n) => n.path).sort()).toEqual(["a.md", "b"]);
  });

  it("deduplicates duplicate entries", () => {
    const tree = buildFileTree(["a.md", "a.md"]);
    expect(tree).toHaveLength(1);
  });
});

describe("expandedPathsForSelection", () => {
  it("returns empty for root files", () => {
    expect(expandedPathsForSelection("SKILL.md")).toEqual([]);
    expect(expandedPathsForSelection(null)).toEqual([]);
    expect(expandedPathsForSelection(undefined)).toEqual([]);
  });

  it("returns every ancestor directory path", () => {
    expect(expandedPathsForSelection("scripts/__pycache__/x.pyc")).toEqual([
      "scripts",
      "scripts/__pycache__",
    ]);
  });
});
