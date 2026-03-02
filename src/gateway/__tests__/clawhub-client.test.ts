import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clawhubSearch,
  clawhubExplore,
  clawhubSkillDetail,
  clearClawHubCache,
  ClawHubError,
} from "../clawhub-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  clearClawHubCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clawhubSearch", () => {
  it("returns search results", async () => {
    const results = [
      {
        score: 3.69,
        slug: "powerpoint-pptx",
        displayName: "PowerPoint PPTX",
        summary: null,
        version: null,
        updatedAt: 1000,
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ results }));

    const res = await clawhubSearch("pptx", 10);
    expect(res).toHaveLength(1);
    expect(res[0].slug).toBe("powerpoint-pptx");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/search?q=pptx&limit=10"),
    );
  });

  it("returns empty array when no results", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
    const res = await clawhubSearch("nonexistent");
    expect(res).toEqual([]);
  });

  it("throws ClawHubError on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse("Not Found", 404));
    await expect(clawhubSearch("test")).rejects.toThrow(ClawHubError);
  });

  it("throws ClawHubError on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(clawhubSearch("test")).rejects.toThrow(ClawHubError);
  });

  it("handles rate limit (429) with cooldown", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    });

    await expect(clawhubSearch("test")).rejects.toThrow("Search service is busy");

    // Subsequent call should also fail due to rate limit cooldown
    await expect(clawhubSearch("test2")).rejects.toThrow("Rate limited");
  });
});

describe("clawhubExplore", () => {
  it("returns items and nextCursor", async () => {
    const data = {
      items: [
        {
          slug: "skill-1",
          displayName: "Skill 1",
          summary: null,
          tags: {},
          stats: {
            downloads: 10,
            installsAllTime: 0,
            installsCurrent: 0,
            stars: 0,
            versions: 1,
            comments: 0,
          },
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      nextCursor: "abc",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    const res = await clawhubExplore({ limit: 5 });
    expect(res.items).toHaveLength(1);
    expect(res.nextCursor).toBe("abc");
  });

  it("uses cache on second call", async () => {
    const data = { items: [], nextCursor: null };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await clawhubExplore({ limit: 5 });
    const res2 = await clawhubExplore({ limit: 5 });
    expect(res2.items).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("passes cursor for pagination", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [], nextCursor: null }));
    await clawhubExplore({ cursor: "xyz" });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("cursor=xyz"));
  });
});

describe("clawhubSkillDetail", () => {
  it("returns skill detail", async () => {
    const detail = {
      skill: {
        slug: "test",
        displayName: "Test",
        summary: null,
        tags: {},
        stats: {
          downloads: 5,
          installsAllTime: 0,
          installsCurrent: 0,
          stars: 1,
          versions: 1,
          comments: 0,
        },
        createdAt: 1000,
        updatedAt: 2000,
      },
      latestVersion: { version: "1.0.0", createdAt: 1000, changelog: "initial" },
      owner: { handle: "user1" },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));

    const res = await clawhubSkillDetail("test");
    expect(res.skill?.slug).toBe("test");
    expect(res.latestVersion?.version).toBe("1.0.0");
    expect(res.owner?.handle).toBe("user1");
  });

  it("caches detail for 5 minutes", async () => {
    const detail = { skill: null, latestVersion: null, owner: null };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));

    await clawhubSkillDetail("cached-test");
    await clawhubSkillDetail("cached-test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
