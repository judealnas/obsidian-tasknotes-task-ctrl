import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StagingStore, type StagingStoreDeps } from "../src/state/StagingStore";
import { StagedOrderStore } from "../src/state/StagedOrderStore";
import { createFakeGateway } from "./fakes/fakeGateway";
import type { TaskInfo } from "../src/tasknotes/runtime-api.types";
import { CompletionStore } from "../src/state/CompletionStore";

export const stagedTask = (patch: Partial<TaskInfo> & { staged?: unknown } = {}): TaskInfo => ({ path: "A.md", title: "Task A", archived: false, status: "open", staged: "2026-11-12", ...patch });
export function stagingFixture(extra: Partial<StagingStoreDeps> = {}) {
	const gateway = createFakeGateway();
	gateway.setUserFields([{ id: "staged", displayName: "Staged", key: "staged", type: "date" }]);
	gateway.listTasks = vi.fn(() => Promise.resolve([stagedTask()]));
	const store = new StagingStore({ gateway, log: vi.fn(), now: () => new Date(2026, 10, 14, 12).getTime(), schedule: (fn, ms) => { const timers = { setTimeout, clearTimeout }; const id = timers.setTimeout(fn, ms); return () => timers.clearTimeout(id); }, ...extra });
	return { gateway, store };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

test("a completion saved during a task read invalidates that read before observing reopen", async () => {
 const completions = new CompletionStore({ persist: () => Promise.resolve() }); completions.load({});
 const s = stagingFixture({ completions });
 s.gateway.statuses = () => Promise.resolve([{ value: "done", label: "Done", isCompleted: true }]);
 await s.store.refreshNow();
 let release!: (tasks: TaskInfo[]) => void; let reads = 0;
 s.gateway.listTasks = () => ++reads === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve([{ ...stagedTask(), status: "done" }]);
 const read = s.store.refreshNow(); for (let i = 0; i < 5; i++) await Promise.resolve();
 await completions.saveRecord({ attemptId: "one", sourcePath: "A.md", completedPath: "A.md", requestDay: "2026-11-14", requestedAt: 10, completedAt: 10, beforeEvidence: { status: "open", staged: "2026-11-12", title: "A", completedStatus: "done" }, phase: "confirmed", pendingCleanupPaths: [] });
 release([stagedTask()]); await read;
 expect(reads).toBe(2); expect(completions.getDoneToday("2026-11-14")[0]?.completedAt).toBe(10);
 s.store.dispose();
});

test("cached rename and successful Unstage survive day changes while offline", async () => {
 let now = new Date(2026, 10, 14, 12).getTime();
 const s = stagingFixture({ now: () => now }); await s.store.refreshNow();
 s.store.renamePath("A.md", "Renamed.md"); now += 86_400_000; s.store.checkDay();
 expect(s.store.getSnapshot().items[0]?.taskPath).toBe("Renamed.md");
 s.store.removeItem("Renamed.md"); now += 86_400_000; s.store.checkDay();
 expect(s.store.getSnapshot().items).toEqual([]); s.store.dispose();
});

test("cached rollover uses the exact boundary and changed hours even when reads fail", async () => {
 let now = new Date(2026, 10, 14, 3, 59, 59, 999).getTime(); let hour = 4;
 const { store, gateway } = stagingFixture({ now: () => now, getRolloverHour: () => hour }); await store.refreshNow();
 expect(store.getSnapshot().items[0]?.age).toBe(1);
 const reads = vi.spyOn(gateway, "listTasks");
 const before = reads.mock.calls.length; reads.mockRejectedValue(new Error("offline"));
 now++; expect(store.checkDay(now)).toBe(true); expect(store.getSnapshot().items[0]?.age).toBe(2);
 expect(store.checkDay(now)).toBe(false); expect(reads.mock.calls.length).toBe(before);
 hour = 6; expect(store.checkDay(now)).toBe(true); expect(store.getSnapshot().items[0]?.age).toBe(1);
 now = new Date(2026, 10, 18, 12).getTime(); store.checkDay(now); expect(store.getSnapshot().items[0]?.age).toBe(6);
 expect(gateway.updateCalls).toEqual([]); expect(gateway.stopCalls).toEqual([]); store.dispose();
});

test("a prior-day read cannot publish after rollover and the retry uses the new day", async () => {
 let now = new Date(2026, 10, 14, 12).getTime();
 const { store, gateway } = stagingFixture({ now: () => now }); await store.refreshNow();
 let release!: (tasks: TaskInfo[]) => void; let calls = 0;
 gateway.listTasks = () => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve([stagedTask()]);
 const refresh = store.refreshNow(); for (let i = 0; i < 5; i++) await Promise.resolve();
 now = new Date(2026, 10, 17, 12).getTime(); store.checkDay(now); release([stagedTask()]); await refresh;
 expect(calls).toBe(2); expect(store.getSnapshot().items[0]?.age).toBe(5); store.dispose();
});

test("an in-flight refresh revokes registration readiness until its fresh check finishes", async () => {
	const { store, gateway } = stagingFixture(); await store.refreshNow();
	expect(store.getSnapshot().canStage).toBe(true);
	let resolve!: (tasks: TaskInfo[]) => void;
	gateway.listTasks = () => new Promise(done => { resolve = done; });
	const refresh = store.refreshNow(); await Promise.resolve();
	expect(store.getSnapshot().canStage).toBe(false);
	expect(store.getSnapshot().items).toHaveLength(1);
	resolve([]); await refresh; store.dispose();
});

test.each(["listTasks", "statuses", "userFields"] as const)("a failed %s read retains cards, reports uncertainty and never writes", async method => {
	const { store, gateway } = stagingFixture(); await store.refreshNow(); const cards = store.getSnapshot().items;
	const read = vi.spyOn(gateway, method).mockRejectedValue(new Error("offline"));
	await store.refreshNow(); expect(store.getSnapshot().items).toEqual(cards); expect(store.getSnapshot().canStage).toBe(false); expect(store.getSnapshot().warning).not.toBe("");
	read.mockRestore(); await store.refreshNow(); expect(store.getSnapshot().warning).toBe("");
	expect(gateway.updateCalls).toEqual([]); expect(gateway.startCalls).toEqual([]); expect(gateway.stopCalls).toEqual([]); store.dispose();
});
test("initial failure differs from empty success; full paths include hidden tasks", async () => {
	const { store, gateway } = stagingFixture(); const list = vi.spyOn(gateway, "listTasks").mockRejectedValueOnce(new Error("offline"));
	await store.refreshNow(); expect(store.getSnapshot().loaded).toBe(false); expect(store.getSnapshot().warning).not.toBe("");
	list.mockResolvedValue([]); await store.refreshNow(); expect(store.getSnapshot().loaded).toBe(true); expect(store.getSnapshot().authoritativePaths?.size).toBe(0);
	list.mockResolvedValue([stagedTask({ path: "future.md", staged: "2026-12-01" }), stagedTask({ path: "archive.md", archived: true })]);
	await store.refreshNow(); expect(store.getSnapshot().items).toHaveLength(0); expect([...store.getSnapshot().authoritativePaths!]).toEqual(["future.md", "archive.md"]); store.dispose();
});
test("generation invalidation retries a stale success but bridge loss and disposal never publish it", async () => {
	for (const transition of ["invalidate", "disconnect", "dispose"]) {
		const { store, gateway } = stagingFixture(); await store.refreshNow();
		let resolve!: (tasks: TaskInfo[]) => void; const read = vi.spyOn(gateway, "listTasks").mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		const pending = store.refreshNow(); await Promise.resolve();
		if (transition === "invalidate") { store.invalidate(); read.mockResolvedValue([stagedTask({ title: "New" })]); }
		else if (transition === "disconnect") gateway.setState({ kind: "missing" }); else store.dispose();
		resolve([stagedTask({ title: "Stale" })]); await pending;
		expect(store.getSnapshot().items[0]?.task.title).toBe(transition === "invalidate" ? "New" : "Task A");
		if (transition !== "invalidate") expect(store.getSnapshot().canStage).toBe(false);
		store.dispose();
	}
});
test("debounced bursts are single-flight and disposed subscriptions stop reading", async () => {
	const { store, gateway } = stagingFixture(); const list = vi.spyOn(gateway, "listTasks");
	gateway.emitData(); gateway.emitData(); await vi.advanceTimersByTimeAsync(199); expect(list).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(1); expect(list).toHaveBeenCalledTimes(1);
	store.dispose(); gateway.emitData(); await vi.advanceTimersByTimeAsync(1000); expect(list).toHaveBeenCalledTimes(1);
});

test("external arrivals append below priority order once, and filtered or failed reads cannot prune", async () => {
	const persist = vi.fn(() => Promise.resolve()); const order = new StagedOrderStore({ persist, log: vi.fn() }); order.load(["Priority.md", "future.md", "archived.md", "done.md", "unstaged.md"]);
	const s = stagingFixture({ order, fileCheck: () => () => false });
	let tasks = [stagedTask({ path: "Priority.md" }), stagedTask({ path: "future.md", staged: "2026-12-01" }), stagedTask({ path: "archived.md", archived: true }), stagedTask({ path: "done.md", status: "done" }), stagedTask({ path: "unstaged.md", staged: null })];
	s.gateway.statuses = () => Promise.resolve([{ value: "done", isCompleted: true }]); s.gateway.listTasks = () => Promise.resolve(tasks);
	await s.store.refreshNow(); expect(order.get()).toHaveLength(5);
	tasks = [...tasks, stagedTask({ path: "Z.md", staged: "2026-11-13" }), stagedTask({ path: "B.md", staged: "2026-11-12" }), stagedTask({ path: "A.md", staged: "2026-11-12" })];
	await s.store.refreshNow(); expect(order.get().slice(-3)).toEqual(["A.md", "B.md", "Z.md"]); await s.store.refreshNow(); expect(order.get()).toHaveLength(8);
	s.gateway.listTasks = () => Promise.reject(new Error("offline")); await s.store.refreshNow(); expect(order.get()).toHaveLength(8);
	expect(persist).not.toHaveBeenCalled(); expect(s.gateway.updateCalls).toEqual([]); s.store.dispose();
});
test("rename while a read is pending discards old identity and preserves cards/order through reindex gaps", async () => {
	const persist = vi.fn(() => Promise.resolve()); const order = new StagedOrderStore({ persist, log: vi.fn() }); order.load(["Folder/A.md", "Folder2/B.md"]);
	const existing = new Set(["Folder/A.md", "Folder2/B.md"]);
	const s = stagingFixture({ order, fileCheck: () => path => existing.has(path) });
	s.gateway.listTasks = () => Promise.resolve([stagedTask({ path: "Folder/A.md" }), stagedTask({ path: "Folder2/B.md" })]); await s.store.refreshNow();
	let resolve!: (tasks: TaskInfo[]) => void; s.gateway.listTasks = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue([]);
	const read = s.store.refreshNow(); await Promise.resolve();
	existing.delete("Folder/A.md"); existing.add("New/A.md"); s.store.renamePath("Folder", "New"); order.renamePath("Folder", "New");
	expect(s.store.getSnapshot().items.map(item => item.taskPath)).toEqual(["New/A.md", "Folder2/B.md"]);
	resolve([stagedTask({ path: "Folder/A.md", title: "Stale" })]); await read;
	expect(s.store.getSnapshot().items.map(item => item.taskPath)).toEqual(["New/A.md"]); expect(order.get()).toEqual(["New/A.md", "Folder2/B.md"]);
	s.gateway.listTasks = () => Promise.resolve([stagedTask({ path: "New/A.md" })]); await s.store.refreshNow();
	s.gateway.listTasks = () => Promise.resolve([stagedTask({ path: "New/A.md", staged: null })]); await s.store.refreshNow(); expect(s.store.getSnapshot().items).toEqual([]); expect(order.get()).toContain("New/A.md");
	const saves = persist.mock.calls.length; existing.clear(); s.gateway.listTasks = () => Promise.resolve([]); await s.store.refreshNow(); expect(order.get()).toEqual([]); expect(persist).toHaveBeenCalledTimes(saves); s.store.dispose();
});
test("old cached paths are remapped until the renamed task is indexed, without false sibling renames", async () => {
	const s = stagingFixture({ fileCheck: () => () => true }); s.gateway.listTasks = () => Promise.resolve([stagedTask({ path: "Folder/A.md" }), stagedTask({ path: "Folder2/A.md" })]); await s.store.refreshNow();
	s.store.renamePath("Folder", "Dest"); await s.store.refreshNow();
	expect(s.store.getSnapshot().items.map(item => item.taskPath)).toEqual(["Dest/A.md", "Folder2/A.md"]); s.store.dispose();
});

test("a newer explicit refresh cannot publish an older successful read while its retry is pending", async () => {
	const s = stagingFixture(); await s.store.refreshNow();
	let first!: (tasks: TaskInfo[]) => void; let second!: (tasks: TaskInfo[]) => void;
	s.gateway.listTasks = vi.fn().mockImplementationOnce(() => new Promise(done => { first = done; })).mockImplementationOnce(() => new Promise(done => { second = done; }));
	const observed: string[] = []; s.store.subscribe(() => { observed.push(s.store.getSnapshot().items[0]?.task.title ?? ""); });
	const read = s.store.refreshNow(); await Promise.resolve(); const retry = s.store.refreshNow();
	first([stagedTask({ title: "Old success" })]); for (let i = 0; i < 12; i++) await Promise.resolve();
	const stalePublished = observed.includes("Old success"); const readyDuringRetry = s.store.getSnapshot().canStage;
	second([stagedTask({ title: "Fresh success" })]); await Promise.all([read, retry]); s.store.dispose();
	expect(stalePublished).toBe(false); expect(readyDuringRetry).toBe(false); expect(s.store.getSnapshot().items[0]?.task.title).toBe("Fresh success");
});
