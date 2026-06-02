import { beforeEach, describe, expect, it } from "vitest";
import {
  classifyConnectError,
  clearStoredCredentials,
  loadStoredCredentials,
  redactAuthError,
  saveStoredCredentials,
} from "@/gateway/auth-credentials";

describe("auth-credentials storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips credentials through localStorage", () => {
    saveStoredCredentials({
      gatewayUrl: "ws://localhost:18789",
      token: "tok",
      password: "pw",
    });
    expect(loadStoredCredentials()).toEqual({
      gatewayUrl: "ws://localhost:18789",
      token: "tok",
      password: "pw",
    });
  });

  it("returns null when nothing is stored", () => {
    expect(loadStoredCredentials()).toBeNull();
  });

  it("clears stored credentials", () => {
    saveStoredCredentials({ gatewayUrl: "ws://x", token: "", password: "" });
    clearStoredCredentials();
    expect(loadStoredCredentials()).toBeNull();
  });

  it("ignores malformed stored payloads", () => {
    localStorage.setItem("openclaw-office.auth.v1", "{not json");
    expect(loadStoredCredentials()).toBeNull();
  });
});

describe("classifyConnectError", () => {
  it("treats auth error codes as auth failures", () => {
    expect(classifyConnectError("AUTH_UNAUTHORIZED")).toBe("auth");
    expect(classifyConnectError("auth_password_mismatch")).toBe("auth");
    expect(classifyConnectError("Connection unauthorized")).toBe("auth");
    expect(classifyConnectError("invalid token")).toBe("auth");
  });

  it("treats generic/transient errors as network", () => {
    expect(classifyConnectError("connection closed")).toBe("network");
    expect(classifyConnectError("protocol mismatch")).toBe("network");
    expect(classifyConnectError(null)).toBe("network");
    expect(classifyConnectError(undefined)).toBe("network");
  });
});

describe("redactAuthError", () => {
  it("redacts credential-looking substrings", () => {
    expect(redactAuthError("token=abc123 failed")).toContain("[redacted]");
    expect(redactAuthError('{"password":"hunter2"}')).toContain("[redacted]");
    expect(redactAuthError("Bearer abc.def.ghi")).toContain("Bearer [redacted]");
  });
});
