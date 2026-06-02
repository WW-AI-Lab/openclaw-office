/**
 * Skill A2UI context injection for chat sessions.
 *
 * When a user's message references a workspace skill (e.g. "使用Skill X" or
 * "Use Skill X"), this module detects the reference, loads the skill's
 * `ui.json` from the workspace API, and injects the form content into the
 * chat session as system context — instructing the AI to present the form as
 * a ```a2ui code block so the frontend can render it as an interactive form.
 */

import { workspaceSkillsGet } from "@/gateway/workspace-skills-client";
import { getAdapter } from "@/gateway/adapter-provider";

const UI_JSON_FILE = "ui.json";

/**
 * Patterns that indicate a user is referencing a skill.
 * Captures the skill slug from the message.
 *
 * Supported formats:
 *   - 使用Skill data-analyst
 *   - Use Skill data-analyst
 *   - /skill data-analyst
 *   - 技能 data-analyst
 *   - 使用技能 data-analyst
 */
const SKILL_REF_PATTERNS: RegExp[] = [
  /[使用Use]+\s*[Ss]kill\s+([\w-]+)/u,
  /\/skill\s+([\w-]+)/i,
  /[使用]+技能\s+([\w-]+)/u,
];

/**
 * Detect a skill slug reference in the user's message.
 * Returns the first matching slug, or null if no reference is found.
 */
export function detectSkillReference(text: string): string | null {
  const trimmed = text.trim();
  for (const pattern of SKILL_REF_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Try to load `ui.json` for the given skill slug from the workspace API.
 * Returns the raw JSON string if the file exists, or null otherwise.
 */
export async function loadSkillUiJson(skillSlug: string): Promise<string | null> {
  try {
    const result = await workspaceSkillsGet(skillSlug, UI_JSON_FILE);
    const content = result.file?.content?.trim();
    if (!content) return null;
    // Quick sanity check: must be parseable JSON with a "fields" array.
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) return null;
    return content;
  } catch {
    // ui.json does not exist or is unreadable.
    return null;
  }
}

/**
 * Build the system context message that instructs the AI to present the
 * A2UI form. The AI should output a ```a2ui code block with the form
 * content, then wait for the user to submit before proceeding.
 */
function buildA2uiInjectionMessage(skillSlug: string, uiJsonContent: string): string {
  return [
    `[系统：用户正在调用 Skill ${skillSlug}，该 Skill 已有 ui.json 首次交互表单]`,
    "请严格按以下步骤操作：",
    `1. 在回复的最开始，输出一个 \`\`\`a2ui 代码块，内容为下方的 JSON（原样输出，不要修改）：`,
    "",
    "```a2ui",
    uiJsonContent,
    "```",
    "",
    "2. 等待用户填写表单并提交后，根据提交的结构化数据继续执行 Skill 任务。",
    "3. 不要跳过表单直接开始任务；不要将表单改写为其他格式（纯文字追问、Markdown 卡片、HTML 等）。",
  ].join("\n");
}

/**
 * Detect a skill reference in the user's message and, if the skill has a
 * `ui.json`, inject the form content into the chat session as system context.
 *
 * This ensures the AI will present the A2UI form as a ```a2ui code block
 * in its first response, rather than proceeding with plain text.
 *
 * @returns The detected skill slug if injection was performed, null otherwise.
 */
export async function injectSkillA2uiContext(
  sessionKey: string,
  userMessage: string,
): Promise<string | null> {
  const skillSlug = detectSkillReference(userMessage);
  if (!skillSlug) return null;

  const uiJsonContent = await loadSkillUiJson(skillSlug);
  if (!uiJsonContent) return null;

  const injectionMessage = buildA2uiInjectionMessage(skillSlug, uiJsonContent);
  try {
    const adapter = getAdapter();
    await adapter.chatInject(sessionKey, injectionMessage);
  } catch {
    // Injection failures are non-critical; the AI might still produce the
    // form on its own if the SKILL.md hint is correct.
  }

  return skillSlug;
}
