import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
      projectionPanels: [],
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
      runIdMap: new Map(),
      sessionKeyMap: new Map(),
    });
    setupAgents();
  });

  afterEach(() => {
    useOfficeStore.setState({
      agents: new Map(),
      selectedAgentId: null,
      sidebarCollapsed: false,
      eventHistory: [],
      projectionPanels: [],
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
      runIdMap: new Map(),
      sessionKeyMap: new Map(),
    });
  });

  it("renders all agents", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("Coder")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Writer")).toBeInTheDocument();
  });

  it("search filters agents by name", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
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

    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    const searchSection = screen.getByPlaceholderText(
      t("layout:sidebar.searchPlaceholder"),
    ).parentElement;
    const activeFilter = within(searchSection!).getByText(t("layout:sidebar.filters.active"));
    fireEvent.click(activeFilter);

    expect(screen.getAllByText("Coder").length).toBeGreaterThan(0);
    expect(screen.queryByText("Reviewer")).not.toBeInTheDocument();
  });

  it("renders projection bootstrap panels when seeded", () => {
    useOfficeStore.getState().applyProjectionBootstrap({
      schemaVersion: "openclaw-office-projection-packet.v0",
      generatedAt: "2026-03-25T07:15:13Z",
      sources: {},
      officeProjection: {
        mode: "framework-bootstrap/mock-seed-ready",
        runtimeBoundary: {
          contextEngineSlot: "legacy",
          projectionContextEngineRolloutGate: "unchanged",
          notes: [],
        },
        scene: {
          agents: [],
          links: [],
          eventHistory: [],
          globalMetrics: {
            activeAgents: 0,
            totalAgents: 0,
            totalTokens: 0,
            tokenRate: 0,
            collaborationHeat: 0,
          },
        },
        panels: {
          decisionDrift: {
            panelId: "decision-drift",
            title: "Decision drift",
            severity: "warn",
            summary: { count: 1 },
            items: [
              {
                kind: "deterministic-example",
                title: "Pointer cache tries to override live board focus",
                caseId: "live_projection_pointer_override",
              },
            ],
          },
        },
      },
    });

    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText(t("layout:sidebar.projectionBootstrap"))).toBeInTheDocument();
    expect(screen.getByText("Decision drift")).toBeInTheDocument();
    expect(screen.getByText("Pointer cache tries to override live board focus")).toBeInTheDocument();
  });
});
