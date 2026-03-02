import { describe, it, expect, beforeEach } from "vitest";
import { useConfigStore } from "../console-stores/config-store";

beforeEach(() => {
  useConfigStore.setState({ restartState: null });
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
