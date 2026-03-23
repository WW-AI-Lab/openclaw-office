export const GROUP_CHAT_TARGET_ID = "__main_group__";
export const GROUP_CHAT_SESSION_KEY = "group:main";
export const ALL_AGENTS_MENTION = "all";
export const ALL_AGENTS_MENTION_ALIASES = [ALL_AGENTS_MENTION, "everyone", "所有人"];

export interface MentionableAgent {
  id: string;
  name: string;
}

export interface GroupMentionParseResult {
  agentIds: string[];
  cleanedText: string;
}

export function isGroupTargetAgentId(agentId: string | null | undefined): boolean {
  return agentId === GROUP_CHAT_TARGET_ID;
}

export function isGroupSessionKey(sessionKey: string | null | undefined): boolean {
  return typeof sessionKey === "string" && sessionKey.startsWith("group:");
}

export function getGroupRoomId(groupSessionKey: string): string {
  if (!isGroupSessionKey(groupSessionKey)) {
    return "main";
  }

  if (groupSessionKey === GROUP_CHAT_SESSION_KEY) {
    return "main";
  }

  const rawRoomId = groupSessionKey.slice("group:".length);
  const sanitized = rawRoomId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "main";
}

export function buildGroupRelaySessionKey(agentId: string, groupSessionKey = GROUP_CHAT_SESSION_KEY): string {
  return `agent:${agentId}:group-${getGroupRoomId(groupSessionKey)}`;
}

export function extractAgentIdFromSessionKey(sessionKey: string | null | undefined): string | null {
  if (!sessionKey) {
    return null;
  }

  const match = sessionKey.match(/^agent:([^:]+):/);
  return match?.[1] ?? null;
}

export function parseGroupMentions(
  text: string,
  agents: MentionableAgent[],
): GroupMentionParseResult {
  const agentIndex = new Map<string, string>();

  for (const agent of agents) {
    const normalizedId = normalizeMentionToken(agent.id);
    const normalizedName = normalizeMentionToken(agent.name);
    agentIndex.set(normalizedId, agent.id);
    agentIndex.set(normalizedName, agent.id);
  }

  const mentionedAgentIds: string[] = [];
  const mentionRegex = /(^|\s)@([^\s@]+)/gu;
  let match: RegExpExecArray | null = null;

  while ((match = mentionRegex.exec(text)) !== null) {
    const normalizedToken = normalizeMentionToken(match[2]);
    if (!normalizedToken) {
      continue;
    }

    if (isAllAgentsMentionToken(normalizedToken)) {
      for (const agent of agents) {
        if (!mentionedAgentIds.includes(agent.id)) {
          mentionedAgentIds.push(agent.id);
        }
      }
      continue;
    }

    const agentId = agentIndex.get(normalizedToken);
    if (agentId && !mentionedAgentIds.includes(agentId)) {
      mentionedAgentIds.push(agentId);
    }
  }

  const cleanedText = text
    .replace(mentionRegex, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    agentIds: mentionedAgentIds,
    cleanedText,
  };
}

export function isAllAgentsMentionToken(value: string): boolean {
  const normalized = normalizeMentionToken(value);
  return ALL_AGENTS_MENTION_ALIASES.some((alias) => normalizeMentionToken(alias) === normalized);
}

export function normalizeMentionToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "");
}
