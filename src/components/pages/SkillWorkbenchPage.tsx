import { useCallback, useEffect } from "react";
import { WorkbenchToolbar } from "@/components/console/skills/WorkbenchToolbar";
import { WorkbenchLayout } from "@/components/console/skills/WorkbenchLayout";
import { WorkbenchChat } from "@/components/console/skills/WorkbenchChat";
import { FlowchartPanel } from "@/components/console/skills/FlowchartPanel";
import { SkillBrowser } from "@/components/console/skills/SkillBrowser";
import type { WorkbenchMode } from "@/components/console/skills/WorkbenchToolbar";
import { useSkillWorkbenchStore } from "@/store/console-stores/skill-workbench-store";

export function SkillWorkbenchPage() {
  const mode = useSkillWorkbenchStore((s) => s.mode);
  const setMode = useSkillWorkbenchStore((s) => s.setMode);
  const currentSkillName = useSkillWorkbenchStore((s) => s.currentSkillName);
  const enterWorkbench = useSkillWorkbenchStore((s) => s.enterWorkbench);
  const leaveWorkbench = useSkillWorkbenchStore((s) => s.leaveWorkbench);

  useEffect(() => {
    enterWorkbench();
    return () => leaveWorkbench();
  }, [enterWorkbench, leaveWorkbench]);

  const handleModeChange = useCallback(
    (newMode: WorkbenchMode) => {
      setMode(newMode);
    },
    [setMode],
  );

  const leftPanel =
    mode === "browse" ? (
      <SkillBrowser />
    ) : (
      <WorkbenchChat mode={mode} />
    );

  const rightPanel = <FlowchartPanel />;

  return (
    <div className="flex h-full flex-col">
      <WorkbenchToolbar mode={mode} onModeChange={handleModeChange} currentSkillName={currentSkillName ?? undefined} />
      <WorkbenchLayout left={leftPanel} right={rightPanel} />
    </div>
  );
}
