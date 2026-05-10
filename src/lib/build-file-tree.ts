/**
 * Build a GitHub-style directory tree from a flat list of relative paths
 * (typically returned by workspace-skills list API).
 *
 * Input example:
 *   ["SKILL.md", "scripts/graph-analysis.py", "scripts/__pycache__/x.pyc"]
 *
 * Output (sorted: directories first, then files; case-insensitive alpha):
 *   [
 *     { name: "scripts", path: "scripts", kind: "dir", children: [
 *       { name: "__pycache__", path: "scripts/__pycache__", kind: "dir", children: [
 *         { name: "x.pyc", path: "scripts/__pycache__/x.pyc", kind: "file" },
 *       ] },
 *       { name: "graph-analysis.py", path: "scripts/graph-analysis.py", kind: "file" },
 *     ] },
 *     { name: "SKILL.md", path: "SKILL.md", kind: "file" },
 *   ]
 */

export type FileTreeNode =
  | { name: string; path: string; kind: "file" }
  | { name: string; path: string; kind: "dir"; children: FileTreeNode[] };

interface DirBuilder {
  name: string;
  path: string;
  children: Map<string, DirBuilder | FileTreeNode>;
}

function makeDir(name: string, path: string): DirBuilder {
  return { name, path, children: new Map() };
}

function finalize(dir: DirBuilder): FileTreeNode[] {
  const entries: FileTreeNode[] = [];
  for (const child of dir.children.values()) {
    if ("kind" in child) {
      // Already a finalized FileTreeNode (a file).
      entries.push(child);
    } else {
      // DirBuilder — recursively finalize.
      entries.push({
        name: child.name,
        path: child.path,
        kind: "dir",
        children: finalize(child),
      });
    }
  }
  entries.sort(compareNodes);
  return entries;
}

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function buildFileTree(paths: readonly string[]): FileTreeNode[] {
  const root = makeDir("", "");

  for (const raw of paths) {
    if (!raw) continue;
    // Normalize: strip leading "./" and any leading slashes.
    const normalized = raw.replace(/^\.\//, "").replace(/^\/+/, "");
    if (!normalized) continue;

    const segments = normalized.split("/").filter((s) => s.length > 0);
    if (segments.length === 0) continue;

    let cursor = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const dirPath = segments.slice(0, i + 1).join("/");
      let next = cursor.children.get(seg);
      if (!next || !("children" in next)) {
        next = makeDir(seg, dirPath);
        cursor.children.set(seg, next);
      }
      cursor = next as DirBuilder;
    }

    const leaf = segments[segments.length - 1];
    if (!cursor.children.has(leaf)) {
      cursor.children.set(leaf, {
        name: leaf,
        path: normalized,
        kind: "file",
      });
    }
  }

  return finalize(root);
}

/**
 * Collect the set of directory paths that must be expanded to reveal the
 * given selected file path. Example: "scripts/__pycache__/x.pyc" returns
 * ["scripts", "scripts/__pycache__"].
 */
export function expandedPathsForSelection(selected: string | null | undefined): string[] {
  if (!selected) return [];
  const segs = selected.split("/").filter((s) => s.length > 0);
  if (segs.length <= 1) return [];
  const paths: string[] = [];
  for (let i = 0; i < segs.length - 1; i++) {
    paths.push(segs.slice(0, i + 1).join("/"));
  }
  return paths;
}
