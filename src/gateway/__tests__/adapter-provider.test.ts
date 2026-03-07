import { afterEach, describe, expect, it } from "vitest";
import {
  __resetAdapterForTests,
  initAdapter,
  waitForAdapter,
} from "../adapter-provider";

describe("adapter-provider", () => {
  afterEach(() => {
    __resetAdapterForTests();
  });

  it("rejects waiting console callers with the real init error", async () => {
    const waitingAdapter = waitForAdapter(5000);

    await expect(initAdapter("ws")).rejects.toThrow("WsAdapter requires wsClient and rpcClient");
    await expect(waitingAdapter).rejects.toThrow("WsAdapter requires wsClient and rpcClient");
  });

  it("can recover from a failed init attempt", async () => {
    await expect(initAdapter("ws")).rejects.toThrow("WsAdapter requires wsClient and rpcClient");

    const adapter = await initAdapter("mock");
    await expect(waitForAdapter()).resolves.toBe(adapter);
  });
});
