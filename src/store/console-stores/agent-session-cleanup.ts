import type { GatewayAdapter } from "@/gateway/adapter";

const CHANNEL_SESSION_PREFIXES = [
  "feishu",
  "dingtalk",
  "telegram",
  "discord",
  "slack",
  "whatsapp",
  "signal",
  "imessage",
  "matrix",
  "line",
  "msteams",
  "googlechat",
  "mattermost",
  "irc",
  "nostr",
  "nextcloud-talk",
  "bluebubbles",
  "synology-chat",
  "zalo",
  "zalouser",
  "tlon",
] as const;

function isChannelSessionKeyForAgent(sessionKey: string, agentId: string): boolean {
  const normalized = sessionKey.trim();
  const agentPrefix = `agent:${agentId}:`;
  if (!normalized.startsWith(agentPrefix)) {
    return false;
  }

  const remainder = normalized.slice(agentPrefix.length);
  return CHANNEL_SESSION_PREFIXES.some((channel) => remainder.startsWith(`${channel}:`));
}

export async function clearAgentChannelSessions(
  adapter: GatewayAdapter,
  agentId: string,
): Promise<number> {
  const sessions = await adapter.sessionsList();
  const keys = sessions
    .map((session) => session.key)
    .filter((key) => isChannelSessionKeyForAgent(key, agentId));

  for (const key of keys) {
    await adapter.sessionsDelete(key);
  }

  return keys.length;
}
