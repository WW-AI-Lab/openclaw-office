import { create } from "zustand";
import { waitForAdapter } from "@/gateway/adapter-provider";
import type { ChannelInfo, SkillInfo, UsageInfo } from "@/gateway/adapter-types";

interface DashboardState {
  channelsSummary: ChannelInfo[];
  skillsSummary: SkillInfo[];
  usage: UsageInfo | null;
  uptime: number;
  isLoading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  channelsSummary: [],
  skillsSummary: [],
  usage: null,
  uptime: 0,
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const adapter = await waitForAdapter();
      const results = await Promise.allSettled([
        adapter.channelsStatus(),
        adapter.skillsStatus(),
        adapter.usageStatus(),
      ]);

      const channels = results[0].status === "fulfilled" ? results[0].value : [];
      const skills = results[1].status === "fulfilled" ? results[1].value : [];
      const usage = results[2].status === "fulfilled" ? results[2].value : null;

      const errors: string[] = [];
      if (results[0].status === "rejected") errors.push(`channels: ${results[0].reason}`);
      if (results[1].status === "rejected") errors.push(`skills: ${results[1].reason}`);
      if (results[2].status === "rejected") errors.push(`usage: ${results[2].reason}`);

      set({
        channelsSummary: channels,
        skillsSummary: skills,
        usage,
        isLoading: false,
        error: errors.length > 0 ? errors.join("; ") : null,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },
}));
