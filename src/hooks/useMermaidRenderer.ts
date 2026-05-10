import { useCallback, useRef } from "react";
import { useOfficeStore } from "@/store/office-store";

let mermaidInstance: typeof import("mermaid").default | null = null;
let initPromise: Promise<void> | null = null;
let lastTheme: string | null = null;
let renderCounter = 0;

// Mermaid mutates global/DOM state during render (temporary container divs,
// internal parse state). Running multiple renders concurrently — which
// happens as soon as a Markdown document contains 2+ ```mermaid``` blocks
// — can corrupt the output (missing nodes, swapped SVGs, parse errors).
// Serialize every render() call through a single promise chain so each
// chart renders in isolation.
let renderQueue: Promise<unknown> = Promise.resolve();

async function getMermaid() {
  if (!initPromise) {
    initPromise = import("mermaid").then((mod) => {
      mermaidInstance = mod.default;
    });
  }
  await initPromise;
  return mermaidInstance!;
}

export function useMermaidRenderer() {
  const renderRef = useRef<HTMLDivElement>(null);
  const theme = useOfficeStore((s) => s.theme);

  const render = useCallback(
    async (source: string): Promise<{ svg: string; error: string | null }> => {
      const task = renderQueue.then(async () => {
        let id = "";
        try {
          const mermaid = await getMermaid();
          const currentTheme = theme === "dark" ? "dark" : "default";

          if (lastTheme !== currentTheme) {
            mermaid.initialize({
              startOnLoad: false,
              theme: currentTheme,
              flowchart: { useMaxWidth: true, htmlLabels: true },
              securityLevel: "strict",
            });
            lastTheme = currentTheme;
          }

          renderCounter += 1;
          id = `mermaid-render-${renderCounter}`;

          // Pre-validate syntax to avoid mermaid.render() creating orphaned error SVGs
          await mermaid.parse(source);

          const { svg } = await mermaid.render(id, source);

          // mermaid.render() appends a temporary container `<div id="d{id}">` to document.body.
          // Clean it up regardless of success/failure to prevent DOM pollution.
          const orphan = document.getElementById(`d${id}`);
          if (orphan) orphan.remove();

          return { svg, error: null };
        } catch (err) {
          // Also clean up any orphaned container from a failed render attempt.
          if (id) {
            const orphan = document.getElementById(`d${id}`);
            if (orphan) orphan.remove();
          }
          return { svg: "", error: String(err) };
        }
      });
      // Keep the chain alive even if a task rejects (defensive — the task
      // above already swallows errors, but this guards against future changes).
      renderQueue = task.catch(() => undefined);
      return task;
    },
    [theme],
  );

  return { renderRef, render };
}
