import { create } from "zustand";
import { getAdapter, waitForAdapter } from "@/gateway/adapter-provider";
import type { SkillInfo, SkillInstallResult } from "@/gateway/adapter-types";
import i18n from "@/i18n";
import { toastSuccess, toastError } from "@/store/toast-store";

export type SkillTab = "installed" | "marketplace";
export type SkillSourceFilter = "all" | "built-in" | "marketplace";

interface SkillsStoreState {
  skills: SkillInfo[];
  isLoading: boolean;
  error: string | null;

  activeTab: SkillTab;
  sourceFilter: SkillSourceFilter;
  selectedSkill: SkillInfo | null;
  detailDialogOpen: boolean;
  installing: Set<string>;

  fetchSkills: () => Promise<void>;
  setTab: (tab: SkillTab) => void;
  setSourceFilter: (filter: SkillSourceFilter) => void;
  openDetail: (skill: SkillInfo) => void;
  closeDetail: () => void;
  toggleSkill: (skillKey: string, enabled: boolean) => Promise<void>;
  installSkill: (name: string, installId: string) => Promise<SkillInstallResult>;
}

function compareSkillPriority(a: SkillInfo, b: SkillInfo): number {
  if (a.enabled && !b.enabled) return -1;
  if (!a.enabled && b.enabled) return 1;
  if (a.isCore && !b.isCore) return -1;
  if (!a.isCore && b.isCore) return 1;
  return a.name.localeCompare(b.name);
}

export function getInstalledSkillIds(skills: SkillInfo[]): Set<string> {
  return new Set(skills.map((skill) => skill.id));
}

export function filterInstalledSkills(
  skills: SkillInfo[],
  query: string,
  sourceFilter: SkillSourceFilter,
): SkillInfo[] {
  const normalizedQuery = query.trim().toLowerCase();

  return skills
    .filter((skill) => skill.isBundled || skill.eligible)
    .filter((skill) => {
      if (!normalizedQuery) return true;
      return [skill.name, skill.description, skill.slug, skill.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .filter((skill) => {
      if (sourceFilter === "built-in") return Boolean(skill.isBundled);
      if (sourceFilter === "marketplace") return !skill.isBundled;
      return true;
    })
    .sort(compareSkillPriority);
}

export function filterMarketplaceSkills(skills: SkillInfo[], query: string): SkillInfo[] {
  const normalizedQuery = query.trim().toLowerCase();

  return skills
    .filter((skill) => !skill.isBundled)
    .filter((skill) => {
      if (!normalizedQuery) return true;
      return [skill.name, skill.description, skill.slug, skill.author, skill.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const useSkillsStore = create<SkillsStoreState>((set, get) => ({
  skills: [],
  isLoading: false,
  error: null,

  activeTab: "installed",
  sourceFilter: "all",
  selectedSkill: null,
  detailDialogOpen: false,
  installing: new Set<string>(),

  fetchSkills: async () => {
    set({ isLoading: true, error: null });
    try {
      await waitForAdapter();
      const skills = await getAdapter().skillsStatus();
      set({ skills, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setTab: (tab) => set({ activeTab: tab }),
  setSourceFilter: (filter) => set({ sourceFilter: filter }),

  openDetail: (skill) => set({ selectedSkill: skill, detailDialogOpen: true }),
  closeDetail: () => set({ selectedSkill: null, detailDialogOpen: false }),

  toggleSkill: async (skillKey, enabled) => {
    try {
      const result = await getAdapter().skillsUpdate(skillKey, { enabled });
      if (result.ok) {
        set((s) => ({
          skills: s.skills.map((sk) => (sk.id === skillKey ? { ...sk, enabled } : sk)),
        }));
        const skill = get().skills.find((s) => s.id === skillKey);
        const label = skill?.name ?? skillKey;
        toastSuccess(
          enabled
            ? i18n.t("console:skills.toast.enabled", { name: label })
            : i18n.t("console:skills.toast.disabled", { name: label }),
        );
      }
    } catch (err) {
      toastError(i18n.t("console:skills.toast.toggleFailed"), String(err));
      set({ error: String(err) });
    }
  },

  installSkill: async (name, installId) => {
    const installing = new Set(get().installing);
    installing.add(name);
    set({ installing });

    try {
      const result = await getAdapter().skillsInstall(name, installId);
      if (result.ok) {
        await get().fetchSkills();
        toastSuccess(i18n.t("console:skills.toast.installSuccess", { name }));
      } else {
        const detail = [result.stdout, result.stderr].filter(Boolean).join("\n\n");
        toastError(
          i18n.t("console:skills.toast.installFailed", { name }),
          result.message,
          detail || undefined,
        );
      }
      if (result.warnings?.length) {
        for (const w of result.warnings) {
          toastError(i18n.t("console:skills.toast.installWarning"), w);
        }
      }
      return result;
    } catch (err) {
      toastError(i18n.t("console:skills.toast.installFailed", { name }), String(err));
      return { ok: false, message: String(err) };
    } finally {
      const updated = new Set(get().installing);
      updated.delete(name);
      set({ installing: updated });
    }
  },
}));
