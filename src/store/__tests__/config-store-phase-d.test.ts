import { describe, it, expect, beforeEach } from "vitest";
import { initAdapter } from "@/gateway/adapter-provider";
import { useConfigStore } from "../console-stores/config-store";

describe("Config Store - Phase D", () => {
  beforeEach(async () => {
    await initAdapter("mock");
    useConfigStore.setState({
      config: null,
      hash: null,
      configPath: null,
      configRaw: null,
      configValid: true,
      loading: false,
      error: null,
      schemaHints: null,
      status: null,
      statusLoading: false,
      statusError: null,
      updateResult: null,
      updateLoading: false,
    });
  });

  it("fetchConfig loads config + hash", async () => {
    await useConfigStore.getState().fetchConfig();
    const state = useConfigStore.getState();
    expect(state.config).toBeTruthy();
    expect(state.hash).toBeTruthy();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.configPath).toBe("~/.openclaw/openclaw.json");
  });

  it("fetchConfig populates models.providers", async () => {
    await useConfigStore.getState().fetchConfig();
    const { config } = useConfigStore.getState();
    const providers = (config?.models as Record<string, unknown>)?.providers as Record<
      string,
      unknown
    >;
    expect(providers).toBeTruthy();
    expect(providers.anthropic).toBeTruthy();
    expect(providers.openai).toBeTruthy();
  });

  it("patchConfig adds a provider and refreshes hash", async () => {
    await useConfigStore.getState().fetchConfig();
    const oldHash = useConfigStore.getState().hash;

    const result = await useConfigStore.getState().patchConfig({
      models: {
        providers: {
          "my-ollama": { baseUrl: "http://localhost:11434", api: "openai-completions", models: [] },
        },
      },
    });
    expect(result.ok).toBe(true);

    const state = useConfigStore.getState();
    expect(state.hash).not.toBe(oldHash);
    const providers = (state.config?.models as Record<string, unknown>)?.providers as Record<
      string,
      unknown
    >;
    expect(providers["my-ollama"]).toBeTruthy();
  });

  it("patchConfig deletes a provider with null", async () => {
    await useConfigStore.getState().fetchConfig();
    await useConfigStore.getState().patchConfig({
      models: { providers: { openai: null } },
    });

    const { config } = useConfigStore.getState();
    const providers = (config?.models as Record<string, unknown>)?.providers as Record<
      string,
      unknown
    >;
    expect(providers.openai).toBeUndefined();
    expect(providers.anthropic).toBeTruthy();
  });

  it("fetchStatus loads gateway status", async () => {
    await useConfigStore.getState().fetchStatus();
    const { status, statusLoading } = useConfigStore.getState();
    expect(status).toBeTruthy();
    expect(status?.version).toBeTruthy();
    expect(status?.port).toBe(18789);
    expect(statusLoading).toBe(false);
  });

  it("runUpdate returns result", async () => {
    const result = await useConfigStore.getState().runUpdate();
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("noop");
    expect(useConfigStore.getState().updateLoading).toBe(false);
  });
});
