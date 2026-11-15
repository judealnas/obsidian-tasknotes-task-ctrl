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
test("external completion retains first-observed chronology and clears at rollover without rediscovery", async () => {
 const persist = vi.fn(() => Promise.resolve()); const store = new CompletionStore({ persist }); store.load({});
 const open = { path: "a.md", title: "A", status: "open", archived: false, staged: "2026-11-14" };
 await store.observe([open], new Set(["done"]), "2026-11-14", 10);
 const done = { ...open, status: "done", completedDate: "2026-11-14", staged: null };
 await store.observe([done], new Set(["done"]), "2026-11-14", 20);
 await store.observe([done], new Set(["done"]), "2026-11-14", 30);
 expect(store.getDoneToday("2026-11-14")).toMatchObject([{ completedAt: 20 }]);
 store.rollover("2026-11-15"); await store.observe([done], new Set(["done"]), "2026-11-15", 40);
 expect(store.getDoneToday("2026-11-15")).toEqual([]);
 store.rollover("2026-11-14"); expect(store.getDoneToday("2026-11-14")).toEqual([]);
 const restarted = new CompletionStore({ persist }); restarted.load(store.serialize());
 await restarted.observe([done], new Set(["done"]), "2026-11-14", 50);
 expect(restarted.getDoneToday("2026-11-14")).toEqual([]);
});
test("external reopen removes the row and a new completion gets a new observation time", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({});
 const task = { path: "a.md", title: "A", status: "done", archived: false, staged: "2026-11-14", completedDate: "2026-11-14" };
 await store.observe([task], new Set(["done"]), "2026-11-14", 10);
 expect(store.getDoneToday("2026-11-14")).toHaveLength(1);
 await store.observe([{ ...task, status: "open" }], new Set(["done"]), "2026-11-14", 20);
 expect(store.getDoneToday("2026-11-14")).toEqual([]);
 await store.observe([task], new Set(["done"]), "2026-11-14", 30);
 expect(store.getDoneToday("2026-11-14")[0]?.completedAt).toBe(30);
});
test("reopening a pane-completed task invalidates its old timestamp before external recompletion", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({});
 await store.saveRecord({ ...record, phase: "confirmed", completedPath: record.sourcePath, completedAt: 5, beforeEvidence: { ...record.beforeEvidence, staged: "2026-11-14" } });
 const task = { path: "a.md", title: "A", status: "done", archived: false, staged: "2026-11-14", completedDate: "2026-11-14" };
 await store.observe([task], new Set(["done"]), "2026-11-14", 10); expect(store.getDoneToday("2026-11-14")[0]?.completedAt).toBe(5);
 await store.observe([{ ...task, status: "open" }], new Set(["done"]), "2026-11-14", 20);
 await store.observe([task], new Set(["done"]), "2026-11-14", 30); expect(store.getDoneToday("2026-11-14")[0]?.completedAt).toBe(30);
});

test("cold-start date-only history stays on its historical day across restart", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({});
 const task = { path: "old.md", title: "Old", status: "done", archived: false, staged: "2026-11-12", completedDate: "2026-11-13" };
 await store.observe([task], new Set(["done"]), "2026-11-14", 10);
 expect(store.getDoneToday("2026-11-14")).toEqual([]);
 const restarted = new CompletionStore({ persist: () => Promise.resolve() }); restarted.load(store.serialize());
 await restarted.observe([task], new Set(["done"]), "2026-11-15", 20);
 expect(restarted.getDoneToday("2026-11-15")).toEqual([]);
});

test("late prior-day pane confirmation never becomes today's external observation", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({});
 const task = { path: "a.md", title: "A", status: "done", archived: false, staged: "2026-11-14" };
 store.rollover("2026-11-15", 20);
 await store.saveRecord({ ...record, phase: "confirmed", completedPath: "a.md", completedAt: 15, beforeEvidence: { ...record.beforeEvidence, staged: "2026-11-14" } });
 await store.observe([task], new Set(["done"]), "2026-11-15", 30);
 expect(store.getDoneToday("2026-11-15")).toEqual([]);
});

test("parent and materialized note yield one completion and open materialized status wins", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({});
 const parent = { path: "series.md", title: "Series", status: "open", archived: false, recurrence: "FREQ=DAILY", staged: "2026-11-14", complete_instances: ["2026-11-14"] };
 const child = { path: "actual.md", title: "Actual", status: "done", archived: false, recurrence_parent: "[[series]]", occurrence_date: "2026-11-14", staged: "2026-11-14" };
 await store.observe([parent, child], new Set(["done"]), "2026-11-14", 10);
 expect(store.getDoneToday("2026-11-14")).toMatchObject([{ completedPath: child.path }]);
 await store.observe([parent, { ...child, status: "open" }], new Set(["done"]), "2026-11-14", 20);
 expect(store.getDoneToday("2026-11-14")).toEqual([]);
});

test("a staged parent includes an externally completed materialized note even without parent history", async () => {
 const store = new CompletionStore({ persist: () => Promise.resolve() }); store.load({});
 const parent = { path: "series.md", title: "Series", status: "open", archived: false, recurrence: "FREQ=DAILY", staged: "2026-11-14", complete_instances: [] };
 const child = { path: "actual.md", title: "Actual", status: "done", archived: false, recurrence_parent: "[[series]]", occurrence_date: "2026-11-14", staged: null };
 await store.observe([parent, child], new Set(["done"]), "2026-11-14", 10);
 expect(store.getDoneToday("2026-11-14")).toMatchObject([{ completedPath: child.path }]);
});
