import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupGcpPage } from "./SetupGcpPage";

function setRuntimeUrl(url?: string): void {
  const win = window as unknown as Record<string, unknown>;
  if (url === undefined) {
    delete win.__OPENCLAW_CONFIG__;
    return;
  }
  win.__OPENCLAW_CONFIG__ = { registryApiUrl: url };
}

const originalFetch = global.fetch;

describe("SetupGcpPage", () => {
  beforeEach(() => {
    setRuntimeUrl(undefined);
    // Stub fetch so the auto-loaded pairing/channels lists don't hit the network.
    global.fetch = vi.fn(
      async () =>
        new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    setRuntimeUrl(undefined);
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders without crashing and shows the secrets notice", async () => {
    await act(async () => {
      render(<SetupGcpPage />);
    });
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/Secret Manager/i).length).toBeGreaterThan(0);
  });

  it("shows the default Tailscale HQ base URL when no override is configured", async () => {
    await act(async () => {
      render(<SetupGcpPage />);
    });
    // Default base URL is http://openclaw-hq:8781 (Tailscale hostname for HQ).
    expect(screen.getByText(/openclaw-hq:8781/)).toBeInTheDocument();
  });

  it("does not white-screen when the sidecar fetch rejects with a network error", async () => {
    // Simulate the off-tailnet case the user reported: DNS for openclaw-hq
    // fails, so fetch() rejects with a TypeError. Before the fix, this took
    // out the entire React tree and the browser tab went blank.
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<SetupGcpPage />);
    });

    // Page chrome stays mounted.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    // And the failure surfaces as a friendly retry-able error panel, not a crash.
    await waitFor(() => {
      expect(screen.getByText(/cannot reach sidecar/i)).toBeInTheDocument();
    });
  });

  it("does not crash when the sidecar returns a non-array payload", async () => {
    // Some upstreams have been observed to return `{detail: "..."}` envelopes
    // on partial outages. items.map(...) used to throw and unmount the tree.
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "service unavailable" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await act(async () => {
      render(<SetupGcpPage />);
    });

    // Should render the empty state (coerced to []) rather than throwing.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    await waitFor(() => {
      // EmptyState title for pairing tab — match either default zh or en text.
      const empty = screen.queryByText(/No requests in this state/i)
        ?? screen.queryByText(/当前没有该状态的请求/);
      expect(empty).not.toBeNull();
    });
  });
});
