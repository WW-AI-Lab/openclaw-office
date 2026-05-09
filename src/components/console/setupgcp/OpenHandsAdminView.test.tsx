import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenHandsAdminView } from "./OpenHandsAdminView";
import { useSetupGcpStore } from "@/store/console-stores/setupgcp-store";

function setRuntimeUrl(url?: string): void {
  const win = window as unknown as Record<string, unknown>;
  if (url === undefined) {
    delete win.__OPENCLAW_CONFIG__;
    return;
  }
  win.__OPENCLAW_CONFIG__ = { registryApiUrl: url };
}

const originalFetch = global.fetch;

function resetStore(): void {
  // Reset the slice we touch so each test starts deterministic.
  useSetupGcpStore.setState({
    openhandsProfiles: [],
    openhandsLoading: false,
    openhandsError: null,
    openhandsActionInFlight: {},
    lastOpenHandsTest: {},
  });
}

describe("OpenHandsAdminView", () => {
  beforeEach(() => {
    setRuntimeUrl("http://openclaw-hq:8781");
    useSetupGcpStore.getState().refreshConfig();
    resetStore();
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ profiles: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    setRuntimeUrl(undefined);
    global.fetch = originalFetch;
    resetStore();
    vi.restoreAllMocks();
  });

  it("renders the empty state when there are no profiles", async () => {
    await act(async () => {
      render(<OpenHandsAdminView />);
    });
    await waitFor(() => {
      // Test setup defaults to zh; tolerate either locale for resilience.
      const empty =
        screen.queryByText(/No profiles configured/i) ?? screen.queryByText(/尚未配置任何 LLM 配置/);
      expect(empty).not.toBeNull();
    });
    // Banner copy is always shown.
    const banner =
      screen.queryByText(/Active profile drives OpenHands/i) ??
      screen.queryByText(/默认配置驱动 OpenHands/);
    expect(banner).not.toBeNull();
  });

  it("renders profile cards with provider/model/secret/default markers", async () => {
    // Avoid the auto-fetch on mount wiping our prefilled state.
    useSetupGcpStore.setState({
      fetchOpenHandsProfiles: vi.fn().mockResolvedValue(undefined),
      openhandsProfiles: [
        {
          id: 1,
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          label: "Sonnet primary",
          is_default: true,
          has_secret: true,
          last_test_at: null,
          last_test_result: null,
        },
        {
          id: 2,
          provider: "openai",
          model: "gpt-4o",
          label: "OpenAI fallback",
          is_default: false,
          has_secret: false,
          last_test_at: null,
          last_test_result: null,
        },
      ],
    });

    await act(async () => {
      render(<OpenHandsAdminView />);
    });

    expect(screen.getByText("Sonnet primary")).toBeInTheDocument();
    expect(screen.getByText("OpenAI fallback")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-5")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    // Default badge appears (zh: 默认 / en: default)
    const defaultBadge =
      screen.queryAllByText(/^default$/i).length > 0
        ? screen.queryAllByText(/^default$/i)
        : screen.queryAllByText(/^默认$/);
    expect(defaultBadge.length).toBeGreaterThanOrEqual(1);
    // Secret-set vs no-secret markers
    const secretSet =
      screen.queryByText(/Secret set/i) ?? screen.queryByText(/已设置凭据/);
    expect(secretSet).not.toBeNull();
    const noSecret = screen.queryByText(/No secret/i) ?? screen.queryByText(/未设置凭据/);
    expect(noSecret).not.toBeNull();
  });

  it("invokes Activate via the store when the Activate button is clicked", async () => {
    const activateSpy = vi.fn().mockResolvedValue(undefined);
    useSetupGcpStore.setState({
      fetchOpenHandsProfiles: vi.fn().mockResolvedValue(undefined),
      activateProfile: activateSpy,
      openhandsProfiles: [
        {
          id: 42,
          provider: "openai",
          model: "gpt-4o",
          label: "Fallback",
          is_default: false,
          has_secret: true,
          last_test_at: null,
          last_test_result: null,
        },
      ],
    });

    await act(async () => {
      render(<OpenHandsAdminView />);
    });

    const activateBtn = screen.getByRole("button", { name: /Activate|激活/ });
    await act(async () => {
      fireEvent.click(activateBtn);
    });
    expect(activateSpy).toHaveBeenCalledWith(42);
  });

  it("invokes Test via the store when the inline Run test button is clicked", async () => {
    const testSpy = vi.fn().mockResolvedValue({ ok: true });
    useSetupGcpStore.setState({
      fetchOpenHandsProfiles: vi.fn().mockResolvedValue(undefined),
      testProfile: testSpy,
      openhandsProfiles: [
        {
          id: 9,
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          label: "Primary",
          is_default: true,
          has_secret: true,
          last_test_at: null,
          last_test_result: null,
        },
      ],
    });

    await act(async () => {
      render(<OpenHandsAdminView />);
    });

    // Open the inline test panel. Card-level button "Test"/"测试".
    const testBtn = screen.getByRole("button", { name: /^(Test|测试)$/ });
    await act(async () => {
      fireEvent.click(testBtn);
    });

    // Then click the inline "Run test" / "运行测试" submit.
    const runBtn = screen.getByRole("button", { name: /Run test|运行测试/ });
    await act(async () => {
      fireEvent.click(runBtn);
    });
    expect(testSpy).toHaveBeenCalledTimes(1);
    expect(testSpy).toHaveBeenCalledWith(9, undefined);
  });
});
