// ClawHub Registry REST API client
// Public read-only endpoints for searching, browsing, and fetching skill details

// --- Types ---

export interface ClawHubSearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary: string | null;
  version: string | null;
  updatedAt: number;
}

export interface ClawHubSkillStats {
  comments: number;
  downloads: number;
  installsAllTime: number;
  installsCurrent: number;
  stars: number;
  versions: number;
}

export interface ClawHubSkillListItem {
  slug: string;
  displayName: string;
  summary: string | null;
  tags: Record<string, string>;
  stats: ClawHubSkillStats;
  createdAt: number;
  updatedAt: number;
  latestVersion?: {
    version: string;
    createdAt: number;
    changelog: string;
  };
}

export interface ClawHubExploreResponse {
  items: ClawHubSkillListItem[];
  nextCursor: string | null;
}

export interface ClawHubSkillDetail {
  skill: {
    slug: string;
    displayName: string;
    summary: string | null;
    tags: Record<string, string>;
    stats: ClawHubSkillStats;
    createdAt: number;
    updatedAt: number;
  } | null;
  latestVersion: {
    version: string;
    createdAt: number;
    changelog: string;
  } | null;
  owner: {
    handle: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
}

export class ClawHubError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "ClawHubError";
  }
}

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// --- Rate limit ---

let rateLimitedUntil = 0;

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

// --- Config ---

const EXPLORE_CACHE_TTL = 60_000;
const DETAIL_CACHE_TTL = 300_000;
const RATE_LIMIT_COOLDOWN = 5_000;

function getBaseUrl(): string {
  return import.meta.env.VITE_CLAWHUB_REGISTRY ?? "https://clawhub.ai";
}

// --- API helpers ---

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (isRateLimited()) {
    throw new ClawHubError(429, "Rate limited, please wait before retrying");
  }

  const url = new URL(path, getBaseUrl());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    throw new ClawHubError(0, `Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (response.status === 429) {
    rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN;
    throw new ClawHubError(429, "Search service is busy, please try again later");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ClawHubError(response.status, text || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// --- Public API ---

export async function clawhubSearch(query: string, limit = 20): Promise<ClawHubSearchResult[]> {
  const result = await apiFetch<{ results: ClawHubSearchResult[] }>("/api/v1/search", {
    q: query,
    limit: String(limit),
  });
  return result.results ?? [];
}

export async function clawhubExplore(options?: {
  limit?: number;
  cursor?: string;
}): Promise<ClawHubExploreResponse> {
  const limit = options?.limit ?? 20;
  const cursor = options?.cursor;
  const cacheKey = `explore:${limit}:${cursor ?? ""}`;

  const cached = getCached<ClawHubExploreResponse>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = { limit: String(limit) };
  if (cursor) params.cursor = cursor;

  const result = await apiFetch<{ items: ClawHubSkillListItem[]; nextCursor?: string | null }>(
    "/api/v1/skills",
    params,
  );

  const response: ClawHubExploreResponse = {
    items: result.items ?? [],
    nextCursor: result.nextCursor ?? null,
  };
  setCache(cacheKey, response, EXPLORE_CACHE_TTL);
  return response;
}

export async function clawhubSkillDetail(slug: string): Promise<ClawHubSkillDetail> {
  const cacheKey = `detail:${slug}`;
  const cached = getCached<ClawHubSkillDetail>(cacheKey);
  if (cached) return cached;

  const result = await apiFetch<ClawHubSkillDetail>(`/api/v1/skills/${encodeURIComponent(slug)}`);
  setCache(cacheKey, result, DETAIL_CACHE_TTL);
  return result;
}

export function clearClawHubCache(): void {
  cache.clear();
  rateLimitedUntil = 0;
}
