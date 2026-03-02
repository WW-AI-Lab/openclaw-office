// Domain Mapping: Gateway payload → UI ViewModel 转换

import type { ChannelInfo, CronTask, SkillInfo, UsageInfo } from "@/gateway/adapter-types";
import i18n from "@/i18n";

// --- ViewModel Types ---

export interface DashboardSummaryVM {
  connectedChannels: number;
  errorChannels: number;
  enabledSkills: number;
  providerUsage: string;
}

export interface ChannelCardVM {
  id: string;
  name: string;
  type: string;
  statusLabel: string;
  statusColor: string;
  icon: string;
  configured: boolean;
  linked: boolean;
  running: boolean;
  lastConnectedAt: number | null;
}

export interface SkillCardVM {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
  source: string;
  hasMissing: boolean;
  hasInstallOptions: boolean;
  configChecksPassed: boolean;
}

export interface CronTaskCardVM {
  id: string;
  name: string;
  schedule: string;
  scheduleLabel: string;
  enabled: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  lastRunStatus: string | null;
  message: string;
  statusLabel: string;
}

// --- Channel icons ---

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "📱",
  telegram: "✈️",
  discord: "🎮",
  signal: "🔒",
  feishu: "🐦",
  imessage: "💬",
  matrix: "🔗",
  line: "🟢",
  msteams: "👔",
  googlechat: "💭",
  mattermost: "💠",
};

function getChannelStatusLabel(status: string): string {
  return i18n.t(`console:viewModels.statusLabels.${status}`, { defaultValue: status });
}

const STATUS_COLORS: Record<string, string> = {
  connected: "#22c55e",
  disconnected: "#6b7280",
  connecting: "#eab308",
  error: "#ef4444",
};

// --- Conversion Functions ---

export function toDashboardSummaryVM(
  channels: ChannelInfo[],
  skills: SkillInfo[],
  usage: UsageInfo | null,
): DashboardSummaryVM {
  const connectedChannels = channels.filter((c) => c.status === "connected").length;
  const errorChannels = channels.filter((c) => c.status === "error").length;
  const enabledSkills = skills.filter((s) => s.enabled).length;

  let providerUsage = "—";
  if (usage && usage.providers.length > 0) {
    const maxUsed = Math.max(
      ...usage.providers.flatMap((p) => p.windows.map((w) => w.usedPercent)),
    );
    providerUsage = `${Math.round(maxUsed)}%`;
  }

  return { connectedChannels, errorChannels, enabledSkills, providerUsage };
}

export function toChannelCardVM(channel: ChannelInfo): ChannelCardVM {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    statusLabel: getChannelStatusLabel(channel.status),
    statusColor: STATUS_COLORS[channel.status] ?? "#6b7280",
    icon: CHANNEL_ICONS[channel.type] ?? "📡",
    configured: channel.configured ?? false,
    linked: channel.linked ?? false,
    running: channel.running ?? false,
    lastConnectedAt: channel.lastConnectedAt ?? null,
  };
}

export function toSkillCardVM(skill: SkillInfo): SkillCardVM {
  const hasMissing = Boolean(
    skill.missing &&
    ((skill.missing.bins?.length ?? 0) > 0 || (skill.missing.env?.length ?? 0) > 0),
  );
  const hasInstallOptions = Boolean(skill.installOptions && skill.installOptions.length > 0);
  const configChecksPassed = skill.configChecks
    ? skill.configChecks.every((c) => c.satisfied)
    : true;

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled,
    icon: skill.icon || "📦",
    source: skill.isBundled
      ? i18n.t("console:viewModels.skillSource.builtIn")
      : i18n.t("console:viewModels.skillSource.marketplace"),
    hasMissing,
    hasInstallOptions,
    configChecksPassed,
  };
}

export function toCronTaskCardVM(task: CronTask): CronTaskCardVM {
  const schedule = formatCronSchedule(task.schedule);
  const message =
    task.payload.kind === "agentTurn"
      ? task.payload.message
      : task.payload.kind === "systemEvent"
        ? task.payload.text
        : "";

  return {
    id: task.id,
    name: task.name,
    schedule,
    scheduleLabel: describeCronSchedule(schedule),
    enabled: task.enabled,
    lastRunAt: task.state.lastRunAtMs ?? null,
    nextRunAt: task.state.nextRunAtMs ?? null,
    lastRunStatus: task.state.lastRunStatus ?? null,
    message,
    statusLabel: task.enabled
      ? i18n.t("console:viewModels.taskStatus.active")
      : i18n.t("console:viewModels.taskStatus.paused"),
  };
}

function formatCronSchedule(s: {
  kind: string;
  expr?: string;
  everyMs?: number;
  at?: string;
  anchorMs?: number;
  tz?: string;
}): string {
  if (s.kind === "cron" && s.expr) return s.expr;
  if (s.kind === "every" && s.everyMs)
    return i18n.t("console:viewModels.schedule.every", { minutes: Math.round(s.everyMs / 60_000) });
  if (s.kind === "at" && s.at) return i18n.t("console:viewModels.schedule.at", { time: s.at });
  return i18n.t("console:viewModels.schedule.unknown");
}

function describeCronSchedule(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length !== 5) return expr;

  const [min, hour, dom, _mon, dow] = parts;

  if (dom === "*" && dow === "*" && hour !== "*" && min !== "*") {
    return i18n.t("console:viewModels.schedule.daily", { time: `${hour}:${min.padStart(2, "0")}` });
  }
  if (dow !== "*" && dom === "*") {
    return i18n.t("console:viewModels.schedule.weekly", {
      day: dow,
      time: `${hour}:${min.padStart(2, "0")}`,
    });
  }

  return expr;
}
