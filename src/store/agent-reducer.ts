import type { ParsedAgentEvent } from "@/gateway/event-parser";
import type { AgentVisualStatus, VisualAgent } from "@/gateway/types";

const MIN_ACTIVE_DISPLAY_MS = 5_000;

const deferredIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastActiveTimestamps = new Map<string, number>();

function isVisuallyActive(status: AgentVisualStatus): boolean {
  return (
    status === "thinking" ||
    status === "tool_calling" ||
    status === "speaking" ||
    status === "spawning" ||
    status === "error"
  );
}

export function applyEventToAgent(agent: VisualAgent, parsed: ParsedAgentEvent): void {
  const now = Date.now();

  if (isVisuallyActive(parsed.status)) {
    clearDeferredIdle(agent.id);
    lastActiveTimestamps.set(agent.id, now);
    agent.status = parsed.status;
  } else if (parsed.status === "idle") {
    const lastActive = lastActiveTimestamps.get(agent.id) ?? 0;
    const elapsed = now - lastActive;

    if (isVisuallyActive(agent.status) && elapsed < MIN_ACTIVE_DISPLAY_MS) {
      scheduleDeferredIdle(agent, MIN_ACTIVE_DISPLAY_MS - elapsed);
    } else {
      agent.status = "idle";
      lastActiveTimestamps.delete(agent.id);
    }
  } else {
    agent.status = parsed.status;
  }

  agent.lastActiveAt = now;

  if (parsed.currentTool) {
    agent.currentTool = parsed.currentTool;
  }
  if (parsed.clearTool && agent.status === "idle") {
    agent.currentTool = null;
  }

  if (parsed.speechBubble) {
    agent.speechBubble = parsed.speechBubble;
  }
  if (parsed.clearSpeech && agent.status === "idle") {
    agent.speechBubble = null;
  }

  if (parsed.incrementToolCount) {
    agent.toolCallCount++;
  }

  if (parsed.toolRecord) {
    agent.toolCallHistory = [parsed.toolRecord, ...agent.toolCallHistory.slice(0, 9)];
  }

  if (parsed.runId && !agent.runId) {
    agent.runId = parsed.runId;
  }
}

let deferredIdleCallback: ((agentId: string) => void) | null = null;

export function setDeferredIdleCallback(cb: (agentId: string) => void): void {
  deferredIdleCallback = cb;
}

function scheduleDeferredIdle(agent: VisualAgent, delayMs: number): void {
  clearDeferredIdle(agent.id);
  const agentId = agent.id;
  const timer = setTimeout(() => {
    deferredIdleTimers.delete(agentId);
    deferredIdleCallback?.(agentId);
  }, delayMs);
  deferredIdleTimers.set(agentId, timer);
}

function clearDeferredIdle(agentId: string): void {
  const timer = deferredIdleTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    deferredIdleTimers.delete(agentId);
  }
}

export function cancelAllDeferredIdle(): void {
  for (const timer of deferredIdleTimers.values()) {
    clearTimeout(timer);
  }
  deferredIdleTimers.clear();
}

export function getLastActiveTimestamp(agentId: string): number {
  return lastActiveTimestamps.get(agentId) ?? 0;
}
