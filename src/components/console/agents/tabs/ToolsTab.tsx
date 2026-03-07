import { RefreshCw, X, Plus, ChevronDown, Loader2, Wrench } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ToolCatalogEntry } from "@/gateway/adapter-types";
import type { AgentSummary } from "@/gateway/types";
import { useAgentsStore } from "@/store/console-stores/agents-store";

interface ToolsTabProps {
  agent: AgentSummary;
}

const PROFILE_OPTIONS = ["full", "minimal", "custom", ""] as const;

export function ToolsTab({ agent }: ToolsTabProps) {
  const { t } = useTranslation("console");
  const {
    agentTools,
    agentToolsLoading,
    agentToolsConfig,
    fetchAgentTools,
    saveAgentToolsConfig,
  } = useAgentsStore();

  const [profile, setProfile] = useState("");
  const [alsoAllow, setAlsoAllow] = useState<string[]>([]);
  const [deny, setDeny] = useState<string[]>([]);
  const [allowInput, setAllowInput] = useState("");
  const [denyInput, setDenyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    fetchAgentTools(agent.id);
  }, [agent.id, fetchAgentTools]);

  useEffect(() => {
    if (agentToolsConfig) {
      setProfile(agentToolsConfig.profile ?? "");
      setAlsoAllow(agentToolsConfig.alsoAllow ?? []);
      setDeny(agentToolsConfig.deny ?? []);
    }
    setSaveStatus("idle");
  }, [agentToolsConfig]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus("idle");
    const result = await saveAgentToolsConfig(agent.id, {
      profile: profile || undefined,
      alsoAllow: alsoAllow.length > 0 ? alsoAllow : undefined,
      deny: deny.length > 0 ? deny : undefined,
    });
    setSaving(false);
    setSaveStatus(result.ok ? "success" : "error");
    if (result.ok) {
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [agent.id, profile, alsoAllow, deny, saveAgentToolsConfig]);

  const addTag = (list: string[], setList: (v: string[]) => void, value: string) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) setList([...list, trimmed]);
  };

  const removeTag = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  const toolGroups = groupToolsBySource(agentTools ?? []);
  const enabledCount = agentTools?.filter((t) => t.enabled !== false).length ?? 0;
  const totalCount = agentTools?.length ?? 0;

  if (agentToolsLoading) {
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
          {t("agents.tools.title")}
        </h3>
        <button
          onClick={() => fetchAgentTools(agent.id)}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title={t("agents.refresh")}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {/* Strategy summary card */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">{t("agents.tools.profile")}:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {profile || t("agents.tools.profileDefault")}
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-gray-500 dark:text-gray-400">
            {t("agents.tools.enabledCount", { enabled: enabledCount, total: totalCount })}
          </span>
        </div>
      </div>

      {/* Profile editor */}
      <div className="space-y-4 border-t border-gray-200 pt-5 dark:border-gray-700">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            {t("agents.tools.profile")}
          </label>
          <div className="relative w-full max-w-xs">
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              aria-label={t("agents.tools.profile")}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              {PROFILE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt || t("agents.tools.profileDefault")}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* alsoAllow tag editor */}
        <TagListEditor
          label={t("agents.tools.alsoAllow")}
          tags={alsoAllow}
          inputValue={allowInput}
          onInputChange={setAllowInput}
          onAdd={(v) => {
            addTag(alsoAllow, setAlsoAllow, v);
            setAllowInput("");
          }}
          onRemove={(i) => removeTag(alsoAllow, setAlsoAllow, i)}
          placeholder={t("agents.tools.addTool")}
        />

        {/* deny tag editor */}
        <TagListEditor
          label={t("agents.tools.deny")}
          tags={deny}
          inputValue={denyInput}
          onInputChange={setDenyInput}
          onAdd={(v) => {
            addTag(deny, setDeny, v);
            setDenyInput("");
          }}
          onRemove={(i) => removeTag(deny, setDeny, i)}
          placeholder={t("agents.tools.addTool")}
        />

        {/* Save */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t("agents.tools.saving") : t("agents.tools.save")}
          </button>
          {saveStatus === "success" && (
            <span className="text-xs text-green-600">{t("agents.tools.saveSuccess")}</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-600">{t("agents.tools.saveError")}</span>
          )}
        </div>
      </div>

      {/* Tool catalog */}
      <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("agents.tools.catalogTitle")}
        </h3>
        {totalCount === 0 ? (
          <EmptyState message={t("agents.tools.noTools")} />
        ) : (
          <div className="space-y-4">
            {Object.entries(toolGroups).map(([source, tools]) => (
              <div key={source}>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {source}
                </h4>
                <div className="space-y-1">
                  {tools.map((tool) => (
                    <ToolRow key={tool.name} tool={tool} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagListEditor({
  label,
  tags,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  tags: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          >
            {tag}
            <button
              onClick={() => onRemove(i)}
              className="rounded-sm text-gray-400 hover:text-red-500"
              title={tag}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd(inputValue);
              }
            }}
            placeholder={placeholder}
            className="w-36 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
          <button
            onClick={() => onAdd(inputValue)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700"
            title={label}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolRow({ tool }: { tool: ToolCatalogEntry }) {
  const sourceBadgeColor =
    tool.source === "built-in"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      : tool.source === "plugin"
        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <Wrench className="h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
        {tool.description && (
          <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
            {tool.description}
          </p>
        )}
      </div>
      {tool.source && (
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColor}`}>
          {tool.source}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">{message}</div>
  );
}

function groupToolsBySource(tools: ToolCatalogEntry[]): Record<string, ToolCatalogEntry[]> {
  const groups: Record<string, ToolCatalogEntry[]> = {};
  for (const tool of tools) {
    const key = tool.source ?? "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(tool);
  }
  return groups;
}
