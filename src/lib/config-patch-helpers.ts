import type { GatewayAdapter } from "@/gateway/adapter";

interface AgentConfigEntry extends Record<string, unknown> {
  id: string;
  tools?: Record<string, unknown>;
  skills?: string[];
}

export interface PatchResult {
  ok: boolean;
  error?: string;
  restart?: { scheduled: boolean; delayMs: number };
}

export function extractAgentConfig(
  config: Record<string, unknown>,
  agentId: string,
): AgentConfigEntry | undefined {
  const agents = config.agents as Record<string, unknown> | undefined;
  if (!agents) return undefined;
  const list = agents.list as AgentConfigEntry[] | undefined;
  if (!Array.isArray(list)) return undefined;
  return list.find((entry) => entry.id === agentId);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export async function patchAgentToolsConfig(
  adapter: GatewayAdapter,
  agentId: string,
  toolsConfig: Record<string, unknown>,
  baseHash?: string,
): Promise<PatchResult> {
  try {
    const snapshot = await adapter.configGet();
    const config = snapshot.config;
    const agent = extractAgentConfig(config, agentId);
    if (!agent) return { ok: false, error: "agent_not_found" };

    const updated = deepClone(config);
    const updatedAgents = updated.agents as Record<string, unknown>;
    const updatedList = updatedAgents.list as AgentConfigEntry[];
    const idx = updatedList.findIndex((e) => e.id === agentId);
    if (idx < 0) return { ok: false, error: "agent_not_found" };

    updatedList[idx] = { ...updatedList[idx], tools: toolsConfig };

    const result = await adapter.configSet(
      JSON.stringify(updated),
      baseHash ?? snapshot.hash,
    );
    if (!result.ok) {
      return { ok: false, error: result.error ?? "conflict" };
    }
    return { ok: true, restart: result.restart ?? undefined };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function patchAgentSkillsConfig(
  adapter: GatewayAdapter,
  agentId: string,
  skills: string[] | null,
  baseHash?: string,
): Promise<PatchResult> {
  try {
    const snapshot = await adapter.configGet();
    const config = snapshot.config;
    const agent = extractAgentConfig(config, agentId);
    if (!agent) return { ok: false, error: "agent_not_found" };

    const updated = deepClone(config);
    const updatedAgents = updated.agents as Record<string, unknown>;
    const updatedList = updatedAgents.list as AgentConfigEntry[];
    const idx = updatedList.findIndex((e) => e.id === agentId);
    if (idx < 0) return { ok: false, error: "agent_not_found" };

    if (skills === null) {
      const { skills: _removed, ...rest } = updatedList[idx];
      updatedList[idx] = rest as AgentConfigEntry;
    } else {
      updatedList[idx] = { ...updatedList[idx], skills };
    }

    const result = await adapter.configSet(
      JSON.stringify(updated),
      baseHash ?? snapshot.hash,
    );
    if (!result.ok) {
      return { ok: false, error: result.error ?? "conflict" };
    }
    return { ok: true, restart: result.restart ?? undefined };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
