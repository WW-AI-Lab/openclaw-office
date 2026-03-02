import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockAdapter } from "../mock-adapter";
import { WsAdapter } from "../ws-adapter";

describe("MockAdapter Phase C", () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  afterEach(() => {
    adapter.disconnect();
  });

  describe("channelsStatus extended fields", () => {
    it("returns channels with Phase C fields", async () => {
      const channels = await adapter.channelsStatus();
      expect(channels.length).toBeGreaterThanOrEqual(4);

      const hasError = channels.some((c) => c.status === "error");
      expect(hasError).toBe(true);

      for (const ch of channels) {
        expect(ch).toHaveProperty("configured");
        expect(ch.id).toContain(":");
      }
    });
  });

  describe("skillsStatus extended fields", () => {
    it("returns at least 6 skills with new fields", async () => {
      const skills = await adapter.skillsStatus();
      expect(skills.length).toBeGreaterThanOrEqual(6);

      const coreSkills = skills.filter((s) => s.isCore && s.isBundled);
      expect(coreSkills.length).toBeGreaterThanOrEqual(3);

      const marketplaceSkills = skills.filter((s) => s.source === "marketplace");
      expect(marketplaceSkills.length).toBeGreaterThanOrEqual(2);

      const disabled = skills.filter((s) => !s.enabled);
      expect(disabled.length).toBeGreaterThanOrEqual(1);
    });

    it("core skills have always=true", async () => {
      const skills = await adapter.skillsStatus();
      const core = skills.filter((s) => s.isCore);
      for (const s of core) {
        expect(s.always).toBe(true);
      }
    });
  });

  describe("cronList aligned structure", () => {
    it("returns at least 3 tasks with CronJobState", async () => {
      const tasks = await adapter.cronList();
      expect(tasks.length).toBeGreaterThanOrEqual(3);

      for (const t of tasks) {
        expect(t).toHaveProperty("state");
        expect(t).toHaveProperty("payload");
        expect(t).toHaveProperty("sessionTarget");
        expect(t).toHaveProperty("wakeMode");
        expect(typeof t.schedule).toBe("object");
        expect(t.schedule).toHaveProperty("kind");
      }

      const errorTask = tasks.find((t) => t.state.lastRunStatus === "error");
      expect(errorTask).toBeDefined();
      expect(errorTask!.state.lastError).toBeDefined();
    });
  });

  describe("usageStatus aligned structure", () => {
    it("returns providers array", async () => {
      const usage = await adapter.usageStatus();
      expect(usage).toHaveProperty("updatedAt");
      expect(usage.providers.length).toBeGreaterThanOrEqual(2);

      for (const p of usage.providers) {
        expect(p).toHaveProperty("provider");
        expect(p).toHaveProperty("displayName");
        expect(Array.isArray(p.windows)).toBe(true);
      }
    });
  });

  describe("new channel management methods", () => {
    it("channelsLogout returns cleared", async () => {
      const result = await adapter.channelsLogout("telegram", "bot1");
      expect(result.cleared).toBe(true);
    });

    it("webLoginStart returns QR data", async () => {
      const result = await adapter.webLoginStart();
      expect(result.qrDataUrl).toContain("data:image");
      expect(result.message).toBeDefined();
    });

    it("webLoginWait returns connected", async () => {
      const result = await adapter.webLoginWait();
      expect(result.connected).toBe(true);
    });
  });

  describe("new skill management methods", () => {
    it("skillsInstall returns ok", async () => {
      const result = await adapter.skillsInstall("image-gen", "node");
      expect(result.ok).toBe(true);
      expect(result.message).toBeDefined();
    });

    it("skillsUpdate returns ok", async () => {
      const result = await adapter.skillsUpdate("web-search", { enabled: false });
      expect(result.ok).toBe(true);
    });
  });
});

describe("WsAdapter Phase C mapping", () => {
  it("treats running+linked+configured account without connected flag as connected", async () => {
    const rpcClient = {
      request: async (method: string) => {
        if (method === "channels.status") {
          return {
            channelAccounts: {
              feishu: [
                {
                  accountId: "main",
                  name: "Feishu",
                  configured: true,
                  linked: true,
                  running: true,
                },
              ],
            },
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    };

    const wsClient = {
      onEvent: () => () => undefined,
    };

    const adapter = new WsAdapter(wsClient as never, rpcClient as never);

    const channels = await adapter.channelsStatus();
    expect(channels).toHaveLength(1);
    expect(channels[0]?.status).toBe("connected");
  });

  it("maps lastError to error status", async () => {
    const rpcClient = {
      request: async (method: string) => {
        if (method === "channels.status") {
          return {
            channelAccounts: {
              whatsapp: [
                {
                  accountId: "wa1",
                  name: "WhatsApp",
                  configured: true,
                  linked: true,
                  running: true,
                  lastError: "socket closed",
                },
              ],
            },
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    };

    const wsClient = {
      onEvent: () => () => undefined,
    };

    const adapter = new WsAdapter(wsClient as never, rpcClient as never);

    const channels = await adapter.channelsStatus();
    expect(channels).toHaveLength(1);
    expect(channels[0]?.status).toBe("error");
    expect(channels[0]?.error).toBe("socket closed");
  });

  it("wraps cron.update patch under the patch field", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpcClient = {
      request: async (method: string, params: unknown) => {
        calls.push({ method, params });
        return {
          id: "job-1",
          name: "Updated",
          enabled: true,
          createdAtMs: 0,
          updatedAtMs: 0,
          schedule: { kind: "cron", expr: "*/30 * * * *" },
          sessionTarget: "isolated",
          wakeMode: "now",
          payload: { kind: "agentTurn", message: "hello" },
          state: {},
        };
      },
    };

    const wsClient = {
      onEvent: () => () => undefined,
    };

    const adapter = new WsAdapter(wsClient as never, rpcClient as never);
    await adapter.cronUpdate("job-1", { name: "Updated" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      method: "cron.update",
      params: { id: "job-1", patch: { name: "Updated" } },
    });
  });
});
