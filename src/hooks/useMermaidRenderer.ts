import { useCallback, useRef } from "react";
import { useOfficeStore } from "@/store/office-store";

let mermaidInstance: typeof import("mermaid").default | null = null;
let initPromise: Promise<void> | null = null;
let lastTheme: string | null = null;
let renderCounter = 0;

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
        const id = `mermaid-render-${renderCounter}`;
        const { svg } = await mermaid.render(id, source);
        return { svg, error: null };
      } catch (err) {
        return { svg: "", error: String(err) };
      }
    },
    [theme],
  );

  return { renderRef, render };
}
