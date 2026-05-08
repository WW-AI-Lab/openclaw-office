import { memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Code, Check, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { MermaidPreview } from "@/components/shared/MermaidPreview";
import { MermaidEditor } from "./MermaidEditor";
import { useSkillWorkbenchStore } from "@/store/console-stores/skill-workbench-store";

type ViewMode = "preview" | "source";

export const FlowchartPanel = memo(function FlowchartPanel() {
  const { t } = useTranslation("console");
  const mermaidSource = useSkillWorkbenchStore((s) => s.mermaidSource);
  const mermaidConfirmed = useSkillWorkbenchStore((s) => s.mermaidConfirmed);
  const setMermaidSource = useSkillWorkbenchStore((s) => s.setMermaidSource);
  const confirmMermaid = useSkillWorkbenchStore((s) => s.confirmMermaid);

  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.2, Math.min(3, prev + delta)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const isEmpty = !mermaidSource.trim();

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              viewMode === "preview"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <Eye className="h-3 w-3" />
            {t("skillWorkbench.flowchart.preview")}
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              viewMode === "source"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <Code className="h-3 w-3" />
            {t("skillWorkbench.flowchart.source")}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {viewMode === "preview" && (
            <>
              <button
                onClick={() => setScale((s) => Math.min(3, s + 0.2))}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title={t("skillWorkbench.flowchart.zoomIn")}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title={t("skillWorkbench.flowchart.zoomOut")}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={resetZoom}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title={t("skillWorkbench.flowchart.resetZoom")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <span className="ml-1 text-xs text-gray-400">{Math.round(scale * 100)}%</span>
            </>
          )}

          {!isEmpty && !mermaidConfirmed && (
            <button
              onClick={confirmMermaid}
              className="ml-2 flex items-center gap-1 rounded-md bg-green-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600"
            >
              <Check className="h-3 w-3" />
              {t("skillWorkbench.toolbar.confirmFlow")}
            </button>
          )}
          {mermaidConfirmed && (
            <span className="ml-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              {t("skillWorkbench.flowchart.confirmed")}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
            <p>{t("skillWorkbench.flowchart.emptyState")}</p>
            <p className="text-xs">{t("skillWorkbench.flowchart.emptyHint")}</p>
          </div>
        ) : viewMode === "source" ? (
          <div className="h-full p-3">
            <MermaidEditor source={mermaidSource} onChange={setMermaidSource} />
          </div>
        ) : (
          <div
            className="h-full cursor-grab overflow-hidden active:cursor-grabbing"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              className="h-full w-full origin-center p-4"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              }}
            >
              <MermaidPreview source={mermaidSource} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
