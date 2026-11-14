import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StagingStore } from "../src/state/StagingStore";
import { createFakeGateway } from "./fakes/fakeGateway";
import type { TaskInfo } from "../src/tasknotes/runtime-api.types";

export const stagedTask = (patch: Partial<TaskInfo> & { staged?: unknown } = {}): TaskInfo => ({ path: "A.md", title: "Task A", archived: false, status: "open", staged: "2026-11-12", ...patch });
export function stagingFixture() {
	const gateway = createFakeGateway();
	gateway.setUserFields([{ id: "staged", displayName: "Staged", key: "staged", type: "date" }]);
	gateway.listTasks = vi.fn(() => Promise.resolve([stagedTask()]));
	const store = new StagingStore({ gateway, log: vi.fn(), now: () => new Date(2026, 10, 14, 12).getTime(), schedule: (fn, ms) => { const timers = { setTimeout, clearTimeout }; const id = timers.setTimeout(fn, ms); return () => timers.clearTimeout(id); } });
	return { gateway, store };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

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
