import { expect, test, vi } from "vitest";
import { StagingController } from "../src/state/StagingController";
import { StagingStore } from "../src/state/StagingStore";
import { WriteQueue } from "../src/state/WriteQueue";
import { createFakeGateway } from "./fakes/fakeGateway";
import type { TaskInfo } from "../src/tasknotes/runtime-api.types";

export function commandFixture() {
	const gateway = createFakeGateway();
	const target = { taskPath: "Task.md", title: "Task" };
	let task: TaskInfo & { staged?: unknown } = { path: target.taskPath, title: target.title, status: "open", archived: false };
	gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
	gateway.getTask = () => Promise.resolve(task);
	gateway.listTasks = () => Promise.resolve([task]);
	const staging = new StagingStore({ gateway, log: vi.fn(), schedule: () => () => undefined, now: () => new Date(2026, 10, 14, 12).getTime() });
	const queue = new WriteQueue(); const refreshNow = vi.fn(() => Promise.resolve());
	const deps = { gateway, staging, store: { refreshNow }, queue, settingsReady: () => Promise.resolve(), getSettings: () => ({ completionStatus: null, rolloverHour: 4 }), timerBusy: () => false, log: vi.fn(), newCorrelationId: () => "test", now: () => new Date(2026, 10, 14, 12).getTime() };
	const controller = new StagingController(deps);
	return { gateway, staging, queue, controller, deps, target, refreshNow, task: () => task, change: (patch: object) => { task = { ...task, ...patch }; } };
}

test("a task staged during the final registration check is not overwritten", async () => {
	const s = commandFixture();
	const original = s.gateway.userFields; let reads = 0;
	s.gateway.userFields = () => { if (++reads === 2) s.change({ staged: "2026-12-31" }); return original(); };
	const outcome = await s.controller.stage(s.target);
	expect(s.gateway.updateCalls.length).toBe(0);
	expect(outcome.kind).toBe("already-staged");
	s.staging.dispose();
});

test.each(["staged", "future", "archived", "completed", "default", "missing", "unavailable"])("queued fresh checks protect %s changes", async change => {
	const s = commandFixture(); let release!: () => void;
	const barrier = s.queue.run(() => new Promise<void>(resolve => { release = resolve; })); await Promise.resolve();
	const pending = s.controller.stage(s.target);
	if (change === "staged" || change === "future") s.change({ staged: change === "future" ? "2026-12-31" : "2026-11-13" });
	if (change === "archived") s.change({ archived: true });
	if (change === "completed") { s.change({ status: "closed" }); s.gateway.statuses = () => Promise.resolve([{ value: "closed", isCompleted: true }]); }
	if (change === "default") s.gateway.setUserFields([{ id: "s", key: "staged", type: "date", displayName: "Staged", defaultValue: "2026-11-14" }]);
	if (change === "missing") s.gateway.setUserFields([]);
	if (change === "unavailable") s.gateway.setStagingAvailable(false);
	release(); await barrier; const result = await pending;
	expect(s.gateway.updateCalls.length).toBe(0); expect(["blocked", "already-staged"]).toContain(result.kind); expect(s.controller.isBusy()).toBe(false); s.staging.dispose();
});
test.each(["getTask", "userFields", "statuses"] as const)("a rejected %s check does not write and can retry", async method => {
	const s = commandFixture(); const read = vi.spyOn(s.gateway, method).mockRejectedValueOnce(new Error("private details"));
	expect((await s.controller.stage(s.target)).kind).toBe("failed"); expect(s.gateway.updateCalls.length).toBe(0); expect(s.controller.isBusy()).toBe(false);
	read.mockRestore(); expect((await s.controller.stage(s.target)).kind).toBe("staged"); expect(s.gateway.updateCalls.length).toBe(1); s.staging.dispose();
});
test("duplicate pending calls make one update and timer work on the shared queue stays serialized", async () => {
	const s = commandFixture(); let release!: () => void; const order: string[] = [];
	const timer = s.queue.run(() => new Promise<void>(resolve => { order.push("timer"); release = resolve; })); await Promise.resolve();
	const original = s.gateway.updateTask; s.gateway.updateTask = async (...args) => { order.push("stage"); await original(...args); };
	const first = s.controller.stage(s.target); expect((await s.controller.stage(s.target)).kind).toBe("busy"); expect(s.gateway.updateCalls.length).toBe(0);
	release(); await timer; expect((await first).kind).toBe("staged"); expect(order).toEqual(["timer", "stage"]); expect(s.gateway.updateCalls).toHaveLength(1); s.staging.dispose();
});
test("field-write success remains successful after refresh or order-save failure", async () => {
	const s = commandFixture(); const controller = new StagingController({ ...s.deps, commitOrder: () => Promise.reject(new Error("save failed")) });
	s.refreshNow.mockRejectedValueOnce(new Error("read failed"));
	const result = await controller.stage(s.target); expect(result.kind).toBe("staged"); expect(result.warning).toContain("staged"); expect(s.gateway.updateCalls).toHaveLength(1); expect(controller.isBusy()).toBe(false); s.staging.dispose();
});
test("a retired read generation blocks a stage before its write", async () => {
	const s = commandFixture(); const read = s.gateway.userFields; let calls = 0;
	s.gateway.userFields = () => { if (++calls === 2) s.gateway.setState({ kind: "missing" }); return read(); };
	expect((await s.controller.stage(s.target)).kind).toBe("blocked"); expect(s.gateway.updateCalls.length).toBe(0); s.staging.dispose();
});
