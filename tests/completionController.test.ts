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
async function setup(running = true, now = () => Date.parse("2026-11-14T17:00:00Z")) {
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
  getRecords: () => records, saveRecord, refresh, now });
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
test("virtual completion records the snapped date and a repeat never advances it", async () => {
 const c = await setup(false);
 const parent = { path, title: "Weekly", status: "open", archived: false, recurrence: "FREQ=WEEKLY;BYDAY=MO", staged: "2026-11-14", complete_instances: [] as string[] };
 c.tn.setTasks([parent]);
 const toggle = vi.spyOn(c.tn.api.recurring!, "toggleCompleteInstance").mockImplementation(() => {
  parent.complete_instances.push("2026-11-09"); c.tn.setTasks([parent]); return Promise.resolve(parent);
 });
 expect(await c.completion.complete({ sourcePath: path, title: "Weekly" })).toBe("completed");
 expect(c.records()[0]).toMatchObject({ requestDay: "2026-11-14", resolvedDate: "2026-11-09", completedPath: path, replayProtected: true });
 expect(await c.completion.complete({ sourcePath: path, title: "Weekly" })).toBe("unavailable");
 expect(toggle).toHaveBeenCalledTimes(1); expect(c.tn.completeCalls).toHaveLength(0);
});
test("an existing authoritative materialized occurrence completes without toggling the parent", async () => {
 const c = await setup(false); const occurrencePath = "Tasks/occurrence.md";
 c.tn.setTasks([{ path, title: "Weekly", status: "open", archived: false, recurrence: "FREQ=DAILY", staged: "2026-11-14" } as Parameters<typeof c.tn.setTasks>[0][number],
  { path: occurrencePath, title: "Occurrence", status: "open", archived: false, recurrence_parent: "[[Tasks/ordinary]]", occurrence_date: "2026-11-14" }]);
 expect(await c.completion.complete({ sourcePath: path, title: "Weekly" })).toBe("completed");
 expect(c.tn.completeCalls[0]?.path).toBe(occurrencePath); expect(c.tn.toggleCalls).toHaveLength(0);
 expect(c.records()[0]).toMatchObject({ completedPath: occurrencePath, resolvedDate: "2026-11-14" });
});
test("already-completed requested days are never toggled off", async () => {
 const c = await setup(false);
 c.tn.setTasks([{ path, title: "Daily", status: "open", archived: false, recurrence: "FREQ=DAILY", complete_instances: ["2026-11-14"], staged: "2026-11-14" } as Parameters<typeof c.tn.setTasks>[0][number]]);
 expect(await c.completion.complete({ sourcePath: path, title: "Daily" })).toBe("completed");
 expect(c.tn.toggleCalls).toHaveLength(0); expect(c.tn.completeCalls).toHaveLength(0);
});
test("duplicate materialized identities disable completion instead of guessing", async () => {
 const c = await setup(false);
 const occurrence = { title: "Occurrence", status: "open", archived: false, recurrence_parent: "[[Tasks/ordinary]]", occurrence_date: "2026-11-14" };
 c.tn.setTasks([{ path, title: "Daily", status: "open", archived: false, recurrence: "FREQ=DAILY" }, { ...occurrence, path: "a.md" }, { ...occurrence, path: "b.md" }]);
 expect((await c.completion.availability({ sourcePath: path, title: "Daily" })).available).toBe(false);
 expect(c.tn.toggleCalls).toHaveLength(0);
});
test("automatic materialization clears only newly inherited staging and preserves explicit future staging", async () => {
 const c = await setup(false);
 const parent = { path, title: "Daily", status: "open", archived: false, recurrence: "FREQ=DAILY", occurrence_materialization: "on_completion" as const, staged: "2026-11-14" };
 const next = { path: "Tasks/future.md", title: "Future", status: "open", archived: false, recurrence_parent: "[[Tasks/ordinary]]", occurrence_date: "2026-11-16", staged: "2026-11-17" };
 const occurrence = { ...next, path: "Tasks/new.md", occurrence_date: "2026-11-14", staged: "2026-11-14" };
 c.tn.setTasks([parent, next]);
 vi.spyOn(c.gateway, "materializationAvailability").mockReturnValue({ available: true, reason: "Available" });
 vi.spyOn(c.gateway, "materializeOccurrence").mockImplementation(() => { c.tn.setTasks([parent, next, occurrence]); return Promise.resolve(occurrence); });
 expect(await c.completion.complete({ sourcePath: path, title: "Daily" })).toBe("completed");
 expect(c.tn.updateCalls.map(call => call.path)).toEqual([path, occurrence.path]);
 expect((await c.gateway.getTask(next.path) as unknown as { staged: string }).staged).toBe("2026-11-17");
 expect(c.tn.completeCalls[0]?.path).toBe(occurrence.path);
});
test("a replacement timer landing during intent persistence is not stopped", async () => {
 const c = await setup();
 c.saveRecord.mockImplementationOnce(() => { c.tn.setActive([makeActiveEntry({ taskPath: path, startTime: "2026-11-14T16:59:00Z" })]); return Promise.resolve(); });
 expect(await c.timer.complete(target)).toBe("failed");
 expect(c.tn.stopCalls).toHaveLength(0); expect(c.tn.completeCalls).toHaveLength(0);
});
test("a pending recurring request from a prior controller instance blocks replay", async () => {
 const c = await setup(false); const parent = { path, title: "Daily", status: "open", archived: false, recurrence: "FREQ=DAILY" };
 c.tn.setTasks([parent]);
 await c.saveRecord({ attemptId: "old", sourcePath: path, requestDay: "2026-11-14", requestedAt: 123, beforeEvidence: { status: "open", staged: null, title: "Daily", completedStatus: "done", recurrence: parent.recurrence, parentPath: path, completedDates: [] }, phase: "pending", pendingCleanupPaths: [], replayProtected: true });
 expect(await c.completion.complete({ sourcePath: path, title: "Daily" })).toBe("unavailable");
 expect(c.tn.toggleCalls).toHaveLength(0);
});
test("an occurrence with an unreadable active parent owner prevents completion", async () => {
 const c = await setup(false); const occurrence = { path: "Tasks/current.md", title: "Occurrence", status: "open", archived: false, recurrence_parent: "[[Tasks/ordinary]]", occurrence_date: "2026-11-14" };
 c.tn.setTasks([{ path, title: "Daily", status: "open", archived: false, recurrence: "FREQ=DAILY" }, occurrence]);
 c.tn.setActive([makeActiveEntry({ taskPath: path, startTime })]);
 vi.spyOn(c.gateway, "pomodoroOwnership").mockResolvedValue({ readable: false });
 expect(await c.completion.complete({ sourcePath: occurrence.path, title: "Occurrence" })).toBe("unavailable");
 expect(c.tn.completeCalls).toHaveLength(0); expect(c.tn.stopCalls).toHaveLength(0);
});
test("a completion begun before rollover retains its captured day when confirmed after rollover", async () => {
 const before = new Date(2026, 10, 15, 3, 59, 59).getTime(); let now = before;
 const c = await setup(false, () => now);
 c.tn.setTasks([{ path, title: "Daily", status: "open", archived: false, recurrence: "FREQ=DAILY" }]);
 const persist = c.saveRecord.getMockImplementation()!;
 c.saveRecord.mockImplementation(async record => { await persist(record); now = new Date(2026, 10, 15, 4, 0, 1).getTime(); });
 expect(await c.completion.complete({ sourcePath: path, title: "Daily" })).toBe("completed");
 expect(c.tn.toggleCalls[0]?.date).toBe("2026-11-14");
 expect(c.records()[0]).toMatchObject({ requestDay: "2026-11-14", requestedAt: before, completedAt: before });
});
test("a status failure after a successful stop never restarts timing or replays completion", async () => {
 const c = await setup(); c.tn.failCompleteWith("disk locked");
 expect(await c.timer.complete(target)).toBe("failed");
 expect(c.tn.stopCalls).toHaveLength(1); expect(c.tn.startCalls).toHaveLength(0);
 expect(c.records()[0]?.phase).toBe("uncertain");
 expect(await c.timer.complete(target)).toBe("unavailable"); expect(c.tn.completeCalls).toHaveLength(1);
});
test("failure between inherited staged clears retries cleanup without another completion", async () => {
 const c = await setup(false);
 const parent = { path, title: "Daily", status: "open", archived: false, recurrence: "FREQ=DAILY", occurrence_materialization: "on_completion" as const, staged: "2026-11-14" };
 const occurrence = { path: "Tasks/new.md", title: "Daily", status: "open", archived: false, recurrence_parent: "[[Tasks/ordinary]]", occurrence_date: "2026-11-14", staged: "2026-11-14" };
 c.tn.setTasks([parent]);
 vi.spyOn(c.gateway, "materializationAvailability").mockReturnValue({ available: true, reason: "Available" });
 vi.spyOn(c.gateway, "materializeOccurrence").mockImplementation(() => { c.tn.setTasks([parent, occurrence]); return Promise.resolve(occurrence); });
 const original = c.gateway.updateTask.bind(c.gateway); let writes = 0;
 const update = vi.spyOn(c.gateway, "updateTask").mockImplementation(async (...args) => { if (++writes === 2) throw new Error("locked"); await original(...args); });
 expect(await c.completion.complete({ sourcePath: path, title: "Daily" })).toBe("partial");
 expect(c.records()[0]?.pendingCleanupPaths).toEqual([occurrence.path]); update.mockRestore();
 expect(await c.completion.complete({ sourcePath: path, title: "Daily" })).toBe("completed");
 expect(c.tn.completeCalls).toHaveLength(1); expect(c.tn.toggleCalls).toHaveLength(0);
});
