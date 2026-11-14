import { expect, test, vi } from "vitest";
import { StagingController } from "../src/state/StagingController";
import { StagingStore } from "../src/state/StagingStore";
import { WriteQueue } from "../src/state/WriteQueue";
import { createFakeGateway } from "./fakes/fakeGateway";
import type { TaskInfo } from "../src/tasknotes/runtime-api.types";
import { makeActiveEntry } from "./fakes/fakeTaskNotes";
import { PauseStore } from "../src/state/PauseStore";

export function commandFixture() {
	const gateway = createFakeGateway();
	const target = { taskPath: "Task.md", title: "Task" };
	let task: TaskInfo & { staged?: unknown } = { path: target.taskPath, title: target.title, status: "open", archived: false };
	gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
	gateway.getTask = () => Promise.resolve(task);
	gateway.listTasks = () => Promise.resolve([task]);
	const update = gateway.updateTask.bind(gateway);
	gateway.updateTask = async (path, patch, context) => { await update(path, patch, context); task = { ...task, ...patch }; };
	const staging = new StagingStore({ gateway, log: vi.fn(), schedule: () => () => undefined, now: () => new Date(2026, 10, 14, 12).getTime() });
	const queue = new WriteQueue(); const refreshNow = vi.fn(() => Promise.resolve());
	const deps = { gateway, staging, store: { refreshNow }, queue, settingsReady: () => Promise.resolve(), getSettings: () => ({ completionStatus: null, rolloverHour: 4 }), timerBusy: () => false, log: vi.fn(), newCorrelationId: () => "test", now: () => new Date(2026, 10, 14, 12).getTime() };
	const controller = new StagingController(deps);
	return { gateway, staging, queue, controller, deps, target, refreshNow, task: () => task, change: (patch: object) => { task = { ...task, ...patch }; } };
}

test("a task staged during the final registration check is not overwritten", async () => {
	const s = commandFixture();
	const original = s.gateway.userFields.bind(s.gateway); let reads = 0;
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
	const original = s.gateway.updateTask.bind(s.gateway); s.gateway.updateTask = async (...args) => { order.push("stage"); await original(...args); };
	const first = s.controller.stage(s.target); expect((await s.controller.stage(s.target)).kind).toBe("busy"); expect(s.gateway.updateCalls.length).toBe(0);
	release(); await timer; expect((await first).kind).toBe("staged"); expect(order).toEqual(["timer", "stage"]); expect(s.gateway.updateCalls).toHaveLength(1); s.staging.dispose();
});
test("field-write success remains successful after refresh or order-save failure", async () => {
	const s = commandFixture(); const controller = new StagingController({ ...s.deps, commitOrder: () => Promise.reject(new Error("save failed")) });
	s.refreshNow.mockRejectedValueOnce(new Error("read failed"));
	const result = await controller.stage(s.target); expect(result.kind).toBe("staged"); expect(result.warning).toContain("staged"); expect(s.gateway.updateCalls).toHaveLength(1); expect(controller.isBusy()).toBe(false); s.staging.dispose();
});
test("a retired read generation blocks a stage before its write", async () => {
	const s = commandFixture(); const read = s.gateway.userFields.bind(s.gateway); let calls = 0;
	s.gateway.userFields = () => { if (++calls === 2) s.gateway.setState({ kind: "missing" }); return read(); };
	expect((await s.controller.stage(s.target)).kind).toBe("blocked"); expect(s.gateway.updateCalls.length).toBe(0); s.staging.dispose();
});

const regular = (startTime = "2026-11-14T10:00:00Z") => makeActiveEntry({ taskPath: "Task.md", title: "Task", startTime });
test.each(["idle", "paused", "running", "owned", "same-path-regular"])("Unstage handles %s with exactly the null patch", async state => {
	const s = commandFixture(); s.change({ staged: "2026-11-13" });
	const pauses = new PauseStore({ log: vi.fn() });
	pauses.load(state === "paused" ? [{ state: "paused", taskPath: "Task.md", title: "Task", sessionStartedAt: "2026-11-14T09:00:00Z", pausedAt: "2026-11-14T09:05:00Z", lastEntryStart: "2026-11-14T09:00:00Z", accumulatedMs: 300000 }] : []);
	if (["running", "owned", "same-path-regular"].includes(state)) s.gateway.setActive([regular()]);
	if (state === "owned" || state === "same-path-regular") s.gateway.setOwnership({ readable: true, owner: { taskPath: "Task.md", startTime: state === "owned" ? regular().entry.startTime : "2026-11-14T11:00:00Z" } });
	const calls: string[] = []; const stop = s.gateway.stop.bind(s.gateway); const update = s.gateway.updateTask.bind(s.gateway);
	s.gateway.stop = async (...args) => { calls.push("stop"); return stop(...args); }; s.gateway.updateTask = async (...args) => { calls.push("null"); await update(...args); };
	const controller = new StagingController({ ...s.deps, pauses });
	expect((await controller.unstage(s.target)).kind).toBe("unstaged");
	expect(s.gateway.updateCalls.map(call => call.patch)).toEqual([{ staged: null }]);
	expect(s.gateway.stopCalls).toHaveLength(state === "running" || state === "same-path-regular" ? 1 : 0);
	expect(calls).toEqual(state === "running" || state === "same-path-regular" ? ["stop", "null"] : ["null"]);
	expect(pauses.records()).toEqual([]); expect(s.task().staged).toBeNull(); expect(controller.isBusy()).toBe(false); s.staging.dispose();
});
test.each([false, true])("unreadable ownership permits Unstage only for a freshly empty active path (open=%s)", async open => {
	const s = commandFixture(); s.change({ staged: "2026-11-13" }); s.gateway.setOwnership({ readable: false }); if (open) s.gateway.setActive([regular()]);
	expect((await s.controller.unstage(s.target)).kind).toBe(open ? "blocked" : "unstaged"); expect(s.gateway.stopCalls.length).toBe(0); expect(s.gateway.updateCalls.length).toBe(open ? 0 : 1); s.staging.dispose();
});
test.each(["replacement", "takeover", "unknown"])("final active/ownership check protects %s", async change => {
	const s = commandFixture(); s.change({ staged: "2026-11-13" }); s.gateway.setActive([regular()]);
	if (change === "replacement") {
		const active = s.gateway.active.bind(s.gateway); let calls = 0;
		s.gateway.active = () => { if (++calls === 2) s.gateway.setActive([regular("2026-11-14T11:00:00Z")]); return active(); };
	} else {
		let calls = 0; s.gateway.pomodoroOwnership = () => Promise.resolve(++calls === 1 ? { readable: true, owner: null } : change === "unknown" ? { readable: false } : { readable: true, owner: { taskPath: "Task.md", startTime: regular().entry.startTime } });
	}
	const result = await s.controller.unstage(s.target); expect(s.gateway.stopCalls.length).toBe(0);
	expect(result.kind).toBe(change === "takeover" ? "unstaged" : "blocked"); expect(s.gateway.updateCalls.length).toBe(change === "takeover" ? 1 : 0); s.staging.dispose();
});
test("stop failure keeps staging; null failure after stop reports partial success without restart", async () => {
	const s = commandFixture(); s.change({ staged: "2026-11-13" }); s.gateway.setActive([regular()]); s.gateway.failStopWith(new Error("failed"));
	expect((await s.controller.unstage(s.target)).kind).toBe("failed"); expect(s.gateway.updateCalls.length).toBe(0);
	s.gateway.failStopWith(null); s.gateway.updateTask = vi.fn(() => Promise.reject(new Error("failed null")));
	expect((await s.controller.unstage(s.target)).kind).toBe("partial"); expect(s.task().staged).toBe("2026-11-13"); expect(s.gateway.startCalls.length).toBe(0); expect(s.controller.isBusy()).toBe(false); s.staging.dispose();
});
test("nonempty default permits Unstage but missing or failing registration blocks before stopping", async () => {
	for (const field of ["default", "missing", "failure"]) {
		const s = commandFixture(); s.change({ staged: "2026-11-13" }); s.gateway.setActive([regular()]);
		if (field === "default") s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date", defaultValue: "today" }]);
		if (field === "missing") s.gateway.setUserFields([]);
		if (field === "failure") s.gateway.failUserFieldsWith(new Error("offline"));
		expect((await s.controller.unstage(s.target)).kind).toBe(field === "default" ? "unstaged" : field === "missing" ? "blocked" : "failed");
		expect(s.gateway.stopCalls.length).toBe(field === "default" ? 1 : 0); s.staging.dispose();
	}
});
test("a committed null stays successful after refresh/save failure and pending Unstage rejects duplicates", async () => {
	const s = commandFixture(); s.change({ staged: "2026-11-13" }); let release!: () => void;
	const hold = s.queue.run(() => new Promise<void>(resolve => { release = resolve; })); await Promise.resolve();
	const controller = new StagingController({ ...s.deps, commitOrder: () => Promise.reject(new Error("save")) });
	const first = controller.unstage(s.target); expect((await controller.unstage(s.target)).kind).toBe("busy");
	release(); await hold; s.refreshNow.mockRejectedValueOnce(new Error("refresh"));
	const result = await first; expect(result.kind).toBe("unstaged"); expect(result.warning).toBeDefined(); expect(s.gateway.updateCalls).toHaveLength(1); expect(controller.isBusy()).toBe(false); s.staging.dispose();
});
