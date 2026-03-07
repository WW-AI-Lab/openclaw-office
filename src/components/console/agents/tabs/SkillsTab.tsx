import { RefreshCw, Loader2, AlertTriangle, Sparkles, CheckSquare, Square } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SkillInfo } from "@/gateway/adapter-types";
import type { AgentSummary } from "@/gateway/types";
import { useAgentsStore } from "@/store/console-stores/agents-store";

interface SkillsTabProps {
  agent: AgentSummary;
}

type SkillMode = "all" | "selected";

export function SkillsTab({ agent }: SkillsTabProps) {
  const { t } = useTranslation("console");
  const {
    agentSkills,
    agentSkillsLoading,
    agentSkillsAllowlist,
    fetchAgentSkills,
    saveAgentSkillsAllowlist,
  } = useAgentsStore();

  const [mode, setMode] = useState<SkillMode>("all");
  const [localAllowlist, setLocalAllowlist] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    fetchAgentSkills(agent.id);
  }, [agent.id, fetchAgentSkills]);

  useEffect(() => {
    if (agentSkillsAllowlist === null || agentSkillsAllowlist === undefined) {
      setMode("all");
      setLocalAllowlist([]);
    } else {
      setMode("selected");
      setLocalAllowlist(agentSkillsAllowlist);
    }
    setSaveStatus("idle");
  }, [agentSkillsAllowlist]);

  const handleModeChange = (newMode: SkillMode) => {
    setMode(newMode);
    if (newMode === "all") {
      setLocalAllowlist([]);
    } else {
      const initial =
        agentSkills
          ?.filter((s) => s.enabled)
          .map((s) => s.slug) ?? [];
      setLocalAllowlist(initial);
    }
  };

  const toggleSkill = (slug: string, checked: boolean) => {
    setLocalAllowlist((prev) =>
      checked ? [...prev, slug] : prev.filter((s) => s !== slug),
    );
  };

  const skills = agentSkills ?? [];
  const selectableSkills = useMemo(
    () => skills.filter((s) => !isSkillLocked(s)),
    [skills],
  );

  const handleSelectAll = () => {
    setLocalAllowlist(skills.map((s) => s.slug));
  };

  const handleDeselectAll = () => {
    const lockedSlugs = skills.filter((s) => isSkillLocked(s)).map((s) => s.slug);
    setLocalAllowlist(lockedSlugs);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus("idle");
    const result = await saveAgentSkillsAllowlist(
      agent.id,
      mode === "all" ? null : localAllowlist,
    );
    setSaving(false);
    setSaveStatus(result.ok ? "success" : "error");
    if (result.ok) {
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [agent.id, mode, localAllowlist, saveAgentSkillsAllowlist]);

  // Compute stats based on local edit state, not just remote data
  const { totalCount, enabledCount, blockedCount } = useMemo(() => {
    const total = skills.length;
    if (mode === "all") {
      return {
        totalCount: total,
        enabledCount: skills.filter((s) => s.enabled).length,
        blockedCount: skills.filter((s) => s.blockedByAllowlist).length,
      };
    }
    const allowSet = new Set(localAllowlist);
    const enabled = skills.filter((s) =>
      isSkillLocked(s) || allowSet.has(s.slug),
    ).length;
    return {
      totalCount: total,
      enabledCount: enabled,
      blockedCount: total - enabled,
    };
  }, [skills, mode, localAllowlist]);

  const allSelected = mode === "selected" && selectableSkills.every((s) => localAllowlist.includes(s.slug));
  const noneSelected = mode === "selected" && selectableSkills.every((s) => !localAllowlist.includes(s.slug));

  if (agentSkillsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("agents.skills.title")}
        </h3>
        <button
          onClick={() => fetchAgentSkills(agent.id)}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title={t("agents.refresh")}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {/* Statistics summary — reflects local edit state */}
      <div className="flex gap-4">
        <StatBadge label={t("agents.skills.total")} value={totalCount} />
        <StatBadge label={t("agents.skills.enabled")} value={enabledCount} color="green" />
        <StatBadge label={t("agents.skills.blocked")} value={blockedCount} color="red" />
      </div>

      {/* Mode toggle */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="skillMode"
              checked={mode === "all"}
              onChange={() => handleModeChange("all")}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("agents.skills.modeAll")}
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="skillMode"
              checked={mode === "selected"}
              onChange={() => handleModeChange("selected")}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("agents.skills.modeSelected")}
            </span>
          </label>
        </div>
      </div>

      {/* Select all / Deselect all buttons */}
      {mode === "selected" && skills.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            disabled={allSelected}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {t("agents.skills.selectAll")}
          </button>
          <button
            onClick={handleDeselectAll}
            disabled={noneSelected}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Square className="h-3.5 w-3.5" />
            {t("agents.skills.deselectAll")}
          </button>
        </div>
      )}

      {/* Skill list */}
      <div className="space-y-1">
        {skills.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {t("agents.skills.noRestriction")}
          </div>
        ) : (
          skills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              selectable={mode === "selected"}
              checked={isSkillChecked(skill, mode, localAllowlist)}
              locked={isSkillLocked(skill)}
              onToggle={(checked) => toggleSkill(skill.slug, checked)}
            />
          ))
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t("agents.skills.saving") : t("agents.skills.save")}
        </button>
        {saveStatus === "success" && (
          <span className="text-xs text-green-600">{t("agents.skills.saveSuccess")}</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-600">{t("agents.skills.saveError")}</span>
        )}
      </div>
    </div>
  );
}

function isSkillChecked(skill: SkillInfo, mode: SkillMode, allowlist: string[]): boolean {
  if (mode === "all") return skill.enabled;
  if (skill.isCore && skill.always) return true;
  return allowlist.includes(skill.slug);
}

function isSkillLocked(skill: SkillInfo): boolean {
  return !!(skill.isCore && skill.always);
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "red";
}) {
  const textColor =
    color === "green"
      ? "text-green-600 dark:text-green-400"
      : color === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-900 dark:text-gray-100";

  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
      <div className={`text-lg font-semibold ${textColor}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function SkillRow({
  skill,
  selectable,
  checked,
  locked,
  onToggle,
}: {
  skill: SkillInfo;
  selectable: boolean;
  checked: boolean;
  locked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const { t } = useTranslation("console");
  const hasMissing =
    (skill.missing?.bins && skill.missing.bins.length > 0) ||
    (skill.missing?.env && skill.missing.env.length > 0);

  const sourceLabel = skill.isCore || skill.isBundled
    ? t("agents.skills.sourceBuiltIn")
    : t("agents.skills.sourceMarketplace");

  const sourceBadgeColor = skill.isCore || skill.isBundled
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";

  const statusLabel = selectable
    ? (checked ? t("skills.detail.enabled") : t("skills.detail.disabled"))
    : (skill.enabled ? t("skills.detail.enabled") : t("skills.detail.disabled"));

  const statusBadge = selectable
    ? (checked
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400")
    : (skill.enabled
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400");

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      {selectable && (
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={skill.name}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
      )}
      <span className="text-lg">{skill.icon || <Sparkles className="h-4 w-4 text-gray-400" />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{skill.name}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge}`}>
            {statusLabel}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColor}`}>
            {sourceLabel}
          </span>
        </div>
        {skill.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
            {skill.description}
          </p>
        )}
      </div>
      {hasMissing && (
        <span title={t("agents.skills.missingDeps")}>
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        </span>
      )}
    </div>
  );
}
