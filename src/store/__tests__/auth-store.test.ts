import { beforeEach, describe, expect, it } from "vitest";
import { loadStoredCredentials } from "@/gateway/auth-credentials";
import { useAuthStore } from "@/store/auth-store";

function resetStore() {
  useAuthStore.setState({
    gatewayUrl: "",
    token: "",
    password: "",
    rememberCredentials: true,
    authStatus: "unauthenticated",
    authError: null,
    defaults: { gatewayUrl: "", token: "" },
  });
}

describe("auth-store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("hydrates from defaults when no stored credentials exist", () => {
    useAuthStore.getState().hydrate({ gatewayUrl: "ws://default", token: "deftok" });
    const s = useAuthStore.getState();
    expect(s.authStatus).toBe("unauthenticated");
    expect(s.gatewayUrl).toBe("ws://default");
    expect(s.token).toBe("deftok");
  });

  it("hydrates into authenticating when stored credentials exist", () => {
    localStorage.setItem(
      "openclaw-office.auth.v1",
      JSON.stringify({ gatewayUrl: "ws://stored", token: "t", password: "p" }),
    );
    useAuthStore.getState().hydrate({ gatewayUrl: "ws://default", token: "" });
    const s = useAuthStore.getState();
    expect(s.authStatus).toBe("authenticating");
    expect(s.gatewayUrl).toBe("ws://stored");
    expect(s.password).toBe("p");
  });

  it("submitLogin persists credentials and moves to authenticating", () => {
    useAuthStore
      .getState()
      .submitLogin({ gatewayUrl: "ws://x", token: "tk", password: "pw" }, true);
    expect(useAuthStore.getState().authStatus).toBe("authenticating");
    expect(loadStoredCredentials()).toEqual({
      gatewayUrl: "ws://x",
      token: "tk",
      password: "pw",
    });
  });

  it("submitLogin without remember does not persist credentials", () => {
    useAuthStore
      .getState()
      .submitLogin({ gatewayUrl: "ws://x", token: "tk", password: "pw" }, false);
    expect(loadStoredCredentials()).toBeNull();
  });

  it("markAuthenticated transitions to authenticated", () => {
    useAuthStore.getState().submitLogin({ gatewayUrl: "ws://x", token: "", password: "" }, true);
    useAuthStore.getState().markAuthenticated();
    expect(useAuthStore.getState().authStatus).toBe("authenticated");
  });

  it("markAuthFailed returns to unauthenticated with redacted error", () => {
    useAuthStore.getState().markAuthFailed("token=secret unauthorized");
    const s = useAuthStore.getState();
    expect(s.authStatus).toBe("unauthenticated");
    expect(s.authError).toContain("[redacted]");
  });

  it("logout clears stored credentials and resets to defaults", () => {
    useAuthStore.getState().hydrate({ gatewayUrl: "ws://default", token: "deftok" });
    useAuthStore.getState().submitLogin({ gatewayUrl: "ws://x", token: "tk", password: "pw" }, true);
    useAuthStore.getState().markAuthenticated();
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.authStatus).toBe("unauthenticated");
    expect(s.gatewayUrl).toBe("ws://default");
    expect(s.password).toBe("");
    expect(loadStoredCredentials()).toBeNull();
  });
});
