import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";
import i18n from "@/i18n/test-setup";
import { useOfficeStore } from "@/store/office-store";

const t = (key: string) => i18n.t(key);

function setupAgents() {
  useOfficeStore.getState().initAgents([
    { id: "a1", name: "Coder" },
    { id: "a2", name: "Reviewer" },
    { id: "a3", name: "Writer" },
  ]);
}

describe("Sidebar", () => {
  beforeEach(() => {
    useOfficeStore.setState({
      agents: new Map(),
      selectedAgentId: null,
      sidebarCollapsed: false,
      eventHistory: [],
      globalMetrics: {
        activeAgents: 0,
        totalAgents: 0,
        totalTokens: 0,
        tokenRate: 0,
        collaborationHeat: 0,
      },
      links: [],
      connectionStatus: "disconnected",
      connectionError: null,
      viewMode: "2d",
      runIdMap: new Map(),
      sessionKeyMap: new Map(),
    });
    setupAgents();
  });

  it("renders all agents", () => {
    render(<Sidebar />);
    expect(screen.getByText("Coder")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Writer")).toBeInTheDocument();
  });

  it("search filters agents by name", () => {
    render(<Sidebar />);
    const searchInput = screen.getByPlaceholderText(t("layout:sidebar.searchPlaceholder"));
    fireEvent.change(searchInput, { target: { value: "cod" } });
    expect(screen.getByText("Coder")).toBeInTheDocument();
    expect(screen.queryByText("Reviewer")).not.toBeInTheDocument();
  });

  it("filter tags work", () => {
    useOfficeStore.setState({ runIdMap: new Map([["r1", "a1"]]) });
    useOfficeStore.getState().processAgentEvent({
      runId: "r1",
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start" },
    });

    render(<Sidebar />);
    const searchSection = screen.getByPlaceholderText(
      t("layout:sidebar.searchPlaceholder"),
    ).parentElement;
    const activeFilter = within(searchSection!).getByText(t("layout:sidebar.filters.active"));
    fireEvent.click(activeFilter);

    expect(screen.getAllByText("Coder").length).toBeGreaterThan(0);
    expect(screen.queryByText("Reviewer")).not.toBeInTheDocument();
  });
});
