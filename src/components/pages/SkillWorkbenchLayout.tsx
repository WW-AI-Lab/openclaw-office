import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useSkillWorkbenchStore } from "@/store/console-stores/skill-workbench-store";

/**
 * Wraps all /skill-workbench routes. Responsible for restoring the original
 * chat session when the user leaves the workbench entirely.
 *
 * Per-page effects (HomePage / CreatePage / DetailPage) are free to call
 * enterWorkbench() with their own mode — this layout guarantees a final
 * leaveWorkbench() on unmount so chat-dock-store gets the original session back.
 */
export function SkillWorkbenchLayout() {
  const leaveWorkbench = useSkillWorkbenchStore((s) => s.leaveWorkbench);

  useEffect(() => {
    return () => {
      leaveWorkbench();
    };
  }, [leaveWorkbench]);

  return (
    <div className="flex h-full flex-col">
      <Outlet />
    </div>
  );
}
