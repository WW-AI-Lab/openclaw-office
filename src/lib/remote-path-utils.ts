export type RemotePathStyle = "posix" | "windows";
export const FIXED_REMOTE_WORKSPACE_ROOT = "/home/kylin/workspace";

export interface RemotePathParts {
  style: RemotePathStyle;
  root: string;
  segments: string[];
}

export interface RemotePathBreadcrumb {
  label: string;
  path: string;
}

export function detectRemotePathStyle(path: string): RemotePathStyle {
  const trimmed = path.trim();
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.includes("\\")) {
    return "windows";
  }
  return "posix";
}

function normalizeSeparators(path: string, style: RemotePathStyle): string {
  if (style === "windows") {
    return path.replace(/\//g, "\\");
  }
  return path.replace(/\\/g, "/");
}

export function splitRemotePath(path: string): RemotePathParts {
  const trimmed = path.trim();
  const style = detectRemotePathStyle(trimmed);
  const normalized = normalizeSeparators(trimmed, style);

  if (!normalized) {
    return { style, root: "", segments: [] };
  }

  if (style === "windows") {
    const driveMatch = normalized.match(/^([a-zA-Z]:)(\\+)?(.*)$/);
    if (driveMatch) {
      const root = driveMatch[1];
      const rest = driveMatch[3] ?? "";
      return {
        style,
        root,
        segments: rest.split(/\\+/).filter(Boolean),
      };
    }

    return {
      style,
      root: "",
      segments: normalized.split(/\\+/).filter(Boolean),
    };
  }

  if (normalized === "/") {
    return { style, root: "/", segments: [] };
  }

  if (normalized.startsWith("~/")) {
    return {
      style,
      root: "~",
      segments: normalized.slice(2).split("/").filter(Boolean),
    };
  }

  if (normalized === "~") {
    return { style, root: "~", segments: [] };
  }

  if (normalized.startsWith("/")) {
    return {
      style,
      root: "/",
      segments: normalized.slice(1).split("/").filter(Boolean),
    };
  }

  return {
    style,
    root: "",
    segments: normalized.split("/").filter(Boolean),
  };
}

export function joinRemotePath(parts: RemotePathParts): string {
  const { style, root, segments } = parts;
  const separator = style === "windows" ? "\\" : "/";

  if (style === "windows") {
    if (root) {
      return segments.length > 0 ? `${root}${separator}${segments.join(separator)}` : `${root}${separator}`;
    }
    return segments.join(separator);
  }

  if (root === "/") {
    return segments.length > 0 ? `/${segments.join("/")}` : "/";
  }

  if (root === "~") {
    return segments.length > 0 ? `~/${segments.join("/")}` : "~";
  }

  return segments.join(separator);
}

export function normalizeRemotePath(path: string): string {
  const parts = splitRemotePath(path);
  return joinRemotePath(parts);
}

function splitChildSegments(path: string, style: RemotePathStyle): string[] {
  const normalized = normalizeSeparators(path.trim(), style);
  return normalized
    .split(style === "windows" ? /\\+/ : /\/+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function appendRemotePath(basePath: string, childPath: string): string {
  const base = splitRemotePath(basePath);
  const style = base.root || base.segments.length > 0 ? base.style : detectRemotePathStyle(childPath);
  const root = base.root;
  const segments = [...base.segments, ...splitChildSegments(childPath, style)];
  return joinRemotePath({ style, root, segments });
}

export function getRemotePathParent(path: string): string {
  const parts = splitRemotePath(path);
  if (parts.segments.length === 0) {
    return parts.root;
  }

  return joinRemotePath({
    ...parts,
    segments: parts.segments.slice(0, -1),
  });
}

export function buildRemotePathBreadcrumbs(path: string): RemotePathBreadcrumb[] {
  const parts = splitRemotePath(path);
  const breadcrumbs: RemotePathBreadcrumb[] = [];

  if (parts.root) {
    breadcrumbs.push({
      label: parts.root,
      path: joinRemotePath({ ...parts, segments: [] }),
    });
  }

  parts.segments.forEach((segment, index) => {
    breadcrumbs.push({
      label: segment,
      path: joinRemotePath({
        ...parts,
        segments: parts.segments.slice(0, index + 1),
      }),
    });
  });

  return breadcrumbs;
}

export function getDefaultRemotePathSuggestions(style: RemotePathStyle): string[] {
  if (style === "windows") {
    return ["C:\\"];
  }
  return ["/", "~"];
}

export function dedupeRemotePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  paths.forEach((path) => {
    const normalized = normalizeRemotePath(path);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

export function isRemotePathWithinRoot(path: string, rootPath = FIXED_REMOTE_WORKSPACE_ROOT): boolean {
  const normalizedPath = normalizeRemotePath(path);
  const normalizedRoot = normalizeRemotePath(rootPath);
  if (!normalizedPath || !normalizedRoot) {
    return false;
  }

  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function coerceRemotePathToRoot(path: string, rootPath = FIXED_REMOTE_WORKSPACE_ROOT): string {
  const trimmed = path.trim();
  const normalizedRoot = normalizeRemotePath(rootPath);
  if (!trimmed) {
    return "";
  }

  const normalizedPath = normalizeRemotePath(trimmed);
  if (isRemotePathWithinRoot(normalizedPath, normalizedRoot)) {
    return normalizedPath;
  }

  if (/^(~\/|\/|[a-zA-Z]:[\\/])/.test(normalizedPath)) {
    return normalizedRoot;
  }

  const parts = splitRemotePath(normalizedPath);
  if (parts.segments.length === 0) {
    return normalizedRoot;
  }

  return appendRemotePath(normalizedRoot, parts.segments.join("/"));
}

export function filterRemotePathsWithinRoot(
  paths: string[],
  rootPath = FIXED_REMOTE_WORKSPACE_ROOT,
): string[] {
  return dedupeRemotePaths(paths).filter((path) => isRemotePathWithinRoot(path, rootPath));
}
