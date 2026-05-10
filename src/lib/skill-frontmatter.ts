/**
 * Parse the YAML frontmatter block at the top of a SKILL.md-style file into:
 *   - `data`:  the structured value produced by `js-yaml` (anything YAML allows)
 *   - `rows`:  a flat key/value list (with depth) for legacy/fallback rendering
 *   - `body`:  the markdown text after the closing `---` fence
 *
 * The previous implementation was a hand-rolled mini-parser that only
 * understood single-line `key: value` pairs. Real-world SKILL.md files (e.g.
 * Anthropic Agent Skills like `brain-sleep`) routinely use:
 *
 *   description: >-
 *     long folded text spanning multiple lines
 *
 *   metadata:
 *     openclaw:
 *       requires:
 *         bins: [python3]
 *
 * which the old parser could not handle, causing the entire frontmatter to
 * leak into the rendered markdown body. We now delegate parsing to `js-yaml`
 * so the full YAML 1.2 surface (block scalars, flow-style collections,
 * multi-line strings, anchors, …) works as expected, then *additionally*
 * derive `rows` for the legacy KV-table renderer when the document is a
 * plain mapping.
 */
import yaml from "js-yaml";

export interface SkillFrontmatterRow {
  /** Indentation level (0 = top-level key). */
  depth: number;
  key: string;
  /** Raw trimmed value text (may be empty for parent keys / collections). */
  value: string;
}

export interface SkillFrontmatter {
  hasFrontmatter: boolean;
  /** Frontmatter text between the `---` fences (no fences themselves). */
  raw: string;
  /** Markdown body after the closing `---` fence. */
  body: string;
  /** Flattened key/value rows derived from `data` (legacy renderer). */
  rows: SkillFrontmatterRow[];
  /**
   * Structured value produced by js-yaml. Usually an object/mapping, but
   * could in principle be a scalar/array. `null` if YAML parsing failed
   * (the caller should fall back to raw / rows display).
   */
  data: Record<string, unknown> | null;
}

const FENCE = "---";

export function parseSkillFrontmatter(text: string): SkillFrontmatter {
  const stripped = text.replace(/^\uFEFF/, "");
  if (!stripped.startsWith(FENCE)) {
    return emptyResult(text);
  }

  // Skip the opening fence + optional newline.
  const afterOpen = stripped.slice(FENCE.length).replace(/^\r?\n/, "");
  // Find a closing fence on its own line.
  const closeMatch = afterOpen.match(/\r?\n---\s*(\r?\n|$)/);
  if (!closeMatch || closeMatch.index == null) {
    return emptyResult(text);
  }

  const raw = afterOpen.slice(0, closeMatch.index).replace(/\r\n/g, "\n").replace(/\s+$/, "");
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length).replace(/^\r?\n/, "");

  let data: Record<string, unknown> | null = null;
  try {
    const parsed = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = null;
  }

  const rows = data ? flattenToRows(data, 0) : fallbackRowParse(raw);

  return { hasFrontmatter: true, raw, body, rows, data };
}

function emptyResult(text: string): SkillFrontmatter {
  return { hasFrontmatter: false, raw: "", body: text, rows: [], data: null };
}

/**
 * Flatten a YAML-parsed object into the legacy `rows` shape, preserving
 * insertion order and nesting depth (2 spaces per level in the original
 * YAML maps to one depth increment in the rendered tree).
 */
function flattenToRows(value: Record<string, unknown>, depth: number): SkillFrontmatterRow[] {
  const out: SkillFrontmatterRow[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push({ depth, key, value: "" });
      out.push(...flattenToRows(v as Record<string, unknown>, depth + 1));
    } else if (Array.isArray(v)) {
      // Render arrays as compact JSON so the existing renderer can
      // pretty-print them via `looksLikeJson`.
      out.push({ depth, key, value: JSON.stringify(v) });
    } else if (v == null) {
      out.push({ depth, key, value: "" });
    } else {
      out.push({ depth, key, value: String(v) });
    }
  }
  return out;
}

/**
 * Fallback line-based parser, used only when js-yaml fails (e.g. malformed
 * frontmatter). Behaves like the original implementation so the UI still
 * shows *something* useful even if the YAML is broken.
 */
function fallbackRowParse(raw: string): SkillFrontmatterRow[] {
  const rows: SkillFrontmatterRow[] = [];
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) continue;
    if (line.trim().startsWith("#")) continue;

    const match = line.match(/^(\s*)([A-Za-z0-9_.\-$@]+):\s?(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const depth = Math.floor(indent / 2);
    const key = match[2].trim();
    const value = stripQuotes(match[3].trim());
    rows.push({ depth, key, value });
  }
  return rows;
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * True if `raw` looks like inline JSON (object or array). Useful in the
 * renderer to decide whether to pretty-print the value.
 */
export function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

/* ----------------------------------------------------------------------- */
/* Semantic helpers used by the structured renderer                         */
/* ----------------------------------------------------------------------- */

/**
 * Well-known top-level fields we surface with bespoke UI affordances. Any
 * other keys go into the generic "extra metadata" section.
 */
export const KNOWN_TOP_LEVEL_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "pattern",
  "version",
  "tags",
  "keywords",
  "author",
  "homepage",
  "repository",
  "metadata",
] as const;

export type KnownField = (typeof KNOWN_TOP_LEVEL_FIELDS)[number];

/** Pull a string field if present, trimming whitespace. */
export function pickString(data: Record<string, unknown> | null, key: string): string | null {
  if (!data) return null;
  const v = data[key];
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

/** Pull an array-of-strings field if present. */
export function pickStringList(
  data: Record<string, unknown> | null,
  key: string,
): string[] | null {
  if (!data) return null;
  const v = data[key];
  if (Array.isArray(v)) {
    const out = v.filter((x) => typeof x === "string" && x.trim().length > 0) as string[];
    return out.length > 0 ? out : null;
  }
  if (typeof v === "string" && v.trim().length > 0) return [v.trim()];
  return null;
}

/** Pull a nested object field if present. */
export function pickObject(
  data: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!data) return null;
  const v = data[key];
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

/** Return an emoji prefix the renderer can show next to the skill name. */
export function pickEmoji(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const direct = pickString(data, "emoji");
  if (direct) return direct;
  const meta = pickObject(data, "metadata");
  const openclaw = pickObject(meta, "openclaw");
  const fromOpenclaw = pickString(openclaw, "emoji");
  if (fromOpenclaw) return fromOpenclaw;
  return null;
}
