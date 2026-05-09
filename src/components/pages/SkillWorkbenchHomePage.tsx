import { useEffect } from "react";
import { useSkillWorkbenchStore } from "@/store/console-stores/skill-workbench-store";
import { SkillCardGrid } from "@/components/console/skills/SkillCardGrid";

export function SkillWorkbenchHomePage() {
  const leaveWorkbench = useSkillWorkbenchStore((s) => s.leaveWorkbench);
  const clearCurrentSkill = useSkillWorkbenchStore((s) => s.clearCurrentSkill);

  useEffect(() => {
    // The home page is always the "neutral" state: no workbench session active,
    // no currently-focused skill. Reset both on entry so returning from detail
    // page cleans up state even without the layout-level cleanup kicking in.
    leaveWorkbench();
    clearCurrentSkill();
  }, [leaveWorkbench, clearCurrentSkill]);

  return <SkillCardGrid />;
}
