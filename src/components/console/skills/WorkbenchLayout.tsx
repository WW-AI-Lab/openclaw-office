import { memo, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

interface WorkbenchLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

const MIN_WIDTH = 300;
const DEFAULT_RATIO = 0.5;

export const WorkbenchLayout = memo(function WorkbenchLayout({ left, right }: WorkbenchLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const totalWidth = rect.width;
    const x = e.clientX - rect.left;
    const minRatio = MIN_WIDTH / totalWidth;
    const maxRatio = 1 - minRatio;
    const newRatio = Math.max(minRatio, Math.min(maxRatio, x / totalWidth));
    setRatio(newRatio);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col overflow-hidden" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>

      {/* Divider */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-blue-100 active:bg-blue-200 dark:hover:bg-blue-900/30 dark:active:bg-blue-800/40"
      >
        <div className="h-8 w-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {right}
      </div>
    </div>
  );
});
