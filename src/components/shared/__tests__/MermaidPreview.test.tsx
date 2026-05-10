import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MermaidPreview } from "../MermaidPreview";

const renderMock = vi.fn(async () => ({
  svg: '<svg data-testid="mermaid-svg"><text>diagram</text></svg>',
  error: null,
}));

vi.mock("@/hooks/useMermaidRenderer", () => ({
  useMermaidRenderer: () => ({
    render: renderMock,
  }),
}));

describe("MermaidPreview", () => {
  it("renders the diagram on first mount", async () => {
    const source = `flowchart TD
A-->B`;
    const { container } = render(<MermaidPreview source={source} />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="mermaid-svg"]')).toBeInTheDocument();
    });

    expect(renderMock).toHaveBeenCalledWith(source);
  });
});