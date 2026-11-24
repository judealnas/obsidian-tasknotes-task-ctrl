/* eslint-disable @typescript-eslint/unbound-method -- Assertions inspect mocks; they do not call detached methods. */
import { describe, expect, test, vi } from "vitest";
import { ambiguousTitle, buildTaskCreation, creationDate } from "../src/model/taskCreation";
import { PickerCreationController } from "../src/state/PickerCreationController";
import { TaskPickerRelationships } from "../src/state/TaskPickerRelationships";
import { StagingController } from "../src/state/StagingController";
import { StagingStore } from "../src/state/StagingStore";
import { IdleCardStore } from "../src/state/IdleCardStore";
import { PauseStore } from "../src/state/PauseStore";
import { CardOrderStore } from "../src/state/CardOrderStore";
import { WriteQueue } from "../src/state/WriteQueue";
import { pickerColor } from "../src/ui/TaskPickerRow";
import { createFakeGateway } from "./fakes/fakeGateway";
const task = { path: "Created.md", title: "Created", status: "open", archived: false };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup() {
 const gateway = createFakeGateway();
 gateway.inlineCreationAvailability = () => ({ available: true, reason: "" });
 gateway.createTask = vi.fn(() => Promise.resolve(task));
 const notify = vi.fn(); const queue = new WriteQueue();
 const controller = new PickerCreationController({ gateway, queue, notify, newCorrelationId: () => "mutation" });
 return { gateway, controller, notify, queue };
}
describe("public creation adapter", () => {
 test("omits defaults and empty values, preserving explicit top-level status and priority", () => {
  expect(buildTaskCreation({ title: " title ", tags: [], contexts: [], estimate: 0 }, " title ", null)).toEqual({ title: "title" });
  expect(buildTaskCreation({ title: "x", status: "custom", priority: "high", dueDate: "2026-11-18", dueTime: "09:30", scheduledDate: "2026-11-19", contexts: ["home"], projects: ["[[P]]"], tags: ["# two words, #foo"], details: "details", recurrence: "FREQ=DAILY", estimate: 10, userFields: { team: ["A", "B"] } }, "edited", [{ id: "team", key: "team-members", displayName: "Team", type: "text" }])).toEqual({ title: "edited", status: "custom", priority: "high", due: "2026-11-18T09:30", scheduled: "2026-11-19", contexts: ["home"], projects: ["[[P]]"], tags: ["two-words, foo"], details: "details", recurrence: "FREQ=DAILY", timeEstimate: 10, customFrontmatter: { "team-members": "A, B" } });
 });
 test("blocks unmapped custom values, nonblank title required and placeholder is ambiguous", () => {
  expect(() => buildTaskCreation({ title: "x", userFields: { unknown: "value" } }, "x", null)).toThrow("Cannot map custom field");
  expect(() => buildTaskCreation({ title: "x" }, " ", [])).toThrow("Enter a task title");
  expect(ambiguousTitle({ title: "Untitled Task" })).toBe(true);
  expect(ambiguousTitle({ title: "" })).toBe(true);
  expect(creationDate("2026-11-18")).toBe("2026-11-18");
  expect(creationDate("2026-11-18T22:15:30", "09:30")).toBe("2026-11-18T09:30");
  expect(creationDate("2026-11-18", "invalid")).toBe("2026-11-18");
 });
 test("catalog color validation rejects CSS injection and absent/unknown colors", () => {
  expect(pickerColor(undefined)).toBeNull(); expect(pickerColor("red;display:none")).toBeNull();
  expect(pickerColor("var(--evil)")).toBeNull(); expect(pickerColor("#A1b2C3")).toBe("#A1b2C3");
 });
});
describe("one-shot creation and destination", () => {
 test("duplicate submissions are guarded; destination retry never creates again or deadlocks shared queue", async () => {
  const { controller, gateway, queue } = setup(); const creation = deferred<typeof task>();
  gateway.createTask = vi.fn(() => creation.promise);
  const route = vi.fn(() => queue.run(() => Promise.resolve({ ok: false, message: "save failed" })));
  const first = controller.create({ title: "x" }, () => true, route, vi.fn());
  expect(await controller.create({ title: "x" }, () => true, route, vi.fn())).toBeNull();
  await flush(); creation.resolve(task); const operation = (await first)!;
  expect(operation.state).toBe("retryable-destination-error");
  await controller.route(operation, () => true, () => Promise.resolve({ ok: true }));
  expect(operation.state).toBe("succeeded"); expect(gateway.createTask).toHaveBeenCalledTimes(1);
  expect(gateway.startCalls).toEqual([]);
 });
 test.each(["close", "reconnect", "unload"])("%s while creating retains identity but suppresses destination", async reason => {
  const { controller, gateway, notify } = setup(); const creation = deferred<typeof task>();
  gateway.createTask = () => creation.promise; let alive = true; const route = vi.fn();
  const first = controller.create({ title: "x" }, () => alive, route, vi.fn()); await flush();
  if (reason === "close") alive = false;
  if (reason === "reconnect") { gateway.setState({ kind: "missing" }); gateway.setState({ kind: "ready" }); }
  if (reason === "unload") controller.dispose();
  creation.resolve(task); const operation = await first;
  expect(operation?.task).toEqual(task); expect(route).not.toHaveBeenCalled(); expect(notify).toHaveBeenCalledOnce();
 });
 test("creation errors show the failure and allow an immediate retry", async () => {
  const { controller, gateway } = setup();
  gateway.createTask = vi.fn().mockRejectedValueOnce(new Error("write failed")).mockResolvedValueOnce(task);
  const route = vi.fn(() => Promise.resolve({ ok: true }));
  const operation = await controller.create({ title: "x" }, () => true, route, vi.fn());
  expect(operation?.state).toBe("creation-error");
  expect(operation?.message).toBe("Failed to create task: write failed");
  expect(controller.availability().available).toBe(true);
  expect(route).not.toHaveBeenCalled();
  const retry = await controller.create({ title: "x" }, () => true, route, vi.fn());
  expect(retry?.state).toBe("succeeded");
  expect(gateway.createTask).toHaveBeenCalledTimes(2);
  expect(route).toHaveBeenCalledTimes(1);
 });
 test("close while queued cancels before create without marking an uncertain write", async () => {
  const { controller, gateway, queue } = setup(); const blocker = deferred<void>(); void queue.run(() => blocker.promise);
  let alive = true; const operation = controller.create({ title: "x" }, () => alive, vi.fn(), vi.fn());
  alive = false; blocker.resolve(); await operation;
  expect(gateway.createTask).not.toHaveBeenCalled(); expect(controller.availability().available).toBe(true);
 });
});
test("relationship reads are bounded and stale query/close results cannot render", async () => {
 const pending: Array<ReturnType<typeof deferred<typeof task[]>>> = [];
 const read = vi.fn(() => { const next = deferred<typeof task[]>(); pending.push(next); return next.promise; });
 const cache = new TaskPickerRelationships(read); const show = vi.fn();
 for (let i = 0; i < 10; i++) cache.request(`${i}.md`, show);
 expect(read).toHaveBeenCalledTimes(4);
 cache.reset(); for (const item of pending) item.resolve([task]); await flush();
 expect(show).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledTimes(4);
 cache.request("new.md", show); pending[4]!.resolve([task]); await flush();
 cache.request("new.md", show); expect(read).toHaveBeenCalledTimes(5); expect(show).toHaveBeenCalledTimes(2);
 cache.reset(true); cache.request("new.md", show); expect(read).toHaveBeenCalledTimes(6);
 pending[5]!.resolve([]); await flush();
});

test.each([[false, 1], [true, 1], [false, 2], [true, 2]] as const)("created staging cancellation reaches deferred read (retry=%s, read=%s)", async (retry, deferredRead) => {
 const { controller, gateway, queue, notify } = setup();
 gateway.setUserFields([{ id: "stage", key: "staged", type: "date", displayName: "Staged" }]);
 const read = deferred<typeof task>(); let reads = 0; gateway.getTask = vi.fn(() => ++reads === deferredRead ? read.promise : Promise.resolve(task));
 const staging = new StagingStore({ gateway, log: vi.fn(), schedule: () => () => undefined });
 const destination = new StagingController({ gateway, queue, staging, store: { refreshNow: () => Promise.resolve() }, getSettings: () => ({ completionStatus: null }), settingsReady: () => Promise.resolve(), timerBusy: () => false, newCorrelationId: () => "stage", log: vi.fn() });
 let alive = true;
 const route = async (created: typeof task, canWrite: () => boolean) => {
  const result = await destination.stage({ taskPath: created.path, title: created.title }, canWrite);
  return { ok: result.kind === "staged", cancelled: result.kind === "cancelled" };
 };
 const previous = retry ? (await controller.create({ title: task.title }, () => alive, () => Promise.resolve({ ok: false }), vi.fn()))! : null;
 const result = previous ? controller.route(previous, () => alive, route).then(() => previous) : controller.create({ title: task.title }, () => alive, route, vi.fn());
 await flush(); expect(gateway.getTask).toHaveBeenCalledTimes(deferredRead); alive = false; read.resolve(task);
 expect((await result)?.state).toBe("cancelled"); expect(gateway.updateCalls).toEqual([]);
 expect(gateway.createTask).toHaveBeenCalledTimes(1); expect(notify).toHaveBeenCalledWith(expect.stringContaining("note remains available"));
 staging.dispose(); controller.dispose();
});
test.each([false, true])("created idle cancellation reaches deferred active read (retry=%s)", async retry => {
 const { controller, gateway, notify } = setup(); const log = vi.fn();
 const pauses = new PauseStore({ log }); pauses.load([]); const order = new CardOrderStore({ log }); order.load([]);
 const persist = vi.fn(() => Promise.resolve()); const read = deferred<[]>(); gateway.active = vi.fn(() => read.promise);
 const idle = new IdleCardStore({ gateway, pauses, order, persist, notify, log, controller: { start: vi.fn(), isBusy: () => false }, fileCheck: () => null, visibleKeys: () => [] }); idle.load({});
 let alive = true;
 const route = async (created: typeof task, canWrite: () => boolean) => {
  const outcome = await idle.add(created, canWrite);
  return { ok: outcome.kind === "added-and-saved", cancelled: outcome.kind === "cancelled" };
 };
 const previous = retry ? (await controller.create({ title: task.title }, () => alive, () => Promise.resolve({ ok: false }), vi.fn()))! : null;
 const result = previous ? controller.route(previous, () => alive, route).then(() => previous) : controller.create({ title: task.title }, () => alive, route, vi.fn());
 await flush(); expect(gateway.active).toHaveBeenCalled(); alive = false; read.resolve([]);
 expect((await result)?.state).toBe("cancelled"); expect(idle.models()).toEqual([]); expect(persist).not.toHaveBeenCalled();
 expect(gateway.createTask).toHaveBeenCalledTimes(1); expect(notify).toHaveBeenCalledWith(expect.stringContaining("note remains available"));
 idle.dispose(); controller.dispose();
});
test("close after idle persistence dispatch preserves successful outcome rather than claiming cancellation", async () => {
 const { controller, gateway, notify } = setup(); const log = vi.fn(); const save = deferred<void>();
 const pauses = new PauseStore({ log }); pauses.load([]); const order = new CardOrderStore({ log }); order.load([]);
 const persist = vi.fn(() => save.promise); const idle = new IdleCardStore({ gateway, pauses, order, persist, notify, log, controller: { start: vi.fn(), isBusy: () => false }, fileCheck: () => null, visibleKeys: () => [] }); idle.load({}); let alive = true;
 const result = controller.create({ title: task.title }, () => alive, async (created, canWrite) => {
  const outcome = await idle.add(created, canWrite); return { ok: outcome.kind === "added-and-saved", cancelled: outcome.kind === "cancelled" };
 }, vi.fn());
 await flush(); expect(persist).toHaveBeenCalledOnce(); alive = false; save.resolve();
 expect((await result)?.state).toBe("succeeded"); expect(notify).not.toHaveBeenCalled(); expect(idle.models()).toHaveLength(1);
 idle.dispose(); controller.dispose();
});

/* eslint-enable @typescript-eslint/unbound-method -- Restore method binding checks. */
