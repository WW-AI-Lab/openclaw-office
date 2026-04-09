import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchProjectionBootstrap,
  isOperatorBootstrapConfigured,
  validatePacket,
} from "@/gateway/projection-bootstrap-fetcher";

const VALID_PACKET = {
  schemaVersion: "openclaw-office-projection-packet.v0",
  generatedAt: "2026-03-27T00:00:00Z",
  officeProjection: {
    scene: {
      agents: [],
      links: [],
    },
    eventHistory: [],
    panelData: {},
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("projection-bootstrap-fetcher", () => {
  it("returns null when operator bootstrap is not configured", async () => {
    expect(isOperatorBootstrapConfigured()).toBe(false);
    await expect(fetchProjectionBootstrap()).resolves.toBeNull();
  });

  it("fetches and validates a bootstrap packet from URL", async () => {
    vi.stubEnv("VITE_PROJECTION_BOOTSTRAP_URL", "/bootstrap/projection-packet.json");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_PACKET,
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(isOperatorBootstrapConfigured()).toBe(true);
    await expect(fetchProjectionBootstrap()).resolves.toEqual(VALID_PACKET);
    expect(fetchMock).toHaveBeenCalledWith(
      "/bootstrap/projection-packet.json",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects invalid packets", () => {
    expect(() => validatePacket({ generatedAt: "2026-03-27T00:00:00Z" })).toThrow(
      /schemaVersion/,
    );
  });
});
