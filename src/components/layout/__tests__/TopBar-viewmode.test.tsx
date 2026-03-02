import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useOfficeStore } from "@/store/office-store";
import { TopBar } from "../TopBar";

vi.mock("@/lib/webgl-detect", () => ({
  isWebGLAvailable: () => true,
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => {
  useOfficeStore.setState({
    connectionStatus: "connected",
    connectionError: null,
    viewMode: "2d",
    currentPage: "office",
    globalMetrics: {
      activeAgents: 1,
      totalAgents: 3,
      totalTokens: 0,
      tokenRate: 0,
      collaborationHeat: 0,
    },
  });
});

describe("TopBar view mode switch", () => {
  it("renders 2D and 3D buttons", () => {
    renderWithRouter(<TopBar />);
    expect(screen.getByText("2D")).toBeDefined();
    expect(screen.getByText("3D")).toBeDefined();
  });

  it("clicking 3D button calls setViewMode", () => {
    renderWithRouter(<TopBar />);
    fireEvent.click(screen.getByText("3D"));
    expect(useOfficeStore.getState().viewMode).toBe("3d");
  });

  it("clicking 2D button when in 3D returns to 2d", () => {
    useOfficeStore.setState({ viewMode: "3d" });
    renderWithRouter(<TopBar />);
    fireEvent.click(screen.getByText("2D"));
    expect(useOfficeStore.getState().viewMode).toBe("2d");
  });
});
