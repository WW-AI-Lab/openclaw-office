import {
  appendRemotePath,
  buildRemotePathBreadcrumbs,
  normalizeRemotePath,
  splitRemotePath,
} from "@/lib/remote-path-utils";

export interface DiscoveredRemotePath {
  path: string;
  source: string;
  kind: "config" | "workspace" | "runtime";
}

const PATH_KEY_HINTS = ["path", "dir", "directory", "workspace", "root", "output", "folder", "file"];

function looksLikeUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
}

function looksLikeAbsoluteRemotePath(value: string): boolean {
  return /^(~\/|\/|[a-zA-Z]:[\\/])/.test(value);
}

function looksLikeRemotePath(value: string, trail: string[]): boolean {
  if (!value.trim() || looksLikeUrl(value.trim())) {
    return false;
  }

  if (looksLikeAbsoluteRemotePath(value.trim())) {
    return true;
  }

  const hint = trail.join(".").toLowerCase();
  if (PATH_KEY_HINTS.some((segment) => hint.includes(segment)) && /[\\/]/.test(value)) {
    return true;
  }

  return false;
}

function dedupeDiscoveredPaths(items: DiscoveredRemotePath[]): DiscoveredRemotePath[] {
  const seen = new Set<string>();
  const result: DiscoveredRemotePath[] = [];

  items.forEach((item) => {
    const normalized = normalizeRemotePath(item.path);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push({ ...item, path: normalized });
  });

  return result;
}

function visitConfigNode(
  node: unknown,
  trail: string[],
  output: DiscoveredRemotePath[],
): void {
  if (typeof node === "string") {
    if (looksLikeRemotePath(node, trail)) {
      output.push({
        path: node.trim(),
        source: trail.join("."),
        kind: "config",
      });
    }
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => visitConfigNode(item, [...trail, String(index)], output));
    return;
  }

  if (node && typeof node === "object") {
    Object.entries(node as Record<string, unknown>).forEach(([key, value]) => {
      visitConfigNode(value, [...trail, key], output);
    });
  }
}

export function extractDiscoveredRemotePaths(
  config: Record<string, unknown> | null,
  configPath?: string | null,
): DiscoveredRemotePath[] {
  const output: DiscoveredRemotePath[] = [];

  if (config) {
    visitConfigNode(config, ["config"], output);
  }

  if (configPath && looksLikeRemotePath(configPath, ["configPath"])) {
    const crumbs = buildRemotePathBreadcrumbs(configPath);
    if (crumbs.length > 1) {
      output.push({
        path: crumbs[crumbs.length - 2].path,
        source: "configPath.parent",
        kind: "runtime",
      });
    }
  }

  return dedupeDiscoveredPaths(output);
}

export function mergeDiscoveredRemotePaths(
  ...groups: Array<DiscoveredRemotePath[] | undefined>
): DiscoveredRemotePath[] {
  return dedupeDiscoveredPaths(groups.flatMap((group) => group ?? []));
}

export function buildDiscoveredChildDirectories(
  basePath: string,
  discoveredPaths: DiscoveredRemotePath[],
): DiscoveredRemotePath[] {
  const normalizedBase = normalizeRemotePath(basePath);
  if (!normalizedBase) {
    return [];
  }

  const base = splitRemotePath(normalizedBase);
  const matches: DiscoveredRemotePath[] = [];
  const seen = new Set<string>();

  discoveredPaths.forEach((item) => {
    const candidate = splitRemotePath(item.path);
    if (candidate.style !== base.style || candidate.root !== base.root) {
      return;
    }

    if (candidate.segments.length <= base.segments.length) {
      return;
    }

    const baseMatches = base.segments.every((segment, index) => candidate.segments[index] === segment);
    if (!baseMatches) {
      return;
    }

    const nextPath = appendRemotePath(normalizedBase, candidate.segments[base.segments.length]);
    const normalizedNextPath = normalizeRemotePath(nextPath);
    if (seen.has(normalizedNextPath)) {
      return;
    }

    seen.add(normalizedNextPath);
    matches.push({
      path: normalizedNextPath,
      source: item.source,
      kind: item.kind,
    });
  });

  return matches;
}
