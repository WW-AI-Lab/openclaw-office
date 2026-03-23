import type { AgentPathSettingKey, AgentPathSettings } from "@/store/console-stores/settings-store";

export interface AgentPathDefinition {
  key: AgentPathSettingKey;
  consoleLabelKey: string;
  consolePlaceholderKey: string;
  chatLabelKey: string;
}

export const AGENT_PATH_DEFINITIONS: AgentPathDefinition[] = [
  {
    key: "codeOutputDirectory",
    consoleLabelKey: "settings.workspacePaths.codeOutputDirectory",
    consolePlaceholderKey: "settings.workspacePaths.codeOutputPlaceholder",
    chatLabelKey: "dock.pathReferenceCodeOutput",
  },
  {
    key: "resourceOutputDirectory",
    consoleLabelKey: "settings.workspacePaths.resourceOutputDirectory",
    consolePlaceholderKey: "settings.workspacePaths.resourceOutputPlaceholder",
    chatLabelKey: "dock.pathReferenceResourceOutput",
  },
];

export function getConfiguredAgentPaths(agentPaths: AgentPathSettings): Array<{
  key: AgentPathSettingKey;
  value: string;
}> {
  return AGENT_PATH_DEFINITIONS.flatMap((definition) => {
    const value = agentPaths[definition.key].trim();
    return value ? [{ key: definition.key, value }] : [];
  });
}

export function buildChatPathReference(label: string, path: string, hostReference?: string): string {
  const lines: string[] = [];

  if (hostReference) {
    lines.push(hostReference);
  }

  lines.push(`${label}: \`${path}\``);
  return lines.join("\n");
}

export function buildChatPathReferenceBundle(references: string[]): string {
  return references.filter(Boolean).join("\n");
}

export function appendChatPathReference(input: string, reference: string): string {
  const trimmed = input.trimEnd();
  return trimmed ? `${trimmed}\n${reference}` : reference;
}
