import { expect, test, vi } from "vitest";
import { CompletionStore } from "../src/state/CompletionStore";
import type { CompletionAttempt } from "../src/model/completionLedger";
const record: CompletionAttempt = { attemptId: "one", sourcePath: "a.md", requestDay: "2026-11-14", requestedAt: 123, beforeEvidence: { status: "open", staged: null, title: "A", completedStatus: "done" }, phase: "pending", pendingCleanupPaths: [] };
test("each failed save reaches its caller while in-memory protection survives", async () => {
 const persist = vi.fn(() => Promise.reject(new Error("disk full")));
 const store = new CompletionStore({ persist }); store.load({});
 await expect(store.saveRecord(record)).rejects.toThrow("disk full"); expect(store.records()).toEqual([record]);
 expect(store.serialize()).toEqual({ completionRecordsVersion: 1, completionRecords: [record] });
});
test("quarantined future data survives other saves and blocks new completion", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() });
 const data = { completionRecordsVersion: 2, completionRecords: { safety: true } }; store.load(data);
 expect(store.available()).toBe(false); expect(store.serialize()).toEqual(data);
 await expect(store.saveRecord(record)).rejects.toThrow();
});
test("capacity never evicts unresolved safety intents", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve(), capacity: 1 }); store.load({});
 await store.saveRecord(record);
 expect(store.available()).toBe(false);
 await expect(store.saveRecord({ ...record, attemptId: "two", sourcePath: "b.md" })).rejects.toThrow();
 expect(store.records()).toEqual([record]);
});
test("returned records cannot mutate protection and initialized empty history remains explicit", () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({ completionRecordsVersion: 1, completionRecords: [] });
 expect(store.serialize()).toEqual({ completionRecordsVersion: 1, completionRecords: [] });
});
test("confirmed recurring replay protection is never evicted at capacity", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve(), capacity: 1 }); store.load({});
 await store.saveRecord({ ...record, phase: "confirmed", completedPath: record.sourcePath, completedAt: 123, replayProtected: true });
 expect(store.available()).toBe(false);
 await expect(store.saveRecord({ ...record, attemptId: "two", sourcePath: "b.md" })).rejects.toThrow();
 expect(store.records()[0]?.attemptId).toBe("one");
});
test("snapshot reads never create daily history or persist data, and preserve legacy observations", async () => {
 const persist = vi.fn(() => Promise.resolve()); const store = new CompletionStore({ persist }); store.load({});
 const task = { path: "a.md", title: "A", status: "done", archived: false, staged: "2026-11-14" };
 await store.observe([task], new Set(["done"])); await store.observe([task], new Set(["done"]));
 expect(store.serialize()).toEqual({}); expect(persist).not.toHaveBeenCalled();
 expect(store.isCompletedSource("a.md", "2026-11-14")).toBe(true);
 await store.observe([{ ...task, status: "open" }], new Set(["done"]));
 expect(store.isCompletedSource("a.md", "2026-11-14")).toBe(false);
});

test("confirmed recurring sources stay hidden across calendar days until restaged", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({});
 const parent = { path: "series.md", title: "Series", status: "open", archived: false, recurrence: "FREQ=DAILY", complete_instances: ["2026-11-14"] };
 await store.observe([parent], new Set(["done"]));
 expect(store.isCompletedSource(parent.path, "2026-11-14")).toBe(true);
 expect(store.isCompletedSource(parent.path, "2026-11-15")).toBe(false);
});

test("external recurring completion since staging hides the source without collecting history", async () => {
	const persist = vi.fn(() => Promise.resolve()); const store = new CompletionStore({ persist }); store.load({});
	const parent = { path: "series.md", title: "Series", status: "open", archived: false, recurrence: "FREQ=DAILY", complete_instances: ["2026-11-11"] };
	await store.observe([parent], new Set(["done"]));
	expect(store.isCompletedSource(parent.path, "2026-11-12", "2026-11-15")).toBe(false);
	const child = { path: "actual.md", title: "Actual", status: "done", archived: false, recurrence_parent: "[[series]]", occurrence_date: "2026-11-15" };
	await store.observe([parent, child], new Set(["done"]));
	expect(store.isCompletedSource(parent.path, "2026-11-12", "2026-11-15")).toBe(true);
	expect(store.isCompletedSource(parent.path, "2026-11-16", "2026-11-16")).toBe(false);
	expect(persist).not.toHaveBeenCalled(); expect(store.serialize()).toEqual({});
});
