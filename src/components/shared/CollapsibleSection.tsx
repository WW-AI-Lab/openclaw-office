import { useCallback, useEffect, useRef, type ReactNode } from "react";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Persisted height in px; null = use minHeight */
  height: number | null;
  onHeightChange: (height: number) => void;
  minHeight?: number;
  maxHeight?: number;
  /** Extra content rendered inline in the header bar (right side) */
  headerExtra?: ReactNode;
  children: ReactNode;
  /** If true, allow flex-grow to fill remaining space */
  flex?: boolean;
  /** Count badge shown next to the title */
  badge?: number | string;
}

export function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  height,
  onHeightChange,
  minHeight = 60,
  maxHeight = 600,
  headerExtra,
  children,
  flex = false,
  badge,
}: CollapsibleSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);

  const effectiveHeight = collapsed ? 0 : (height ?? minHeight);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      const currentHeight = contentRef.current?.offsetHeight ?? effectiveHeight;
      dragRef.current = { startY: e.clientY, startHeight: currentHeight };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientY - dragRef.current.startY;
        const newHeight = Math.max(
          minHeight,
          Math.min(maxHeight, dragRef.current.startHeight + delta),
        );
        onHeightChange(newHeight);
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [collapsed, effectiveHeight, minHeight, maxHeight, onHeightChange],
  );

  // Reset body cursor on unmount in case drag was interrupted
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <div
      className={`flex flex-col ${flex && !collapsed ? "min-h-0 flex-1" : ""}`}
      style={!collapsed && !flex ? { flexShrink: 0 } : undefined}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex h-6 w-full items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <span
          className="inline-block text-[9px] transition-transform duration-150"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
        <span className="select-none">{title}</span>
        {badge !== undefined && (
          <span className="ml-1 rounded-sm bg-gray-200 px-1 text-[10px] font-normal text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {badge}
          </span>
        )}
        {headerExtra && (
          <span className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
            {headerExtra}
          </span>
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <div
          ref={contentRef}
          className={`overflow-y-auto overflow-x-hidden ${flex ? "min-h-0 flex-1" : ""}`}
          style={!flex ? { height: effectiveHeight } : { minHeight }}
        >
          {children}
        </div>
      )}

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="group relative z-10 h-1 shrink-0 cursor-ns-resize"
        >
          <div className="absolute inset-x-0 -top-0.5 bottom-0 transition-colors group-hover:bg-blue-500/30 group-active:bg-blue-500/50" />
        </div>
      )}
    </div>
  );
}
