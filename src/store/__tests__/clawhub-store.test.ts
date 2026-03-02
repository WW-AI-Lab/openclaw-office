import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useClawHubStore } from "../console-stores/clawhub-store";

vi.mock("@/gateway/clawhub-client", () => ({
  clawhubSearch: vi.fn(),
  clawhubExplore: vi.fn(),
  clawhubSkillDetail: vi.fn(),
  ClawHubError: class ClawHubError extends Error {
    code: number;
    constructor(code: number, message: string) {
      super(message);
      this.code = code;
      this.name = "ClawHubError";
    }
  },
}));

const { clawhubSearch, clawhubExplore, clawhubSkillDetail, ClawHubError } =
  await import("@/gateway/clawhub-client");

const mockSearch = vi.mocked(clawhubSearch);
const mockExplore = vi.mocked(clawhubExplore);
const mockDetail = vi.mocked(clawhubSkillDetail);

beforeEach(() => {
  vi.clearAllMocks();
  useClawHubStore.setState({
    searchResults: [],
    exploreItems: [],
    searchQuery: "",
    isSearching: false,
    isExploring: false,
    searchError: null,
    exploreError: null,
    nextCursor: null,
    selectedDetail: null,
    detailLoading: false,
    offlineMode: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useClawHubStore", () => {
  describe("searchImmediate", () => {
    it("performs search and updates results", async () => {
      const results = [
        {
          score: 1,
          slug: "test",
          displayName: "Test",
          summary: null,
          version: null,
          updatedAt: 1000,
        },
      ];
      mockSearch.mockResolvedValueOnce(results);

      await useClawHubStore.getState().searchImmediate("test");

      expect(useClawHubStore.getState().searchResults).toEqual(results);
      expect(useClawHubStore.getState().isSearching).toBe(false);
      expect(useClawHubStore.getState().offlineMode).toBe(false);
    });

    it("sets offline mode on network error", async () => {
      mockSearch.mockRejectedValueOnce(new ClawHubError(0, "Network error"));

      await useClawHubStore.getState().searchImmediate("test");

      expect(useClawHubStore.getState().searchError).toBe("Network error");
      expect(useClawHubStore.getState().offlineMode).toBe(true);
    });

    it("does not set offline on non-network error", async () => {
      mockSearch.mockRejectedValueOnce(new ClawHubError(429, "Rate limited"));

      await useClawHubStore.getState().searchImmediate("test");

      expect(useClawHubStore.getState().searchError).toBe("Rate limited");
      expect(useClawHubStore.getState().offlineMode).toBe(false);
    });

    it("skips empty query", async () => {
      await useClawHubStore.getState().searchImmediate("  ");
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  describe("explore", () => {
    it("loads explore items", async () => {
      const items = [
        {
          slug: "s1",
          displayName: "S1",
          summary: null,
          tags: {},
          stats: {
            downloads: 0,
            installsAllTime: 0,
            installsCurrent: 0,
            stars: 0,
            versions: 1,
            comments: 0,
          },
          createdAt: 1,
          updatedAt: 2,
        },
      ];
      mockExplore.mockResolvedValueOnce({ items, nextCursor: "abc" });

      await useClawHubStore.getState().explore();

      expect(useClawHubStore.getState().exploreItems).toEqual(items);
      expect(useClawHubStore.getState().nextCursor).toBe("abc");
    });

    it("appends items on loadMore", async () => {
      useClawHubStore.setState({
        exploreItems: [
          {
            slug: "old",
            displayName: "Old",
            summary: null,
            tags: {},
            stats: {
              downloads: 0,
              installsAllTime: 0,
              installsCurrent: 0,
              stars: 0,
              versions: 1,
              comments: 0,
            },
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        nextCursor: "cursor1",
      });

      const newItems = [
        {
          slug: "new",
          displayName: "New",
          summary: null,
          tags: {},
          stats: {
            downloads: 0,
            installsAllTime: 0,
            installsCurrent: 0,
            stars: 0,
            versions: 1,
            comments: 0,
          },
          createdAt: 1,
          updatedAt: 2,
        },
      ];
      mockExplore.mockResolvedValueOnce({ items: newItems, nextCursor: null });

      await useClawHubStore.getState().explore(true);

      expect(useClawHubStore.getState().exploreItems).toHaveLength(2);
      expect(useClawHubStore.getState().nextCursor).toBeNull();
    });

    it("does not load more without nextCursor", async () => {
      useClawHubStore.setState({ nextCursor: null });
      await useClawHubStore.getState().explore(true);
      expect(mockExplore).not.toHaveBeenCalled();
    });
  });

  describe("fetchDetail", () => {
    it("fetches and stores detail", async () => {
      const detail = {
        skill: {
          slug: "test",
          displayName: "Test",
          summary: null,
          tags: {},
          stats: {
            downloads: 1,
            installsAllTime: 0,
            installsCurrent: 0,
            stars: 0,
            versions: 1,
            comments: 0,
          },
          createdAt: 1,
          updatedAt: 2,
        },
        latestVersion: null,
        owner: null,
      };
      mockDetail.mockResolvedValueOnce(detail);

      await useClawHubStore.getState().fetchDetail("test");

      expect(useClawHubStore.getState().selectedDetail).toEqual(detail);
      expect(useClawHubStore.getState().detailLoading).toBe(false);
    });
  });

  describe("clearSearch", () => {
    it("clears search state", () => {
      useClawHubStore.setState({
        searchQuery: "test",
        searchResults: [
          { score: 1, slug: "t", displayName: "T", summary: null, version: null, updatedAt: 1 },
        ],
        searchError: "err",
      });

      useClawHubStore.getState().clearSearch();

      expect(useClawHubStore.getState().searchQuery).toBe("");
      expect(useClawHubStore.getState().searchResults).toEqual([]);
      expect(useClawHubStore.getState().searchError).toBeNull();
    });
  });
});
