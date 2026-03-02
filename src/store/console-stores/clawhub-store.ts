import { create } from "zustand";
import type {
  ClawHubSearchResult,
  ClawHubSkillListItem,
  ClawHubSkillDetail,
} from "@/gateway/clawhub-client";
import {
  clawhubSearch,
  clawhubExplore,
  clawhubSkillDetail,
  ClawHubError,
} from "@/gateway/clawhub-client";

interface ClawHubStoreState {
  searchResults: ClawHubSearchResult[];
  exploreItems: ClawHubSkillListItem[];
  searchQuery: string;
  isSearching: boolean;
  isExploring: boolean;
  searchError: string | null;
  exploreError: string | null;
  nextCursor: string | null;
  selectedDetail: ClawHubSkillDetail | null;
  detailLoading: boolean;
  offlineMode: boolean;

  search: (query: string) => Promise<void>;
  searchImmediate: (query: string) => Promise<void>;
  explore: (loadMore?: boolean) => Promise<void>;
  fetchDetail: (slug: string) => Promise<void>;
  clearSearch: () => void;
  clearDetail: () => void;
  setOfflineMode: (offline: boolean) => void;
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;

export const useClawHubStore = create<ClawHubStoreState>((set, get) => ({
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

  search: async (query: string) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [], searchError: null });
      return;
    }

    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      get().searchImmediate(query);
    }, 300);
  },

  searchImmediate: async (query: string) => {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    const trimmed = query.trim();
    if (!trimmed) return;

    set({ isSearching: true, searchError: null, searchQuery: trimmed });
    try {
      const results = await clawhubSearch(trimmed, 30);
      set({ searchResults: results, isSearching: false, offlineMode: false });
    } catch (err) {
      const message = err instanceof ClawHubError ? err.message : String(err);
      const isNetworkError = err instanceof ClawHubError && err.code === 0;
      set({
        searchError: message,
        isSearching: false,
        offlineMode: isNetworkError,
      });
    }
  },

  explore: async (loadMore = false) => {
    const state = get();
    if (state.isExploring) return;
    if (loadMore && !state.nextCursor) return;

    set({ isExploring: true, exploreError: null });
    try {
      const cursor = loadMore ? (state.nextCursor ?? undefined) : undefined;
      const result = await clawhubExplore({ limit: 20, cursor });
      set((s) => ({
        exploreItems: loadMore ? [...s.exploreItems, ...result.items] : result.items,
        nextCursor: result.nextCursor,
        isExploring: false,
        offlineMode: false,
      }));
    } catch (err) {
      const message = err instanceof ClawHubError ? err.message : String(err);
      const isNetworkError = err instanceof ClawHubError && err.code === 0;
      set({
        exploreError: message,
        isExploring: false,
        offlineMode: isNetworkError,
      });
    }
  },

  fetchDetail: async (slug: string) => {
    set({ detailLoading: true });
    try {
      const detail = await clawhubSkillDetail(slug);
      set({ selectedDetail: detail, detailLoading: false });
    } catch {
      set({ detailLoading: false });
    }
  },

  clearSearch: () => {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    set({ searchQuery: "", searchResults: [], searchError: null });
  },

  clearDetail: () => set({ selectedDetail: null }),

  setOfflineMode: (offline) => set({ offlineMode: offline }),
}));
