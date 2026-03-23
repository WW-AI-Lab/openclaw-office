import { isGroupSessionKey } from "@/lib/group-chat";

export function formatSessionName(key: string, groupLabel: string): string {
  if (isGroupSessionKey(key)) {
    return groupLabel;
  }

  const parts = key.split(":");
  if (parts.length >= 3 && parts[0] === "agent") {
    const suffix = parts.slice(2).join(":");
    if (suffix === "main") {
      return parts[1];
    }

    return suffix.length > 20 ? `${suffix.slice(0, 20)}…` : suffix;
  }

  return key.length > 15 ? `${key.slice(0, 15)}…` : key;
}

export function formatRelativeTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) {
    return "—";
  }

  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins}m`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d`;
}
