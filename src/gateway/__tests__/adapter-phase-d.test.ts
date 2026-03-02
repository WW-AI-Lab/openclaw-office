import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockAdapter } from "../mock-adapter";

describe("MockAdapter Phase D — config / status / update", () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  afterEach(() => {
    adapter.disconnect();
  });

  describe("configGet", () => {
    it("returns valid config snapshot with hash", async () => {
      const snap = await adapter.configGet();
      expect(snap.valid).toBe(true);
      expect(snap.hash).toBeTruthy();
      expect(snap.config).toBeTruthy();
      expect(snap.path).toBe("~/.openclaw/openclaw.json");
    });

    it("config contains models.providers with redacted keys", async () => {
      const snap = await adapter.configGet();
      const providers = (snap.config.models as Record<string, unknown>)?.providers as
        | Record<string, Record<string, unknown>>
        | undefined;
      expect(providers).toBeTruthy();
      expect(providers!.anthropic).toBeTruthy();
      expect(providers!.anthropic.apiKey).toBe("__OPENCLAW_REDACTED__");
      expect(providers!.openai).toBeTruthy();
      expect(providers!.openai.apiKey).toBe("__OPENCLAW_REDACTED__");
    });
  });

  describe("configPatch", () => {
    it("merges patch into config", async () => {
      const snap = await adapter.configGet();
      const result = await adapter.configPatch(
        JSON.stringify({
          models: {
            providers: {
              ollama: { baseUrl: "http://localhost:11434", api: "openai-completions", models: [] },
            },
          },
        }),
        snap.hash,
      );
      expect(result.ok).toBe(true);

      const updated = await adapter.configGet();
      const providers = (updated.config.models as Record<string, unknown>).providers as Record<
        string,
        Record<string, unknown>
      >;
      expect(providers.ollama).toBeTruthy();
      expect(providers.ollama.baseUrl).toBe("http://localhost:11434");
      expect(providers.anthropic).toBeTruthy();
    });

    it("deletes provider with null (merge-patch semantics)", async () => {
      const snap = await adapter.configGet();
      const result = await adapter.configPatch(
        JSON.stringify({ models: { providers: { openai: null } } }),
        snap.hash,
      );
      expect(result.ok).toBe(true);

      const updated = await adapter.configGet();
      const providers = (updated.config.models as Record<string, unknown>).providers as Record<
        string,
        Record<string, unknown>
      >;
      expect(providers.openai).toBeUndefined();
      expect(providers.anthropic).toBeTruthy();
    });

    it("fails when baseHash mismatches", async () => {
      const result = await adapter.configPatch(
        JSON.stringify({ models: { providers: { test: { baseUrl: "http://x" } } } }),
        "wrong-hash",
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("config changed");
    });

    it("reports scheduled restart on success", async () => {
      const snap = await adapter.configGet();
      const result = await adapter.configPatch(
        JSON.stringify({ update: { channel: "beta" } }),
        snap.hash,
      );
      expect(result.ok).toBe(true);
      expect(result.restart?.scheduled).toBe(true);
    });
  });

  describe("configSchema", () => {
    it("returns schema with uiHints", async () => {
      const schema = await adapter.configSchema();
      expect(schema.uiHints).toBeTruthy();
      expect(schema.version).toBeTruthy();
    });
  });

  describe("statusSummary", () => {
    it("returns gateway status info", async () => {
      const status = await adapter.statusSummary();
      expect(status.version).toBeTruthy();
      expect(status.port).toBe(18789);
      expect(typeof status.uptime).toBe("number");
      expect(status.platform).toBeTruthy();
    });
  });

  describe("updateRun", () => {
    it("returns update result", async () => {
      const result = await adapter.updateRun();
      expect(result.ok).toBe(true);
      expect(result.result.status).toBe("noop");
    });
  });
});
