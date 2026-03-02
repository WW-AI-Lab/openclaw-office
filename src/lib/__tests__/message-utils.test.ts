import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ToolCallInfo } from "@/gateway/adapter-types";
import {
  generateMessageId,
  mergeDelta,
  updateToolCall,
  truncateText,
  createBatchScheduler,
} from "../message-utils";

describe("generateMessageId", () => {
  it("returns unique IDs with msg- prefix", () => {
    const id1 = generateMessageId();
    const id2 = generateMessageId();
    expect(id1).toMatch(/^msg-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });
});

describe("mergeDelta", () => {
  it("appends delta text to existing content", () => {
    expect(mergeDelta("Hello", " World")).toBe("Hello World");
  });

  it("returns existing content when delta is empty", () => {
    expect(mergeDelta("Hello", "")).toBe("Hello");
  });

  it("works with empty existing content", () => {
    expect(mergeDelta("", "Start")).toBe("Start");
  });
});

describe("updateToolCall", () => {
  const existing: ToolCallInfo[] = [{ id: "tc-1", name: "web_search", status: "running" }];

  it("updates existing tool call by id", () => {
    const result = updateToolCall(existing, "tc-1", { status: "done", result: "found it" });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("done");
    expect(result[0].result).toBe("found it");
  });

  it("appends new tool call when id not found", () => {
    const result = updateToolCall(existing, "tc-2", { name: "code_exec", status: "pending" });
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe("tc-2");
    expect(result[1].name).toBe("code_exec");
  });

  it("does not mutate original array", () => {
    updateToolCall(existing, "tc-1", { status: "done" });
    expect(existing[0].status).toBe("running");
  });
});

describe("truncateText", () => {
  it("returns full text when within limit", () => {
    expect(truncateText("short", 10)).toBe("short");
  });

  it("truncates and adds ellipsis when over limit", () => {
    expect(truncateText("this is a long text", 10)).toBe("this is a …");
  });

  it("handles exact length", () => {
    expect(truncateText("exact", 5)).toBe("exact");
  });
});

describe("createBatchScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches multiple deltas within batchMs", () => {
    const flush = vi.fn();
    const scheduler = createBatchScheduler(flush, { batchMs: 50, maxDelayMs: 100 });

    scheduler.push("a");
    scheduler.push("b");
    scheduler.push("c");

    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(flush).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledWith("abc");

    scheduler.destroy();
  });

  it("forces flush at maxDelayMs", () => {
    const flush = vi.fn();
    const scheduler = createBatchScheduler(flush, { batchMs: 50, maxDelayMs: 100 });

    scheduler.push("a");
    vi.advanceTimersByTime(40);
    scheduler.push("b");
    vi.advanceTimersByTime(40);
    scheduler.push("c");

    // maxDelay of 100ms should have fired by now (100ms since first push)
    vi.advanceTimersByTime(20);
    expect(flush).toHaveBeenCalled();

    scheduler.destroy();
  });

  it("flushes remaining on destroy", () => {
    const flush = vi.fn();
    const scheduler = createBatchScheduler(flush, { batchMs: 50, maxDelayMs: 100 });

    scheduler.push("pending");
    scheduler.destroy();

    expect(flush).toHaveBeenCalledWith("pending");
  });

  it("does nothing after destroy", () => {
    const flush = vi.fn();
    const scheduler = createBatchScheduler(flush, { batchMs: 50, maxDelayMs: 100 });

    scheduler.destroy();
    scheduler.push("ignored");

    vi.advanceTimersByTime(200);
    // Only the destroy flush (empty), no additional calls
    expect(flush).toHaveBeenCalledTimes(0);
  });
});
