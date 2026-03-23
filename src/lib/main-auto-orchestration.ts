export const MAIN_AUTOMATION_RAW_PREFIX = "/raw ";
export const MAIN_AUTOMATION_MAX_AUTO_CONTINUES = 12;
export const MAIN_AUTOMATION_CONTINUE_PROMPT =
  "继续执行上一轮剩余工作。不要重新规划，不要停在解释层。继续分派、实现、优化和测试，直到全部完成。只有在所有交付都完成时才输出 STATUS: COMPLETE，否则输出 STATUS: CONTINUE。";

export interface MainAutomationOptions {
  enabled: boolean;
  hostLabel?: string;
  codeOutputDirectory?: string;
  resourceOutputDirectory?: string;
}

export interface PreparedMainAutomationMessage {
  text: string;
  automated: boolean;
}

export type MainAutomationStatus = "continue" | "complete" | "unknown";

function buildEnvironmentLines(options: MainAutomationOptions): string[] {
  const lines: string[] = [];

  if (options.hostLabel?.trim()) {
    lines.push(`- OpenClaw 主机: ${options.hostLabel.trim()}`);
  }
  if (options.codeOutputDirectory?.trim()) {
    lines.push(`- 代码输出目录: ${options.codeOutputDirectory.trim()}`);
  }
  if (options.resourceOutputDirectory?.trim()) {
    lines.push(`- 资源输出目录: ${options.resourceOutputDirectory.trim()}`);
  }

  return lines;
}

export function buildMainAutomationPrompt(task: string, options: MainAutomationOptions): string {
  const environmentLines = buildEnvironmentLines(options);
  const environmentBlock = environmentLines.length > 0
    ? `\n远端环境约束：\n${environmentLines.join("\n")}\n`
    : "";

  return [
    "你是主控 main。这是一个必须执行到底的交付任务，不是只给计划。",
    "",
    "用户原始任务：",
    task.trim(),
    "",
    "强制执行规则：",
    "1. 先调用 sessions_list，确认以下固定会话真实可见：",
    "   - agent:architect:main",
    "   - agent:backend:main",
    "   - agent:frontend:main",
    "   - agent:qa:main",
    "   - agent:devops:main",
    "2. 只使用现有固定会话，用 sessions_send 分派任务；不要创建新的 generic subagent，不要用 sessions_spawn / subagents 作为替代。",
    "3. architect 负责方案拆解、模块边界、数据流、接口契约、A 股业务规则梳理。",
    "4. backend 负责数据采集、监控规则、告警、服务接口、持久化和任务调度。",
    "5. frontend 负责高质量 UI：桌面和移动端都可用，图表和看板清晰，视觉上要有设计感，不要只做普通表单页。",
    "6. qa 负责测试计划、自动化测试、回归验证和可运行性检查。",
    "7. devops 负责运行脚本、环境说明、构建产物、部署与健康检查。",
    "8. 你自己负责协调、检查结果、继续追问、补派返工，直到实现、优化、测试都完成为止。",
    "9. 如果任何固定会话缺失，明确报告缺失项并停止，不要偷偷换成临时角色。",
    "10. 默认目标是做出可运行的最终结果，而不是停留在文档或原型阶段。",
    "11. 你的每次回复最后必须单独输出一行状态标记：未完成时输出 `STATUS: CONTINUE`，全部完成时输出 `STATUS: COMPLETE`。",
    environmentBlock.trimEnd(),
    "",
    "交付要求：",
    "- 产出完整可运行代码",
    "- 完成一轮界面优化和体验优化",
    "- 跑构建、类型检查、测试或至少给出未能执行的原因",
    "- 汇总每个 agent 的结果、改动、验证结论和剩余风险",
    "",
    "现在开始执行，不要只回复计划。先确认固定会话，再立刻分派。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function prepareMainAutomationMessage(
  task: string,
  options: MainAutomationOptions,
): PreparedMainAutomationMessage {
  const trimmed = task.trim();
  if (!trimmed) {
    return { text: "", automated: false };
  }

  if (trimmed.startsWith(MAIN_AUTOMATION_RAW_PREFIX)) {
    return {
      text: trimmed.slice(MAIN_AUTOMATION_RAW_PREFIX.length).trim(),
      automated: false,
    };
  }

  if (!options.enabled) {
    return { text: trimmed, automated: false };
  }

  return {
    text: buildMainAutomationPrompt(trimmed, options),
    automated: true,
  };
}

export function getMainAutomationStatus(text: string): MainAutomationStatus {
  const normalized = text.toUpperCase();

  if (normalized.includes("STATUS: COMPLETE")) {
    return "complete";
  }

  if (normalized.includes("STATUS: CONTINUE")) {
    return "continue";
  }

  return "unknown";
}
