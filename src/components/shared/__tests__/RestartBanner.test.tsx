import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import "@/i18n/test-setup";
import { RestartBanner } from "@/components/shared/RestartBanner";
import { useConfigStore } from "@/store/console-stores/config-store";
import { useOfficeStore } from "@/store/office-store";

describe("RestartBanner", () => {
  beforeEach(() => {
    useConfigStore.setState({ lifecycleState: null, restartState: null });
    useOfficeStore.setState({ connectionStatus: "disconnected" });
  });

  it("renders cli restart guidance with command", () => {
    useConfigStore.setState({
      lifecycleState: {
        status: "saved-cli-restart-required",
        source: "cli",
        startedAt: Date.now(),
        command: "openclaw gateway restart",
      },
    });

    render(<RestartBanner />);

    expect(screen.getByText("openclaw gateway restart")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制命令" })).toBeInTheDocument();
  });

  it("tracks apply restart through disconnect and reconnect", async () => {
    useConfigStore.setState({
      lifecycleState: {
        status: "apply-restarting",
        source: "apply",
        startedAt: Date.now(),
        estimatedDelayMs: 3000,
      },
    });

    render(<RestartBanner />);

    await act(async () => {
      useOfficeStore.setState({ connectionStatus: "disconnected" });
    });
    expect(screen.getByText("Gateway 已断开，等待重启恢复。")).toBeInTheDocument();

    await act(async () => {
      useOfficeStore.setState({ connectionStatus: "connected" });
    });
    expect(screen.getByText("Gateway 已恢复，最新配置已生效。")).toBeInTheDocument();
  });
});
