import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Plus, Search, Sparkles, Pencil } from "lucide-react";
import type { SkillInfo } from "@/gateway/adapter-types";
import { useSkillsStore } from "@/store/console-stores/skills-store";

function filterWorkspaceSkills(skills: SkillInfo[]): SkillInfo[] {
  // Keep parity with the legacy SkillBrowser filter: prefer the openclaw-workspace
  // source, fall back to "non-bundled, non-core" to surface user skills that
  // predate the source tag.
  return skills.filter(
    (s) => s.source === "openclaw-workspace" || (!s.isBundled && !s.isCore),
  );
}

interface SkillWorkspaceCardProps {
  skill: SkillInfo;
}

const SkillWorkspaceCard = memo(function SkillWorkspaceCard({ skill }: SkillWorkspaceCardProps) {
  const { t } = useTranslation("console");
  return (
    <Link
      to={`/skill-workbench/${encodeURIComponent(skill.slug)}`}
      className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600"
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-lg dark:bg-blue-900/30">
          {skill.icon || "🧩"}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {skill.name}
          </h3>
          <p className="truncate font-mono text-[11px] text-gray-400">{skill.slug}</p>
        </div>
      </div>
      <p className="mb-3 line-clamp-3 text-xs text-gray-500 dark:text-gray-400">
        {skill.description || t("skillWorkbench.home.noDescription")}
      </p>
      <div className="mt-auto flex items-center justify-between text-[11px] text-gray-400">
        <span>{skill.version ? `v${skill.version}` : ""}</span>
        <span className="flex items-center gap-1 text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3" />
          {t("skillWorkbench.home.openCard")}
        </span>
      </div>
    </Link>
  );
});

const CreateCard = memo(function CreateCard() {
  const { t } = useTranslation("console");
  return (
    <Link
      to="/skill-workbench/new"
      className="group flex h-full min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:border-blue-500 dark:hover:bg-blue-900/30"
    >
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white transition-transform group-hover:scale-110">
        <Plus className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
        {t("skillWorkbench.home.createTitle")}
      </h3>
      <p className="mt-1 text-xs text-blue-600/80 dark:text-blue-300/80">
        {t("skillWorkbench.home.createSubtitle")}
      </p>
    </Link>
  );
});

export const SkillCardGrid = memo(function SkillCardGrid() {
  const { t } = useTranslation("console");
  const skills = useSkillsStore((s) => s.skills);
  const isLoading = useSkillsStore((s) => s.isLoading);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);

  const [query, setQuery] = useState("");

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const filtered = useMemo(() => {
    const workspace = filterWorkspaceSkills(skills);
    const q = query.trim().toLowerCase();
    if (!q) return workspace;
    return workspace.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q),
    );
  }, [skills, query]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
              <Sparkles className="h-5 w-5 text-blue-500" />
              {t("skillWorkbench.home.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("skillWorkbench.home.subtitle")}
            </p>
          </div>
          <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("skillWorkbench.home.searchPlaceholder")}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading && skills.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            {t("skillWorkbench.browser.loading")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <CreateCard />
            {filtered.map((skill) => (
              <SkillWorkspaceCard key={skill.id} skill={skill} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && query.trim() && (
          <div className="mt-10 text-center text-sm text-gray-400">
            {t("skillWorkbench.home.noMatch")}
          </div>
        )}
        {!isLoading && skills.length > 0 && filterWorkspaceSkills(skills).length === 0 && (
          <div className="mt-10 text-center text-sm text-gray-400">
            {t("skillWorkbench.browser.noSkills")}
          </div>
        )}
      </div>
    </div>
  );
});
