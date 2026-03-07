import { describe, it, expect, beforeEach } from "vitest";
import { useConfigStore } from "../console-stores/config-store";

beforeEach(() => {
  useConfigStore.setState({ restartState: null, lifecycleState: null });
});

describe("config-store restart tracking", () => {
  it("sets pending restart state", () => {
    useConfigStore.getState().setRestartPending(3000);

    const state = useConfigStore.getState().restartState;
    expect(state).not.toBeNull();
    expect(state?.status).toBe("pending");
    expect(state?.estimatedDelayMs).toBe(3000);
    expect(state?.startedAt).toBeGreaterThan(0);
  });

  it("transitions to reconnecting", () => {
    useConfigStore.getState().setRestartPending(3000);
    useConfigStore.getState().setRestartReconnecting();

    expect(useConfigStore.getState().restartState?.status).toBe("reconnecting");
  });

  it("transitions to complete", () => {
    useConfigStore.getState().setRestartPending(3000);
    useConfigStore.getState().setRestartComplete();

    expect(useConfigStore.getState().restartState?.status).toBe("complete");
  });

  it("clears restart state", () => {
    useConfigStore.getState().setRestartPending(3000);
    useConfigStore.getState().clearRestart();

    expect(useConfigStore.getState().restartState).toBeNull();
  });

  it("does not transition without existing state", () => {
    useConfigStore.getState().setRestartReconnecting();
    expect(useConfigStore.getState().restartState).toBeNull();

    useConfigStore.getState().setRestartComplete();
    expect(useConfigStore.getState().restartState).toBeNull();
  });
});

describe("config-store lifecycle tracking", () => {
  it("tracks save results without restart as hot reload", () => {
    useConfigStore.getState().setLifecycleFromWriteResult(
      { ok: true, config: {} },
      "save",
    );

    expect(useConfigStore.getState().lifecycleState?.status).toBe("saved-hot-reload");
  });

  it("tracks apply results with restart", () => {
    useConfigStore.getState().setLifecycleFromWriteResult(
      { ok: true, config: {}, restart: { scheduled: true, delayMs: 1500 } },
      "apply",
    );

    expect(useConfigStore.getState().lifecycleState?.status).toBe("apply-restarting");
    expect(useConfigStore.getState().restartState?.status).toBe("pending");
  });

  it("tracks cli fallback guidance", () => {
    useConfigStore.getState().setLifecycleFromWriteResult(
      { ok: true, config: {} },
      "save",
      "openclaw gateway restart",
    );

    const lifecycle = useConfigStore.getState().lifecycleState;
    expect(lifecycle?.status).toBe("saved-cli-restart-required");
    expect(lifecycle?.command).toBe("openclaw gateway restart");
  });

  it("tracks runtime-applied status", () => {
    useConfigStore.getState().setRuntimeApplied("agents.model.applied");

    expect(useConfigStore.getState().lifecycleState?.status).toBe("effective-now");
  });
});
