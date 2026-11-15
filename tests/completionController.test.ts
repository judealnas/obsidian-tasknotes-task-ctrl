import { afterEach, expect, test, vi } from "vitest";
import { CompletionController, type CompletionAttempt } from "../src/state/CompletionController";
import { TimerController } from "../src/state/TimerController";
import { TimerStore } from "../src/state/TimerStore";
import { WriteQueue } from "../src/state/WriteQueue";
import { TaskNotesBridge } from "../src/tasknotes/TaskNotesBridge";
import { DEFAULT_SETTINGS } from "../src/settings";
import { createFakeTaskNotes, makeActiveEntry, timerSchedule } from "./fakes/fakeTaskNotes";

const path = "Tasks/ordinary.md";
const startTime = "2026-11-14T10:00:00Z";
const target = { taskPath: path, title: "Ordinary", startTime };
const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.restoreAllMocks(); });
async function setup(running = true) {
 const tn = createFakeTaskNotes({ active: running ? [makeActiveEntry({ taskPath: path, startTime })] : [] });
 tn.setTasks([{ path, title: "Ordinary", status: "open", archived: false, staged: "2026-11-14" } as Parameters<typeof tn.setTasks>[0][number]]);
 if (running) { const active = makeActiveEntry({ taskPath: path, startTime }); Object.assign(active.task, { staged: "2026-11-14" }); tn.setActive([active]); }
 tn.setUserFields([{ id: "staged", key: "staged", displayName: "Staged", type: "date" }]);
 const log = vi.fn(); const notify = vi.fn(); const newCorrelationId = () => "attempt-1";
 const gateway = new TaskNotesBridge({ lookupPlugin: () => tn.plugin, log, schedule: timerSchedule });
 const store = new TimerStore({ gateway, log, schedule: timerSchedule });
 const queue = new WriteQueue();
 const timer = new TimerController({ gateway, store, queue, log, notify, newCorrelationId });
 let records: CompletionAttempt[] = [];
 const saveRecord = vi.fn((record: CompletionAttempt) => { records = [...records.filter(r => r.attemptId !== record.attemptId), structuredClone(record)]; return Promise.resolve(); });
 const refresh = vi.fn(() => Promise.resolve());
 const completion = new CompletionController({ gateway, queue, timer, notify, log, newCorrelationId,
  getSettings: () => DEFAULT_SETTINGS, settingsReady: () => Promise.resolve(),
  getRecords: () => records, saveRecord, refresh, now: () => Date.parse("2026-11-14T17:00:00Z") });
 timer.setCompletionHandler(target => completion.complete({ sourcePath: target.taskPath, title: target.title, entry: target.startTime ? { taskPath: target.taskPath, startTime: target.startTime } : undefined }));
 gateway.probe(); await store.refreshNow();
 cleanups.push(() => { store.dispose(); gateway.dispose(); });
 return { tn, gateway, timer, completion, saveRecord, notify, refresh, records: () => records };
}
test("the card's controller callback saves intent, stops first, completes and clears staged quietly", async () => {
 const c = await setup(); const order: string[] = [];
 c.saveRecord.mockImplementation(record => { order.push(record.phase); return Promise.resolve(); });
 const stop = c.tn.api.time.stop.bind(c.tn.api.time);
 vi.spyOn(c.tn.api.time, "stop").mockImplementation(async (...args) => { order.push("stop"); return stop(...args); });
 const complete = c.tn.api.tasks!.complete!.bind(c.tn.api.tasks);
 vi.spyOn(c.tn.api.tasks!, "complete").mockImplementation(async (...args) => { order.push("complete"); return complete(...args); });
 expect(await c.timer.complete(target)).toBe("completed");
 expect(order.indexOf("pending")).toBeLessThan(order.indexOf("stop"));
 expect(order.indexOf("stop")).toBeLessThan(order.indexOf("complete"));
 expect(c.tn.updateCalls).toEqual([expect.objectContaining({ path, patch: { staged: null } })]);
 expect(c.notify).not.toHaveBeenCalled();
 expect(c.timer.isBusy()).toBe(false);
});
test("initial local save rejection produces zero upstream writes", async () => {
 const c = await setup(); c.saveRecord.mockRejectedValue(new Error("disk full"));
 expect(await c.timer.complete(target)).toBe("failed");
 expect(c.tn.stopCalls).toHaveLength(0); expect(c.tn.completeCalls).toHaveLength(0); expect(c.tn.updateCalls).toHaveLength(0);
 expect(c.notify).toHaveBeenCalledTimes(1);
});
test("idle staged completion does not invent an entry identity", async () => {
 const c = await setup(false);
 expect(await c.completion.complete({ sourcePath: path, title: "Ordinary" })).toBe("completed");
 expect(c.tn.stopCalls).toHaveLength(0); expect(c.records()[0]).toMatchObject({ sourcePath: path, requestDay: "2026-11-14", phase: "confirmed" });
});
test("affected Pomodoro and unreadable ownership both prevent completion writes", async () => {
 const c = await setup();
 c.tn.setPomodoro({ isRunning: true, timeRemaining: 40, currentSession: { taskPath: path, startTime, timeTrackingStartTime: startTime, type: "work", completed: false } });
 expect(await c.timer.complete(target)).toBe("unavailable");
 expect(c.tn.stopCalls).toHaveLength(0); expect(c.tn.completeCalls).toHaveLength(0);
 vi.spyOn(c.gateway, "pomodoroOwnership").mockResolvedValue({ readable: false });
 expect(await c.timer.complete(target)).toBe("unavailable"); expect(c.tn.completeCalls).toHaveLength(0);
});
test("double clicks and other timer actions cannot enter while completion is saving", async () => {
 const c = await setup(); let release!: () => void;
 c.saveRecord.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
 const first = c.timer.complete(target);
 await vi.waitFor(() => expect(c.saveRecord).toHaveBeenCalled());
 expect(await c.timer.complete(target)).toBe("busy"); expect(await c.timer.start({ taskPath: "other.md", title: "Other" })).toBe("busy");
 release(); expect(await first).toBe("completed");
});
test("confirmed completion plus failed staged cleanup is partial and cannot repeat completion", async () => {
 const c = await setup(); c.tn.failUpdateWith("locked");
 expect(await c.timer.complete(target)).toBe("partial"); expect(c.records()[0]?.phase).toBe("cleanup-pending");
 c.tn.failUpdateWith(null); expect(await c.timer.complete(target)).toBe("completed");
 expect(c.tn.completeCalls).toHaveLength(1);
});
test("post-write confirmation-save failure cannot repeat status mutation", async () => {
 const c = await setup();
 c.saveRecord.mockImplementationOnce(() => Promise.resolve()).mockRejectedValueOnce(new Error("disk full"));
 expect(await c.timer.complete(target)).toBe("partial");
 expect(await c.timer.complete(target)).toBe("completed"); expect(c.tn.completeCalls).toHaveLength(1);
});
test("throw after an upstream write retains uncertainty and prevents replay", async () => {
 const c = await setup(); const original = c.tn.api.tasks!.complete!.bind(c.tn.api.tasks);
 vi.spyOn(c.tn.api.tasks!, "complete").mockImplementation(async (...args) => { await original(...args); throw new Error("reply lost"); });
 expect(await c.timer.complete(target)).toBe("failed"); expect(c.records()[0]?.phase).toBe("uncertain");
 expect(await c.timer.complete(target)).toBe("unavailable"); expect(c.tn.completeCalls).toHaveLength(1);
});
test("a failed refresh is partial, releases busy and preserves confirmed status", async () => {
 const c = await setup(); c.refresh.mockRejectedValue(new Error("offline"));
 expect(await c.timer.complete(target)).toBe("partial"); expect(c.timer.isBusy()).toBe(false);
 expect(c.records()[0]?.phase).toBe("confirmed"); expect(c.notify).toHaveBeenCalledTimes(1);
});
