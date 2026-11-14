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
