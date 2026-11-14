import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StagingStore } from "../src/state/StagingStore";
import { createFakeGateway } from "./fakes/fakeGateway";
import type { TaskInfo } from "../src/tasknotes/runtime-api.types";

export const stagedTask = (patch: Partial<TaskInfo> & { staged?: unknown } = {}): TaskInfo => ({ path: "A.md", title: "Task A", archived: false, status: "open", staged: "2026-11-12", ...patch });
export function stagingFixture() {
	const gateway = createFakeGateway();
	gateway.setUserFields([{ id: "staged", displayName: "Staged", key: "staged", type: "date" }]);
	gateway.listTasks = vi.fn(() => Promise.resolve([stagedTask()]));
	const store = new StagingStore({ gateway, log: vi.fn(), now: () => new Date(2026, 10, 14, 12).getTime(), schedule: (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); } });
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
