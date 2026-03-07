import { describe, expect, it, vi } from "vitest";
import { WsAdapter } from "../ws-adapter";

function createAdapter(requestImpl: (method: string, params?: unknown) => Promise<unknown>) {
  const wsClient = {
    onEvent: vi.fn(() => () => {}),
    getSnapshot: vi.fn(),
    getServerInfo: vi.fn(),
  } as any;

  const rpcClient = {
    request: vi.fn(requestImpl),
  } as any;

  return new WsAdapter(wsClient, rpcClient);
}

describe("WsAdapter config restart normalization", () => {
  it("normalizes config.apply restart payloads from the real gateway", async () => {
    const adapter = createAdapter(async () => ({
      ok: true,
      path: "~/.openclaw/openclaw.json",
      config: {},
      restart: {
        ok: true,
        delayMs: 2000,
        coalesced: false,
      },
    }));

    const result = await adapter.configApply("{}", "hash");

    expect(result.restart).toEqual({
      scheduled: true,
      delayMs: 2000,
      coalesced: false,
    });
  });

  it("normalizes update.run restart payloads from the real gateway", async () => {
    const adapter = createAdapter(async () => ({
      ok: true,
      result: {
        status: "updated",
        mode: "npm",
        reason: "done",
        steps: [],
        durationMs: 123,
      },
      restart: {
        ok: true,
        delayMs: 1500,
      },
    }));

    const result = await adapter.updateRun();

    expect(result.restart).toEqual({
      scheduled: true,
      delayMs: 1500,
    });
  });
});
