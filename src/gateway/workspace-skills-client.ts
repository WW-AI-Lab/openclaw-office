import type { AgentFileContent, AgentFilesListResult } from "@/gateway/adapter-types";

const WORKSPACE_SKILLS_API_BASE = "/api/workspace-skills";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Workspace skills request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function workspaceSkillsList(skillSlug: string): Promise<AgentFilesListResult> {
  const url = `${WORKSPACE_SKILLS_API_BASE}/list?slug=${encodeURIComponent(skillSlug)}`;
  return requestJson<AgentFilesListResult>(url);
}

export function workspaceSkillsGet(skillSlug: string, name: string): Promise<AgentFileContent> {
  const url = `${WORKSPACE_SKILLS_API_BASE}/file?slug=${encodeURIComponent(skillSlug)}&name=${encodeURIComponent(name)}`;
  return requestJson<AgentFileContent>(url);
}

export interface WorkspaceSkillsSaveResult {
  agentId: string;
  file: { name: string; size: number; modifiedAt: string };
}

export function workspaceSkillsSave(
  skillSlug: string,
  name: string,
  content: string,
): Promise<WorkspaceSkillsSaveResult> {
  return requestJson<WorkspaceSkillsSaveResult>(`${WORKSPACE_SKILLS_API_BASE}/save`, {
    method: "POST",
    body: JSON.stringify({ slug: skillSlug, name, content }),
  });
}

export interface WorkspaceSkillsCommitResult {
  committed: boolean;
  commit?: string;
  reason?: "not_a_git_repo" | "nothing_to_commit" | "failure";
  error?: string;
}

export function workspaceSkillsCommit(
  skillSlug: string,
  name: string,
  message?: string,
): Promise<WorkspaceSkillsCommitResult> {
  return requestJson<WorkspaceSkillsCommitResult>(`${WORKSPACE_SKILLS_API_BASE}/commit`, {
    method: "POST",
    body: JSON.stringify({ slug: skillSlug, name, message }),
  });
}

export type WorkspaceSkillEnsureStatus = "present" | "installed" | "missing_bundle" | "error";

export interface WorkspaceSkillEnsureResult {
  slug: string;
  status: WorkspaceSkillEnsureStatus;
  error?: string;
}

export interface WorkspaceSkillsEnsureDefaultsResponse {
  results: WorkspaceSkillEnsureResult[];
}

/**
 * Ask the embedded server to ensure the given default skills are installed
 * into ~/.openclaw/workspace/skills/. If a skill is missing, the server
 * will copy it from the bundled skills shipped with the npm package.
 *
 * Pass an empty `slugs` list or omit it to use the server-side defaults
 * (currently: skill-workbench-mermaid-guard).
 */
export function workspaceSkillsEnsureDefaults(
  slugs?: readonly string[],
): Promise<WorkspaceSkillsEnsureDefaultsResponse> {
  return requestJson<WorkspaceSkillsEnsureDefaultsResponse>(
    `${WORKSPACE_SKILLS_API_BASE}/ensure-defaults`,
    {
      method: "POST",
      body: JSON.stringify({ slugs: slugs ?? [] }),
    },
  );
}
