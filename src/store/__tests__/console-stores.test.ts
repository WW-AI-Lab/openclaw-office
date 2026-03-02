import { describe, it, expect } from "vitest";
import { useChannelsStore } from "../console-stores/channels-store";
import { useChatDockStore } from "../console-stores/chat-dock-store";
import { useCronStore } from "../console-stores/cron-store";
import { useDashboardStore } from "../console-stores/dashboard-store";
import { useConsoleSettingsStore } from "../console-stores/settings-store";
import { useSkillsStore } from "../console-stores/skills-store";

describe("Dashboard Store", () => {
  it("has correct initial state", () => {
    const state = useDashboardStore.getState();
    expect(state.channelsSummary).toEqual([]);
    expect(state.skillsSummary).toEqual([]);
    expect(state.uptime).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(typeof state.refresh).toBe("function");
  });
});

describe("Channels Store", () => {
  it("has correct initial state", () => {
    const state = useChannelsStore.getState();
    expect(state.channels).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(typeof state.fetchChannels).toBe("function");
  });
});

describe("Skills Store", () => {
  it("has correct initial state", () => {
    const state = useSkillsStore.getState();
    expect(state.skills).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(typeof state.fetchSkills).toBe("function");
  });
});

describe("Cron Store", () => {
  it("has correct initial state", () => {
    const state = useCronStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(typeof state.fetchTasks).toBe("function");
    expect(typeof state.addTask).toBe("function");
    expect(typeof state.updateTask).toBe("function");
    expect(typeof state.removeTask).toBe("function");
    expect(typeof state.runTask).toBe("function");
  });
});

describe("Settings Store", () => {
  it("has correct initial state", () => {
    const state = useConsoleSettingsStore.getState();
    expect(["light", "dark", "system"]).toContain(state.theme);
    expect(typeof state.language).toBe("string");
    expect(typeof state.setTheme).toBe("function");
    expect(typeof state.setLanguage).toBe("function");
  });

  it("updates theme", () => {
    useConsoleSettingsStore.getState().setTheme("dark");
    expect(useConsoleSettingsStore.getState().theme).toBe("dark");
    useConsoleSettingsStore.getState().setTheme("system");
    expect(useConsoleSettingsStore.getState().theme).toBe("system");
  });
});

describe("Chat Dock Store", () => {
  it("has correct initial state", () => {
    const state = useChatDockStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
    expect(state.currentSessionKey).toBe("agent:main:main");
    expect(state.dockExpanded).toBe(false);
    expect(typeof state.sendMessage).toBe("function");
    expect(typeof state.abort).toBe("function");
    expect(typeof state.toggleDock).toBe("function");
    expect(typeof state.switchSession).toBe("function");
  });

  it("toggleDock flips dockExpanded", () => {
    expect(useChatDockStore.getState().dockExpanded).toBe(false);
    useChatDockStore.getState().toggleDock();
    expect(useChatDockStore.getState().dockExpanded).toBe(true);
    useChatDockStore.getState().toggleDock();
    expect(useChatDockStore.getState().dockExpanded).toBe(false);
  });

  it("switchSession updates currentSessionKey and clears messages", () => {
    useChatDockStore.getState().switchSession("test-session");
    const state = useChatDockStore.getState();
    expect(state.currentSessionKey).toBe("test-session");
    expect(state.messages).toEqual([]);
  });
});
