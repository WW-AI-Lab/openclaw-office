import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalPersistence } from "../local-persistence";
import type { ChatDockMessage } from "@/store/console-stores/chat-dock-store";
import type { EventHistoryItem } from "@/gateway/types";

function makeMsg(id: string, ts: number, role: "user" | "assistant" = "user"): ChatDockMessage {
  return { id, role, content: `msg-${id}`, timestamp: ts };
}

function makeEvent(ts: number, agentId = "a1"): EventHistoryItem {
  return { timestamp: ts, agentId, agentName: agentId, stream: "lifecycle", summary: `event-${ts}` };
}

describe("LocalPersistence", () => {
  let lp: LocalPersistence;

  beforeEach(async () => {
    lp = new LocalPersistence({ dbName: `test-db-${Date.now()}` });
    await lp.open();
  });

  afterEach(() => {
    lp.close();
  });

  describe("open / close", () => {
    it("opens without error", async () => {
      const lp2 = new LocalPersistence({ dbName: `test-open-${Date.now()}` });
      await expect(lp2.open()).resolves.toBeUndefined();
      lp2.close();
    });

    it("double open is safe", async () => {
      await expect(lp.open()).resolves.toBeUndefined();
    });
  });

  describe("chat messages", () => {
    it("getMessages returns empty for unknown session", async () => {
      const msgs = await lp.getMessages("unknown");
      expect(msgs).toEqual([]);
    });

    it("saveMessage + getMessages round-trip", async () => {
      const msg = makeMsg("m1", 1000);
      await lp.saveMessage("s1", msg);
      const result = await lp.getMessages("s1");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("m1");
      expect(result[0].content).toBe("msg-m1");
    });

    it("saveMessages overwrites session data", async () => {
      await lp.saveMessage("s1", makeMsg("old1", 100));
      await lp.saveMessages("s1", [makeMsg("new1", 200), makeMsg("new2", 300)]);
      const result = await lp.getMessages("s1");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("new1");
      expect(result[1].id).toBe("new2");
    });

    it("messages are isolated by sessionKey", async () => {
      await lp.saveMessage("s1", makeMsg("m1", 100));
      await lp.saveMessage("s2", makeMsg("m2", 200));
      expect(await lp.getMessages("s1")).toHaveLength(1);
      expect(await lp.getMessages("s2")).toHaveLength(1);
    });

    it("clearMessages removes session data", async () => {
      await lp.saveMessage("s1", makeMsg("m1", 100));
      await lp.clearMessages("s1");
      expect(await lp.getMessages("s1")).toEqual([]);
    });

    it("enforces maxMessagesPerSession", async () => {
      const lp3 = new LocalPersistence({
        dbName: `test-limit-${Date.now()}`,
        maxMessagesPerSession: 3,
      });
      await lp3.open();
      for (let i = 0; i < 5; i++) {
        await lp3.saveMessage("s1", makeMsg(`m${i}`, 100 + i));
      }
      const result = await lp3.getMessages("s1");
      expect(result.length).toBeLessThanOrEqual(3);
      lp3.close();
    });
  });

  describe("events", () => {
    it("getEvents returns empty initially", async () => {
      expect(await lp.getEvents()).toEqual([]);
    });

    it("saveEvent + getEvents round-trip", async () => {
      await lp.saveEvent(makeEvent(1000));
      const result = await lp.getEvents();
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe("event-1000");
    });

    it("getEvents with limit returns latest", async () => {
      for (let i = 0; i < 5; i++) {
        await lp.saveEvent(makeEvent(1000 + i));
      }
      const result = await lp.getEvents(3);
      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toBe(1002);
    });

    it("saveEvents batch", async () => {
      await lp.saveEvents([makeEvent(100), makeEvent(200), makeEvent(300)]);
      expect(await lp.getEvents()).toHaveLength(3);
    });

    it("clearEvents removes all", async () => {
      await lp.saveEvent(makeEvent(100));
      await lp.clearEvents();
      expect(await lp.getEvents()).toEqual([]);
    });

    it("enforces maxEvents", async () => {
      const lp4 = new LocalPersistence({
        dbName: `test-event-limit-${Date.now()}`,
        maxEvents: 3,
      });
      await lp4.open();
      for (let i = 0; i < 5; i++) {
        await lp4.saveEvent(makeEvent(100 + i));
      }
      const result = await lp4.getEvents();
      expect(result.length).toBeLessThanOrEqual(3);
      lp4.close();
    });
  });

  describe("cleanup", () => {
    it("removes expired messages", async () => {
      const lp5 = new LocalPersistence({
        dbName: `test-cleanup-${Date.now()}`,
        messageExpireDays: 0,
      });
      await lp5.open();
      await lp5.saveMessage("s1", makeMsg("m1", Date.now() - 100_000));
      await lp5.cleanup();
      expect(await lp5.getMessages("s1")).toEqual([]);
      lp5.close();
    });

    it("removes expired events", async () => {
      const lp6 = new LocalPersistence({
        dbName: `test-cleanup-events-${Date.now()}`,
        eventExpireDays: 0,
      });
      await lp6.open();
      await lp6.saveEvent(makeEvent(Date.now() - 100_000));
      await lp6.cleanup();
      expect(await lp6.getEvents()).toEqual([]);
      lp6.close();
    });
  });

  describe("getStorageEstimate", () => {
    it("returns numeric values", async () => {
      const est = await lp.getStorageEstimate();
      expect(typeof est.usage).toBe("number");
      expect(typeof est.quota).toBe("number");
    });
  });
});
