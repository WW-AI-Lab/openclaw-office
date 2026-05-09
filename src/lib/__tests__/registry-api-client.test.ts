import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  channels,
  DEFAULT_REGISTRY_API_URL,
  notify,
  openhands,
  pairing,
  resolveRegistryApiConfig,
} from "@/lib/registry-api-client";

const originalFetch = global.fetch;

function setRuntimeUrl(url: string | undefined): void {
  const win = window as unknown as Record<string, unknown>;
  if (url === undefined) {
    delete win.__OPENCLAW_CONFIG__;
    return;
  }
  win.__OPENCLAW_CONFIG__ = { registryApiUrl: url };
}

describe("registry-api-client", () => {
  beforeEach(() => {
    setRuntimeUrl(undefined);
  });

  afterEach(() => {
    setRuntimeUrl(undefined);
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("falls back to the Tailscale HQ default when nothing is configured", () => {
    setRuntimeUrl(undefined);
    const cfg = resolveRegistryApiConfig();
    expect(cfg.baseUrl).toBe(DEFAULT_REGISTRY_API_URL);
    expect(cfg.baseUrl).toBe("http://openclaw-hq:8781");
    expect(cfg.configured).toBe(true);
  });

  it("resolves config from runtime injection and trims trailing slash", () => {
    setRuntimeUrl("http://openclaw-hq:8781/");
    const cfg = resolveRegistryApiConfig();
    expect(cfg.baseUrl).toBe("http://openclaw-hq:8781");
    expect(cfg.configured).toBe(true);
  });

  it("issues GET WITHOUT an Authorization header for pairing.list", async () => {
    setRuntimeUrl("http://openclaw-hq:8781");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: 1, branch_id: "miami" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const items = await pairing.list("pending");
    expect(items).toEqual([{ id: 1, branch_id: "miami" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe("http://openclaw-hq:8781/v1/pairing/requests?status_filter=pending");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers).toMatchObject({ Accept: "application/json" });
    // VPN is the trust boundary — no bearer token in browser bundle.
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("posts JSON body for channels.create without an Authorization header", async () => {
    setRuntimeUrl("http://openclaw-hq:8781");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 7, kind: "telegram", name: "Admin Bot" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const created = await channels.create({
      kind: "telegram",
      name: "Admin Bot",
      config: { chat_id: "-1001" },
      scope: "admin",
    });
    expect(created.id).toBe(7);
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      kind: "telegram",
      name: "Admin Bot",
      config: { chat_id: "-1001" },
      scope: "admin",
    });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("posts to /v1/notify for notify.broadcast", async () => {
    setRuntimeUrl("http://openclaw-hq:8781");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, delivered: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await notify.broadcast({ scope: "admin", text: "hello" });
    expect(result).toEqual({ ok: true, delivered: 3 });
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe("http://openclaw-hq:8781/v1/notify");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ scope: "admin", text: "hello" });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("rejects with RegistryApiError on non-2xx with detail", async () => {
    setRuntimeUrl("http://openclaw-hq:8781");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "nope" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(pairing.approve(1, { decided_by: "x" })).rejects.toMatchObject({
      name: "RegistryApiError",
      status: 403,
      message: "nope",
    });
  });
});

describe("envelope extraction (sidecar shape)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_REGISTRY_API_URL", "http://openclaw-hq:8781");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("pairing.list extracts requests[] from {requests: [...]} envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ requests: [{ id: 2, branch_id: "miami", status: "pending" }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    )));
    const { pairing: pairingApi } = await import("../registry-api-client");
    const items = await pairingApi.list("pending");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(2);
  });

  it("channels.list extracts channels[] from {channels: [...]} envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ channels: [{ id: 1, kind: "telegram", name: "Bot" }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    )));
    const { channels: channelsApi } = await import("../registry-api-client");
    const items = await channelsApi.list();
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("telegram");
  });

  it("openhands.profiles.list extracts profiles[] from {profiles: [...]} envelope and hits /v1/openhands/profiles", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          profiles: [
            {
              id: 7,
              provider: "anthropic",
              model: "claude-sonnet-4-5",
              label: "Sonnet primary",
              is_default: true,
              has_secret: true,
              last_test_at: null,
              last_test_result: null,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { openhands: openhandsApi } = await import("../registry-api-client");
    const items = await openhandsApi.profiles.list();
    expect(items).toHaveLength(1);
    expect(items[0]?.provider).toBe("anthropic");
    expect(items[0]?.is_default).toBe(true);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe("http://openclaw-hq:8781/v1/openhands/profiles");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    // Trust boundary is the VPN — no Authorization header.
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
  });
});

describe("openhands client", () => {
  beforeEach(() => {
    setRuntimeUrl("http://openclaw-hq:8781");
  });
  afterEach(() => {
    setRuntimeUrl(undefined);
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts to /v1/openhands/profiles/{id}/activate without an Authorization header", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 3, provider: "openai", is_default: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await openhands.profiles.activate(3);
    expect((result as { is_default?: boolean }).is_default).toBe(true);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe("http://openclaw-hq:8781/v1/openhands/profiles/3/activate");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("posts JSON body for openhands.profiles.create", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 11,
            provider: "deepseek",
            model: "deepseek-chat",
            label: "DS",
            is_default: false,
            has_secret: false,
            last_test_at: null,
            last_test_result: null,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const created = await openhands.profiles.create({
      provider: "deepseek",
      model: "deepseek-chat",
      label: "DS",
    });
    expect(created.id).toBe(11);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe("http://openclaw-hq:8781/v1/openhands/profiles");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ provider: "deepseek", model: "deepseek-chat", label: "DS" });
  });
});
