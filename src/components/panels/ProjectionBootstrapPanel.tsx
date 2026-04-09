import { useTranslation } from "react-i18next";
import type { ProjectionPanel, ProjectionPanelItem } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

export function ProjectionBootstrapPanel() {
  const { t } = useTranslation("panels");
  const panels = useOfficeStore((s) => s.projectionPanels);

  if (panels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-2 py-2">
      {panels.map((panel) => (
        <ProjectionPanelCard key={panel.panelId} panel={panel} t={t} />
      ))}
    </div>
  );
}

function ProjectionPanelCard({
  panel,
  t,
}: {
  panel: ProjectionPanel;
  t: (key: string, opts?: { count?: number }) => string;
}) {
  const severityClass = severityClasses[panel.severity];
  const summaryEntries = Object.entries(panel.summary);

  return (
    <article className="rounded-lg border border-gray-200 bg-white px-2 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <h4 className="min-w-0 truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
          {panel.title}
        </h4>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${severityClass}`}
        >
          {t(`projectionBootstrap.severities.${panel.severity}`)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-1">
        {summaryEntries.map(([key, value]) => (
          <span
            key={key}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {key}: {String(value)}
          </span>
        ))}
      </div>

      <div className="mt-2 space-y-1">
        {panel.items.length > 0 ? (
          panel.items.slice(0, 2).map((item) => (
            <ProjectionPanelItemRow key={item.caseId ?? item.title} item={item} t={t} depth={0} />
          ))
        ) : (
          <div className="rounded bg-gray-50 px-2 py-1 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {panel.emptyState ?? t("projectionBootstrap.noItems")}
          </div>
        )}
        {panel.items.length > 2 && (
          <div className="pt-1 text-[10px] text-gray-400 dark:text-gray-500">
            {t("projectionBootstrap.moreItems", { count: panel.items.length - 2 })}
          </div>
        )}
      </div>
    </article>
  );
}

function ProjectionPanelItemRow({
  item,
  t,
  depth,
}: {
  item: ProjectionPanelItem;
  t: (key: string, opts?: { count?: number }) => string;
  depth: number;
}) {
  const meta = buildItemMeta(item, t);
  const detailTags = [
    ...normalizeTags(item.driftTypes),
    ...normalizeTags(item.detectedDriftTypes),
  ];

  return (
    <div className={`rounded border border-gray-100 bg-gray-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-800/70 ${depth > 0 ? "ml-2" : ""}`}>
      <div className="text-[11px] font-medium text-gray-700 dark:text-gray-200">{item.title}</div>
      {meta.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
          {meta.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
      {detailTags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {detailTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {item.driftCounts && Object.keys(item.driftCounts).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(item.driftCounts).map(([key, value]) => (
            <span
              key={key}
              className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
            >
              {key}: {value}
            </span>
          ))}
        </div>
      )}
      {item.chainLabels && item.chainLabels.length > 0 && (
        <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
          {item.chainLabels.join(" → ")}
        </div>
      )}
      {item.examples && item.examples.length > 0 && (
        <div className="mt-1 space-y-1">
          {item.examples.slice(0, 2).map((example) => (
            <ProjectionPanelItemRow
              key={example.caseId ?? example.title}
              item={example}
              t={t}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildItemMeta(item: ProjectionPanelItem, t: (key: string, opts?: { count?: number }) => string): string[] {
  const lines: string[] = [];
  if (item.caseId) lines.push(`${t("projectionBootstrap.meta.caseId")}: ${item.caseId}`);
  if (item.sourceSession) lines.push(`${t("projectionBootstrap.meta.sourceSession")}: ${item.sourceSession}`);
  if (item.taskId) lines.push(`${t("projectionBootstrap.meta.taskId")}: ${item.taskId}`);
  if (item.owner) lines.push(`${t("projectionBootstrap.meta.owner")}: ${item.owner}`);
  if (item.state) lines.push(`${t("projectionBootstrap.meta.state")}: ${item.state}`);
  if (item.reason) lines.push(`${t("projectionBootstrap.meta.reason")}: ${item.reason}`);
  if (item.path) lines.push(`${t("projectionBootstrap.meta.path")}: ${item.path}`);
  return lines;
}

function normalizeTags(tags?: string[]): string[] {
  return tags?.filter(Boolean) ?? [];
}

const severityClasses: Record<ProjectionPanel["severity"], string> = {
  info: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
};

