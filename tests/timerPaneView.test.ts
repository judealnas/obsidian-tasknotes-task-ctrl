import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("obsidian", () => import("./fakes/viewHost"));
const pickerHost = vi.hoisted(() => ({ instances: [] as Array<{ options: { mode?: string }; close: () => void }> }));
vi.mock("../src/ui/TaskPickerModal", () => ({ TaskPickerModal: class {
	options: { mode?: string };
	private off: (() => void) | undefined;
	private gateway: ReturnType<typeof createFakeGateway>;
	private didClose: () => void;
	constructor(_app: unknown, options: { mode?: string; gateway: ReturnType<typeof createFakeGateway>; onClose: () => void } | ReturnType<typeof createFakeGateway>, _controller?: unknown, onClose?: () => void) {
		this.options = "gateway" in options ? options : {};
		this.gateway = "gateway" in options ? options.gateway : options;
		this.didClose = "gateway" in options ? options.onClose : onClose!;
		pickerHost.instances.push(this);
	}
	open(): void { this.off = this.gateway.onState(() => { if (!this.gateway.startAvailability().available) this.close(); }); }
	close(): void { this.off?.(); this.didClose(); }
} }));
import type { WorkspaceLeaf } from "obsidian";
import { TimerPaneView, type TimerPaneServices } from "../src/ui/TimerPaneView";
import type { OpenTimer, TimerSnapshot } from "../src/model/timeMath";
import { CardOrderStore } from "../src/state/CardOrderStore";
import { StagingStore } from "../src/state/StagingStore";
import { TimerStore } from "../src/state/TimerStore";
import { TimerController } from "../src/state/TimerController";
import { PauseStore } from "../src/state/PauseStore";
import { WriteQueue } from "../src/state/WriteQueue";
import { StagingController } from "../src/state/StagingController";
import { StagedOrderStore } from "../src/state/StagedOrderStore";
import { CompletionStore } from "../src/state/CompletionStore";
import { CompletionController } from "../src/state/CompletionController";
import { IdleCardStore } from "../src/state/IdleCardStore";
import type { ActiveTimeEntry, TaskInfo } from "../src/tasknotes/runtime-api.types";
import { createFakeGateway } from "./fakes/fakeGateway";
import { Element, event, flush, resetViewHost, viewHost, transfer, hostDocument, hostWindow, HostEvent, workspace, Platform } from "./fakes/viewHost";

export function timer(patch: Partial<OpenTimer> = {}): OpenTimer {
	return { taskPath: "A.md", title: "Task A", startTime: "2026-11-13T12:00:00Z", startMs: 0, state: "running", sessionStartedAt: "2026-11-13T12:00:00Z", sessionKey: "a", sortMs: 0, accumulatedMs: 0, segmentStartMs: Date.parse("2026-11-13T12:00:00Z"), totalKnown: true, entries: [], displayKey: "", ...patch };
}
export function setup(initial: OpenTimer[] = [timer()], cardOrder = new CardOrderStore({ log: vi.fn() }), withStaging = false) {
	const gateway = createFakeGateway(); gateway.setState({ kind: "ready" });
	let snapshot: TimerSnapshot | null = { primary: initial[0] ?? null, others: initial.slice(1) };
	const listeners = new Set<() => void>();
	const busyListeners = new Set<() => void>();
	let busy = false;
	const controller = { stop: vi.fn(() => Promise.resolve()), pause: vi.fn(() => Promise.resolve()), resume: vi.fn(() => Promise.resolve()), stopPaused: vi.fn(() => Promise.resolve()), complete: vi.fn(() => Promise.resolve()), start: vi.fn(), pauseAll: vi.fn(), resumeAll: vi.fn(), stopAll: vi.fn(), completionAvailable: vi.fn(() => Promise.resolve(true)), isBusy: () => busy, subscribeBusy: (fn: () => void) => { busyListeners.add(fn); return () => busyListeners.delete(fn); } };
	const store = { getSnapshot: () => snapshot, getHeaderState: () => ({ readable: true, eligibleCount: 1, pausedCount: 1 }), subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, requestRefresh: vi.fn() };
	const stagedOrder = new StagedOrderStore({ log: vi.fn() }); stagedOrder.load([]);
	const pauses = new PauseStore({ log: vi.fn() }); pauses.load([]);
	const idleCards = new IdleCardStore({ gateway, pauses, order: cardOrder, controller, persist: () => Promise.resolve(), notify: vi.fn(), log: vi.fn(), fileCheck: () => null, visibleKeys: () => [] });
	idleCards.load({});
	const completions = new CompletionStore({ persist: () => Promise.resolve() }); completions.load({});
	const staging = new StagingStore({ gateway, completions, order: stagedOrder, schedule: (fn, ms) => { const timers = { setTimeout, clearTimeout }; const id = timers.setTimeout(fn, ms); return () => timers.clearTimeout(id); }, log: vi.fn() });
	const stagingController = new StagingController({ gateway, staging, store: { refreshNow: () => Promise.resolve() }, queue: new WriteQueue(), timerBusy: controller.isBusy, settingsReady: () => Promise.resolve(), getSettings: () => ({ completionStatus: null }), newCorrelationId: () => "test", log: vi.fn() });
	const view = new TimerPaneView({} as WorkspaceLeaf, { gateway, controller, completions, store, cardOrder, stagedOrder, idleCards, staging: withStaging ? staging : undefined, stagingController: withStaging ? stagingController : undefined } as unknown as TimerPaneServices);
	view.register(() => staging.dispose()); view.register(() => idleCards.dispose());
	const root = view.contentEl as unknown as Element;
	return { view, root, gateway, controller, completions, cardOrder, stagedOrder, store, staging, stagingController, idleCards,
		set(timers: OpenTimer[] | null) { snapshot = timers === null ? null : { primary: timers[0] ?? null, others: timers.slice(1) }; listeners.forEach(fn => fn()); },
		busy(value: boolean) { busy = value; busyListeners.forEach(fn => fn()); },
	};
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T12:01:00Z")); resetViewHost(); pickerHost.instances = []; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
test("product display name changes while saved pane identity stays unchanged", () => {
 const s = setup();
 expect(s.view.getDisplayText()).toBe("TaskNotes Task Control");
 expect(s.view.getViewType()).toBe("tasknotes-timer-pane"); s.view.unload();
});

test("uses the compact chip styles only when connected to TaskNotes 5", async () => {
 const s = setup();
 let major = 4;
 s.gateway.getTaskNotesMajorVersion = () => major;
 await s.view.onOpen();
 const pane = s.root.querySelector(".tntp-pane")!;
 expect(pane.classList.contains("tntp-pane--tasknotes-v5")).toBe(false);
 s.gateway.setState({ kind: "missing" });
 major = 5;
 s.gateway.setState({ kind: "ready" });
 expect(pane.classList.contains("tntp-pane--tasknotes-v5")).toBe(true);
 s.gateway.setState({ kind: "missing" });
 expect(pane.classList.contains("tntp-pane--tasknotes-v5")).toBe(false);
 await s.view.onClose(); s.view.unload();
});

test("fixed context metadata appears in both tabs without display controls", async () => {
 const task: TaskInfo = { path: "A.md", title: "Task A", status: "open", archived: false, contexts: ["work"], tags: ["urgent"] };
 const s = setup([timer({ task })], undefined, true);
 s.gateway.listTasks = () => Promise.resolve([{ ...task, staged: "2026-11-12" }]);
 await s.view.onOpen(); await s.staging.refreshNow(); await flush();
 expect(s.root.querySelectorAll(".tntp-staged-metadata").map(el => el.textContent)).toEqual(["Nov 12 · 1 day ago · @work", "Nov 12 · 1 day ago · @work"]);
 expect(s.root.querySelectorAll(".tntp-display-controls__button")).toHaveLength(0);
 expect(s.root.querySelectorAll(".tntp-card-details")).toHaveLength(0);
 await s.view.onClose(); s.view.unload();
});

test("the tab row plus opens the staging picker", async () => {
	const s = setup([], undefined, true);
	s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
	s.gateway.listTasks = () => Promise.resolve(["A.md", "B.md"].map(path => ({ path, title: path, status: "open", archived: false, staged: "2026-11-12" })));
	await s.view.onOpen(); await s.staging.refreshNow(); await flush();
	event(s.root.querySelectorAll(".tntp-tabs__tab")[0]!, "click");
	event(s.root.querySelector(".tntp-start")!, "click");
	expect(pickerHost.instances[pickerHost.instances.length - 1]!.options).toMatchObject({ mode: "stage", beforePath: null });
	s.busy(true); expect(s.root.querySelector(".tntp-start")!.disabled).toBe(true);
	await s.view.onClose(); s.view.unload();
});

test("both tabs share task relationship reads without polling on timer ticks", async () => {
 const task: TaskInfo = { path: "A.md", title: "Task A", status: "open", archived: false };
 const parent: TaskInfo = { ...task, path: "Parent.md", title: "Research paper" };
 const child: TaskInfo = { ...task, path: "Child.md", title: "Summarize measurements", status: "done" };
 const s = setup([timer({ task })], undefined, true);
 s.gateway.listTasks = () => Promise.resolve([{ ...task, staged: "2026-11-12" }]);
 const readParents = vi.fn(() => Promise.resolve([parent])); s.gateway.parents = readParents;
 const readSubtasks = vi.fn(() => Promise.resolve([child])); s.gateway.subtasks = readSubtasks;
 s.gateway.statuses = () => Promise.resolve([{ value: "done", isCompleted: true }]);
 await s.view.onOpen(); await s.staging.refreshNow(); await flush(); await flush();
 for (const tab of ["staged", "timers"]) {
  const card = s.root.querySelector(`.tntp-panel--${tab}`)!.querySelector(".tntp-card")!;
  expect(card.textContent).toContain("Research paper");
  expect(card.textContent).toContain("1 of 1 complete");
  expect(card.textContent).toContain("Summarize measurements");
 }
 expect(readParents).toHaveBeenCalledTimes(1);
 expect(readSubtasks).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(3000); await flush();
 expect(readParents).toHaveBeenCalledTimes(1);
 expect(readSubtasks).toHaveBeenCalledTimes(1);
 await s.view.onClose(); s.view.unload();
 s.gateway.emitData(); await flush();
 expect(readParents).toHaveBeenCalledTimes(1);
 expect(readSubtasks).toHaveBeenCalledTimes(1);
});

test("staged subtask cards nest separately from their native relationship links", async () => {
 const task = (name: string, staged: boolean) => ({
  path: `${name}.md`, title: name, status: "open", archived: false, staged: staged ? "2026-11-12" : null,
 });
 const parent = task("Workshop", true);
 const child = task("Exercises", true);
 const sibling = task("Handout", true);
 const grandchild = task("Solution", true);
 const unstaged = task("Practice", false);
 const standalone = task("Report", true);
 const otherChild = task("Outline", true);
 const s = setup([], undefined, true);
 s.stagedOrder.set([parent.path, grandchild.path, standalone.path, child.path, sibling.path, otherChild.path]);
 s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
 s.gateway.listTasks = () => Promise.resolve([parent, grandchild, standalone, child, sibling, otherChild, unstaged]);
 const subtasks = new Map([[parent.path, [child, sibling]], [child.path, [grandchild, unstaged]], [standalone.path, [otherChild]]]);
 s.gateway.subtasks = path => Promise.resolve(subtasks.get(path) ?? []);
 s.gateway.parents = path => Promise.resolve(path === grandchild.path ? [child] : []);
 await s.view.onOpen(); await s.staging.refreshNow(); await flush(); await flush();
 const panel = s.root.querySelector(".tntp-panel--staged")!;
 const cards = () => panel.querySelectorAll(".tntp-card");
 const titleOrder = () => panel.querySelectorAll(".tntp-title").map(el => el.textContent);
 expect(titleOrder()).toEqual(["Workshop", "Exercises", "Solution", "Handout", "Report", "Outline"]);
 const [parentCard, childCard, grandchildCard, siblingCard, , otherChildCard] = cards();
 expect(cards().map(card => card.style.getPropertyValue("--tntp-staged-depth"))).toEqual(["0", "1", "2", "1", "0", "1"]);
 expect(childCard!.querySelector(".tntp-tree-guide--branch")).toBeTruthy();
 expect(grandchildCard!.querySelector(".tntp-tree-guide--line")).toBeTruthy();
 expect(siblingCard!.querySelector(".tntp-tree-guide--end")).toBeTruthy();
 const practiceRender = viewHost.renders.find(entry => entry.markdown === "[[Practice]]")!;
 practiceRender.resolve("chip"); await flush();
 expect(childCard!.querySelector(".tntp-relationships__list")!.querySelectorAll("li")).toHaveLength(2);
 expect(childCard!.querySelector(".tntp-relationships__list")!.textContent).toContain("Simulated chip");

 const parentToggle = parentCard!.querySelector(".tntp-group-toggle")!;
 const childToggle = childCard!.querySelector(".tntp-group-toggle")!;
 event(childToggle, "click");
 expect(grandchildCard!.hidden).toBe(true);
 event(parentToggle, "click");
 expect(childCard!.hidden).toBe(true);
 expect(parentCard!.querySelector(".tntp-relationships__list")!.textContent).toContain("Exercises");
 event(parentToggle, "click");
 expect(childCard!.hidden).toBe(false);
 expect(grandchildCard!.hidden).toBe(true);
 event(childToggle, "click");
 expect(grandchildCard!.hidden).toBe(false);

 const childHandle = childCard!.querySelector(".tntp-handle")!;
 event(childHandle, "keydown", { key: "ArrowDown" });
 expect(titleOrder()).toEqual(["Workshop", "Handout", "Exercises", "Solution", "Report", "Outline"]);
 expect(grandchildCard!.querySelector(".tntp-tree-guide--line")).toBeNull();
 const order = s.stagedOrder.get();
 const dataTransfer = transfer();
 event(childHandle, "dragstart", { dataTransfer });
 event(otherChildCard!, "dragover", { dataTransfer, clientY: 10 });
 expect(otherChildCard!.classes.has("tntp-card--drop-before")).toBe(false);
 event(otherChildCard!, "drop", { dataTransfer, clientY: 10 });
 expect(s.stagedOrder.get()).toEqual(order);
 event(childHandle, "dragend");
 event(childHandle, "dragstart", { dataTransfer });
 event(siblingCard!, "dragover", { dataTransfer, clientY: 10 });
 expect(siblingCard!.classes.has("tntp-card--drop-before")).toBe(true);
 event(siblingCard!, "drop", { dataTransfer, clientY: 10 });
 expect(titleOrder()).toEqual(["Workshop", "Exercises", "Solution", "Handout", "Report", "Outline"]);
 expect(grandchildCard!.querySelector(".tntp-tree-guide--line")).toBeTruthy();

 event(parentCard!.querySelector(".tntp-handle")!, "keydown", { key: "ArrowDown" });
 expect(titleOrder()).toEqual(["Report", "Outline", "Workshop", "Exercises", "Solution", "Handout"]);
 expect(cards()[2]).toBe(parentCard);
 child.staged = null; await s.staging.refreshNow(); await flush();
 expect(titleOrder()).toEqual(["Report", "Outline", "Workshop", "Solution", "Handout"]);
 expect(cards()[3]).toBe(grandchildCard);
 expect(grandchildCard!.style.getPropertyValue("--tntp-staged-depth")).toBe("1");
 await s.view.onClose(); s.view.unload();
});

test("mobile arrows reorder both owning lists, announce once and retain boundary focus", async () => {
 Platform.isMobile = true;
 const s = setup([timer(), timer({ taskPath: "B.md", sessionKey: "b", state: "paused", title: "Task B", segmentStartMs: null })], undefined, true);
 s.gateway.listTasks = () => Promise.resolve(["A", "B", "C"].map(name => ({ path: `${name}.md`, title: `Task ${name}`, status: "open", archived: false, staged: "2026-11-12" })));
 await s.view.onOpen(); await s.staging.refreshNow(); await flush();
 const staged = s.root.querySelector(".tntp-panel--staged")!;
 const timers = s.root.querySelector(".tntp-panel--timers")!;
 const cards = staged.querySelectorAll(".tntp-card");
 expect(cards).toHaveLength(3);
 expect(cards.every(card => card.querySelector(".tntp-reorder")!.children.map(button => button.textContent).join("") === "▲▼")).toBe(true);
 expect(timers.querySelectorAll(".tntp-reorder")).toHaveLength(2);
 expect(cards[0]!.querySelector(".tntp-reorder__up")!.disabled).toBe(true);
 expect(cards[2]!.querySelector(".tntp-reorder__down")!.disabled).toBe(true);
 const status = s.root.querySelector(".tntp-reorder-status")!;
 const speak = vi.spyOn(status, "setText");
 const down = cards[0]!.querySelector(".tntp-reorder__down")!;
 down.focus(); event(down, "click");
 expect(s.stagedOrder.get()).toEqual(["B.md", "A.md", "C.md"]);
 expect(hostDocument.activeElement).toBe(down);
 expect(status.textContent).toBe("Task A, position 2 of 3"); expect(speak).toHaveBeenCalledTimes(1);
 event(down, "click");
 expect(staged.querySelectorAll(".tntp-card")[2]).toBe(cards[0]);
 expect(hostDocument.activeElement).toBe(cards[0]!.querySelector(".tntp-reorder__up"));
 expect(status.textContent).toBe("Task A, position 3 of 3"); expect(speak).toHaveBeenCalledTimes(2);
 event(down, "click"); expect(speak).toHaveBeenCalledTimes(2);
 await s.staging.refreshNow(); expect(speak).toHaveBeenCalledTimes(2);
 const stageOrder = s.stagedOrder.get();
 const timerDown = timers.querySelector(".tntp-reorder__down")!; event(timerDown, "click");
 expect(s.cardOrder.get()).toEqual(["b", "a"]); expect(s.stagedOrder.get()).toEqual(stageOrder);
 expect(s.gateway.updateCalls).toEqual([]); expect(s.gateway.stopCalls).toEqual([]);
 await s.view.onClose(); s.view.unload();
 const calls = speak.mock.calls.length; event(down, "click"); expect(speak).toHaveBeenCalledTimes(calls);
});

test("empty and single mobile lists have no possible move and desktop creates no arrows", async () => {
 Platform.isMobile = true;
 const mobile = setup([timer()]); await mobile.view.onOpen(); await flush();
 const up = mobile.root.querySelector(".tntp-reorder__up")!;
 const down = mobile.root.querySelector(".tntp-reorder__down")!;
 expect(up.disabled).toBe(true); expect(down.disabled).toBe(true);
 event(up, "click"); event(down, "click"); expect(mobile.cardOrder.get()).toEqual([]);
 mobile.set([]); expect(mobile.root.querySelectorAll(".tntp-reorder")).toEqual([]);
 await mobile.view.onClose(); mobile.view.unload();
 Platform.isMobile = false;
 const desktop = setup(); await desktop.view.onOpen(); await flush();
 expect(desktop.root.querySelectorAll(".tntp-reorder")).toEqual([]);
 await desktop.view.onClose(); desktop.view.unload();
});

test("external completion removes a staged card without creating a Done today section", async () => {
 const s = setup([], undefined, true); let status = "open";
 s.gateway.statuses = () => Promise.resolve([{ value: "done", label: "Done", isCompleted: true }]);
 s.gateway.listTasks = () => Promise.resolve([{ path: "External.md", title: "Task", status, archived: false, staged: "2026-11-12" }]);
 await s.view.onOpen(); await s.staging.refreshNow();
 expect(s.root.querySelector(".tntp-panel--staged")!.querySelectorAll(".tntp-card")).toHaveLength(1);
 status = "done"; await s.staging.refreshNow(); await flush();
 expect(s.root.querySelector(".tntp-panel--staged")!.querySelectorAll(".tntp-card")).toHaveLength(0);
 expect(s.root.querySelector(".tntp-done-today")).toBeNull();
 expect(s.gateway.updateCalls).toEqual([]);
 await s.view.onClose(); s.view.unload();
});

test("ordinary pane completion removes its staged card without history UI", async () => {
 const s = setup([], undefined, true);
 let task: TaskInfo & { staged?: unknown } = { path: "A.md", title: "A", status: "open", archived: false, staged: "2026-11-12" };
 s.gateway.statuses = () => Promise.resolve([{ value: "done", label: "Done", isCompleted: true }]);
 s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
 s.gateway.listTasks = () => Promise.resolve([structuredClone(task)]);
 s.gateway.getTask = () => Promise.resolve(structuredClone(task));
 s.gateway.completeTask = (_path, status) => { task = { ...task, status }; return Promise.resolve(structuredClone(task)); };
 s.gateway.updateTask = (_path, patch) => { task = { ...task, ...patch }; return Promise.resolve(); };
 const notify = vi.fn();
 const queue = new WriteQueue();
 const realStore = new TimerStore({ gateway: s.gateway, log: vi.fn(), schedule: () => () => undefined });
 const timerController = new TimerController({ gateway: s.gateway, store: realStore, queue, notify, log: vi.fn(), newCorrelationId: () => "test" });
 const completion = new CompletionController({ gateway: s.gateway, queue, timer: timerController, notify, log: vi.fn(), newCorrelationId: () => "test", settingsReady: () => Promise.resolve(), getSettings: () => ({ completionStatus: "done" }), getRecords: () => s.completions.records(), storageAvailable: () => s.completions.available(), saveRecord: record => s.completions.saveRecord(record), clearPause: () => undefined, refresh: () => s.staging.refreshNow() });
 s.controller.complete.mockImplementation(async (...args: unknown[]) => { const target = args[0] as { taskPath: string; title: string }; await completion.complete({ sourcePath: target.taskPath, title: target.title }); });
 // The production card callback routes through TimerController's shared handler.
 (s.view as unknown as { services: TimerPaneServices }).services.completion = completion;
 await s.view.onOpen(); await s.staging.refreshNow(); await flush();
 const button = s.root.querySelector(".tntp-panel--staged")!.querySelector(".tntp-complete")!;
 expect(button.disabled).toBe(false); event(button, "click");
 for (let i = 0; i < 30; i++) await flush();
 expect(s.root.querySelector(".tntp-panel--staged")!.querySelectorAll(".tntp-card")).toHaveLength(0);
 expect(s.root.querySelector(".tntp-done-today")).toBeNull();
 expect(notify).not.toHaveBeenCalled();
 await s.view.onClose(); s.view.unload(); realStore.dispose();
});

test("a hidden pane updates calendar age across midnight without clearing staged cards", async () => {
 vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 59));
 const s = setup([], undefined, true);
 s.gateway.listTasks = () => Promise.resolve([{ path: "B.md", title: "B", status: "open", archived: false, staged: "2026-11-12" }]);
 await s.view.onOpen(); await s.staging.refreshNow(); await flush();
 expect(s.staging.getSnapshot().items[0]?.age).toBe(1);
 (s.view.contentEl as unknown as Element).shown = false;
 s.gateway.listTasks = () => Promise.reject(new Error("offline"));
 await vi.advanceTimersByTimeAsync(1000); await flush();
 expect(s.staging.getSnapshot().items[0]?.age).toBe(2);
 expect(s.staging.getSnapshot().items).toHaveLength(1);
 expect(s.gateway.updateCalls).toEqual([]);
 await s.view.onClose(); s.view.unload();
});

test("externally staged tasks reach the production Staged panel without mutations", async () => {
	const s = setup([], undefined, true);
	s.gateway.listTasks = vi.fn(() => Promise.resolve([{ path: "External.md", title: "Externally staged task", status: "open", archived: false, staged: "2026-11-12" }]));
	s.gateway.setUserFields([{ id: "staged", displayName: "Staged", key: "staged", type: "date" }]);
	await s.view.onOpen();
	s.gateway.emitData();
	await vi.advanceTimersByTimeAsync(200); await flush();
	const panel = s.root.querySelector(".tntp-panel--staged")!;
	expect(panel.querySelectorAll(".tntp-card")).toHaveLength(1);
	expect(panel.textContent).toContain("Externally staged task");
	expect(s.gateway.updateCalls).toHaveLength(0);
	expect(s.gateway.startCalls).toHaveLength(0);
	expect(s.gateway.stopCalls).toHaveLength(0);
	await s.view.onClose(); s.view.unload();
});

test("staging Retry is the enabled panel focus target after an initial read failure", async () => {
	const s = setup([], undefined, true);
	s.gateway.listTasks = () => Promise.reject(new Error("offline"));
	await s.view.setState({ tab: "staged" }, { history: false }); await s.view.onOpen();
	await s.staging.refreshNow(); await flush();
	const panel = s.root.querySelector(".tntp-panel--staged")!;
	expect(panel.textContent).toContain("Couldn't refresh");
	expect(panel.getAttribute("tabindex")).toBe("-1");
	expect(panel.querySelector(".tntp-message__retry")!.disabled).toBe(false);
	await s.view.onClose(); s.view.unload();
});

test("the separate Unstage control is immediately usable on a staged idle task", async () => {
	const s = setup([], undefined, true);
	let staged: string | null = "2026-11-12";
	s.gateway.listTasks = () => Promise.resolve([{ path: "External.md", title: "External", status: "open", archived: false, staged }]);
	const update = s.gateway.updateTask.bind(s.gateway); s.gateway.updateTask = async (...args) => { await update(...args); staged = null; };
	s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
	await s.view.onOpen(); await s.staging.refreshNow(); await flush();
	const unstage = s.root.querySelector(".tntp-panel--staged")!.querySelector(".tntp-unstage")!;
	expect(unstage.disabled).toBe(false);
	event(unstage, "click"); for (let i = 0; i < 12; i++) await flush();
	expect(s.gateway.updateCalls.map(call => call.patch)).toEqual([{ staged: null }]); expect(s.gateway.stopCalls).toHaveLength(0);
	expect(s.root.querySelector(".tntp-panel--staged")!.querySelectorAll(".tntp-card")).toHaveLength(0);
	await s.view.onClose(); s.view.unload();
});

test("ArrowDown reorders only the Staged list and preserves handle focus", async () => {
	const s = setup([timer({ taskPath: "Timer.md" })], undefined, true);
	s.gateway.listTasks = () => Promise.resolve(["A", "B"].map(name => ({ path: `${name}.md`, title: name, status: "open", archived: false, staged: "2026-11-12" })));
	await s.view.onOpen(); await s.staging.refreshNow(); await flush();
	const panel = s.root.querySelector(".tntp-panel--staged")!;
	const handle = panel.querySelector(".tntp-handle")!; handle.focus(); event(handle, "keydown", { key: "ArrowDown" });
	expect(panel.querySelectorAll(".tntp-title").map(title => title.textContent).join(",")).toBe("B,A");
	expect(s.cardOrder.get()).toEqual([]); expect(hostDocument.activeElement).toBe(handle);
	await s.view.onClose(); s.view.unload();
});

test("both tab labels always encode numeric zero counts", async () => {
	const s = setup([], undefined, true); s.store.getHeaderState = () => ({ readable: true, eligibleCount: 0, pausedCount: 0 });
	await s.view.onOpen(); await s.staging.refreshNow(); await flush();
	expect(s.root.querySelectorAll(".tntp-tabs__tab").map(tab => tab.textContent).join(",")).toBe("Staged 0,Timers 0");
	await s.view.onClose(); s.view.unload();
});

test("shared counts, running accent, markers and orders never navigate independent leaves", async () => {
	const s = setup([timer(), timer({ taskPath: "C.md", title: "C", state: "paused", sessionKey: "c", segmentStartMs: null })], undefined, true);
	let running = 1; s.store.getHeaderState = () => ({ readable: true, eligibleCount: running, pausedCount: 1 });
	let tasks = ["A", "B"].map(name => ({ path: `${name}.md`, title: name, status: "open", archived: false, staged: "2026-11-12" }));
	s.gateway.listTasks = () => Promise.resolve(tasks);
	const other = new TimerPaneView({} as WorkspaceLeaf, { gateway: s.gateway, store: s.store, controller: s.controller, cardOrder: s.cardOrder, stagedOrder: s.stagedOrder, staging: s.staging, stagingController: s.stagingController } as unknown as TimerPaneServices);
	await s.view.setState({ tab: "staged" }, { history: false }); await s.view.onOpen(); await other.onOpen(); await s.staging.refreshNow(); await flush();
	const second = other.contentEl as unknown as Element;
	const tabs = s.root.querySelectorAll(".tntp-tabs__tab"); const staged = s.root.querySelector(".tntp-panel--staged")!; const timers = s.root.querySelector(".tntp-panel--timers")!;
	expect(tabs.map(tab => tab.textContent)).toEqual(["Staged 2", "Timers 1"]);
	expect(tabs[0]!.classes.has("tntp-tabs__tab--active")).toBe(true); expect(tabs[1]!.classes.has("tntp-tabs__tab--active")).toBe(false);
	expect(tabs[0]!.querySelector(".tntp-tabs__count")!.classes.has("tntp-tabs__count--running")).toBe(false); expect(tabs[1]!.querySelector(".tntp-tabs__count")!.classes.has("tntp-tabs__count--running")).toBe(true);
	const timedCard = timers.querySelector(".tntp-card")!; const timedTitle = timedCard.querySelector(".tntp-title")!;
	expect(timedCard.querySelector(".tntp-staged-metadata")!.textContent).toBe("Nov 12 · 1 day ago"); expect(staged.querySelector(".tntp-card")).not.toBe(timedCard);
	const handle = staged.querySelector(".tntp-handle")!; handle.focus(); event(handle, "keydown", { key: "ArrowDown" });
	expect(staged.querySelectorAll(".tntp-title").map(el => el.textContent)).toEqual(["B", "Task A"]);
	expect(second.querySelector(".tntp-panel--staged")!.querySelectorAll(".tntp-title").map(el => el.textContent)).toEqual(["B", "Task A"]);
	s.cardOrder.set(["c", "a"]); expect(s.stagedOrder.get()).toEqual(["B.md", "A.md"]);
	const payload = transfer(); event(handle, "dragstart", { dataTransfer: payload }); event(timers.querySelector(".tntp-card")!, "drop", { dataTransfer: payload }); expect(s.stagedOrder.get()).toEqual(["B.md", "A.md"]);
	event(staged.querySelector(".tntp-card")!, "drop", { dataTransfer: payload, clientY: 0 }); expect(s.stagedOrder.get()).toEqual(["A.md", "B.md"]); expect(s.cardOrder.get()).toEqual(["c", "a"]);
	running = 0; s.set([timer({ state: "paused", segmentStartMs: null })]); await flush(); expect(tabs[1]!.textContent).toBe("Timers 0"); expect(tabs[1]!.querySelector(".tntp-tabs__count")!.classes.has("tntp-tabs__count--running")).toBe(false);
	tasks = tasks.filter(task => task.path === "B.md"); s.gateway.emitData(); await vi.advanceTimersByTimeAsync(200); await flush();
	expect(tabs[0]!.textContent).toBe("Staged 1"); expect(timers.querySelector(".tntp-title")).toBe(timedTitle); expect(timedCard.querySelector(".tntp-staged-metadata")!.textContent).toBe("");
	expect(s.view.getState().tab).toBe("staged"); expect(other.getState().tab).toBe("timers"); expect(workspace.requestSaveLayout).not.toHaveBeenCalled();
	await s.view.onClose(); s.view.unload(); await other.onClose(); other.unload();
});

test("staging setup corrections, default and unsupported states preserve cards and Timers", async () => {
	const s = setup([timer()], undefined, true);
	s.gateway.listTasks = () => Promise.resolve([{ path: "External.md", title: "Keep this card", status: "open", archived: false, staged: "2026-11-12" }]);
	await s.view.onOpen(); await s.staging.refreshNow(); await flush();
	const panel = s.root.querySelector(".tntp-panel--staged")!;
	const card = panel.querySelector(".tntp-card")!; const title = card.querySelector(".tntp-title")!;
	expect(panel.textContent).toContain("Custom User Fields");
	expect(panel.textContent).toContain("type Date and no default");
	s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "text" }]);
	await s.staging.refreshNow(); expect(panel.textContent).toContain("Set up");
	s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date", defaultValue: "2026-11-13" }]);
	await s.staging.refreshNow(); expect(panel.textContent).toContain("Remove the staged field default");
	expect(card.querySelector(".tntp-pause-resume")!.disabled).toBe(false);
	expect(card.querySelector(".tntp-complete")!.disabled).toBe(true);
	event(card.querySelector(".tntp-complete")!, "click"); expect(s.controller.complete).not.toHaveBeenCalled();
	event(title, "click"); expect(workspace.openLinkText).toHaveBeenCalledWith("External.md", "", false);
	event(title, "contextmenu"); expect(s.gateway.menuCalls[s.gateway.menuCalls.length - 1]?.taskPath).toBe("External.md");
	event(card.querySelector(".tntp-pause-resume")!, "click"); expect(s.controller.start).toHaveBeenCalledWith({ taskPath: "External.md", title: "Keep this card" });
	s.gateway.failUserFieldsWith(new Error("offline")); await s.staging.refreshNow();
	expect(panel.textContent).toContain("Couldn't check"); expect(panel.querySelector(".tntp-card")).toBe(card); expect(card.querySelector(".tntp-title")).toBe(title);
	s.gateway.failUserFieldsWith(null); s.gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]); await s.staging.refreshNow();
	expect(s.staging.getSnapshot().canStage).toBe(true);
	s.gateway.setStagingAvailable(false); await s.staging.refreshNow(); expect(panel.textContent).toContain("4.13.0 or newer");
	expect(s.root.querySelector(".tntp-start")!.disabled).toBe(false);
	expect(s.gateway.updateCalls).toEqual([]);
	await s.view.onClose(); s.view.unload();
});

test("a real staged card joins running and paused timer sessions without replacing its DOM", async () => {
	const gateway = createFakeGateway();
	let task: TaskInfo = { path: "Work.md", title: "Work", status: "open", archived: false, timeEntries: [], ...{ staged: "2026-11-12" } };
	gateway.listTasks = () => Promise.resolve([task]); gateway.getTask = () => Promise.resolve(task);
	gateway.setUserFields([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
	const originalStart = gateway.start.bind(gateway); const originalStop = gateway.stop.bind(gateway);
	gateway.start = async (path, options, context) => {
		await originalStart(path, options, context);
		const entry = { startTime: new Date().toISOString() }; task = { ...task, timeEntries: [...task.timeEntries ?? [], entry] };
		gateway.setActive([{ taskPath: path, task, entry, index: task.timeEntries!.length - 1 }]);
	};
	gateway.stop = async (path, context) => { task = await originalStop(path, context); task = { ...task, ...{ staged: "2026-11-12" } }; gateway.setActive([]); return task; };
	const schedule = (fn: () => void, ms: number) => { const timers = { setTimeout, clearTimeout }; const id = timers.setTimeout(fn, ms); return () => timers.clearTimeout(id); };
	const pauses = new PauseStore({ log: vi.fn() }); pauses.load([]);
	const store = new TimerStore({ gateway, pauses, log: vi.fn(), schedule });
	const staging = new StagingStore({ gateway, schedule, log: vi.fn() });
	const notify = vi.fn(); const controller = new TimerController({ gateway, store, pauses, queue: new WriteQueue(), log: vi.fn(), notify, newCorrelationId: () => "test" });
	const complete = vi.spyOn(controller, "complete");
	const view = new TimerPaneView({} as WorkspaceLeaf, { gateway, store, staging, controller, cardOrder: new CardOrderStore({ log: vi.fn() }) });
	await view.onOpen(); await Promise.all([store.refreshNow(), staging.refreshNow()]); await flush();
	const panel = (view.contentEl as unknown as Element).querySelector(".tntp-panel--staged")!;
	const card = panel.querySelector(".tntp-card")!; const title = card.querySelector(".tntp-title")!;
	const action = card.querySelector(".tntp-pause-resume")!; action.focus();
	event(card.querySelector(".tntp-complete")!, "click");
	event(action, "click"); for (let i = 0; i < 8; i++) await flush();
	expect(card.querySelector(".tntp-pause-resume__label")!.textContent).toBe("Pause");
	const timerCard = (view.contentEl as unknown as Element).querySelector(".tntp-panel--timers")!.querySelector(".tntp-card")!;
	for (const activeCard of [card, timerCard]) {
		const stats = activeCard.querySelector(".tntp-timer-stats")!;
		expect(stats.querySelector(".tntp-clock")).toBeTruthy();
		expect(stats.querySelector(".tntp-total")).toBeTruthy();
	}
	event(card.querySelector(".tntp-complete")!, "click");
	await vi.advanceTimersByTimeAsync(2000); expect(card.querySelector(".tntp-clock")!.textContent).toBe("0:00:02");
	event(action, "click"); for (let i = 0; i < 8; i++) await flush();
	expect(card.querySelector(".tntp-pause-resume__label")!.textContent).toBe("Resume");
	event(card.querySelector(".tntp-complete")!, "click");
	await vi.advanceTimersByTimeAsync(3000); expect(card.querySelector(".tntp-clock")!.textContent).toBe("0:00:02");
	event(action, "click"); for (let i = 0; i < 8; i++) await flush();
	await vi.advanceTimersByTimeAsync(1000); expect(card.querySelector(".tntp-clock")!.textContent).toBe("0:00:03");
	expect(panel.querySelector(".tntp-card")).toBe(card); expect(card.querySelector(".tntp-title")).toBe(title); expect(hostDocument.activeElement).toBe(action);
	expect(card.querySelector(".tntp-complete")!.disabled).toBe(true);
	event(card.querySelector(".tntp-stop")!, "click"); for (let i = 0; i < 8; i++) await flush();
	expect(card.querySelector(".tntp-pause-resume__label")!.textContent).toBe("Start");
	expect(panel.querySelector(".tntp-card")).toBe(card);
	const owned: ActiveTimeEntry = { taskPath: task.path, task, entry: { startTime: new Date().toISOString() }, index: 0 };
	gateway.setActive([owned]); gateway.setOwnership({ readable: true, owner: { taskPath: task.path, startTime: owned.entry.startTime } });
	await store.refreshNow(); await flush(); expect(card.querySelector(".tntp-pause-resume__label")!.textContent).toBe("Start");
	const starts = gateway.startCalls.length; event(action, "click"); for (let i = 0; i < 8; i++) await flush();
	expect(gateway.startCalls).toHaveLength(starts); expect(notify).toHaveBeenLastCalledWith("Work is being timed by Pomodoro."); expect(complete).not.toHaveBeenCalled();
	await view.onClose(); view.unload(); staging.dispose(); store.dispose();
});

test("Add task opens the picker once and releases its guard after close and bridge loss", async () => {
	const s = setup(); await s.view.onOpen(); await flush();
	const start = s.root.querySelector(".tntp-start")!;
	s.busy(true); event(start, "click"); expect(pickerHost.instances).toHaveLength(0); s.busy(false);
	event(start, "click"); event(start, "click"); expect(pickerHost.instances).toHaveLength(1);
	expect(pickerHost.instances[0]!.options.mode).toBe("add");
	pickerHost.instances[0]!.close(); event(start, "click"); expect(pickerHost.instances).toHaveLength(2);
	s.gateway.setState({ kind: "missing" }); event(start, "click"); expect(pickerHost.instances).toHaveLength(2);
	s.gateway.setState({ kind: "ready" }); event(start, "click"); expect(pickerHost.instances).toHaveLength(3);
	await s.view.onClose(); s.view.unload();
});

test("both tabs share connection messages and disable cached header actions until the snapshot is ready", async () => {
	for (const tab of ["staged", "timers"] as const) {
		const s = setup(); await s.view.setState({ tab }, { history: false }); await s.view.onOpen(); await flush();
		const panel = s.root.querySelector(`.tntp-panel--${tab}`)!;
		for (const state of [{ kind: "missing" }, { kind: "incompatible", version: "4.9.0" }, { kind: "loading" }] as const) {
			s.gateway.setState(state); await flush();
			expect(s.view.getState().tab).toBe(tab);
			for (const selector of [".tntp-start", ".tntp-pause-all", ".tntp-resume-all", ".tntp-stop-all"]) expect(s.root.querySelector(selector)!.disabled).toBe(true);
			expect(panel.querySelector(".tntp-message__body")!.textContent).toContain(state.kind === "loading" ? "Connecting" : "This pane needs");
			if (state.kind === "incompatible") expect(panel.querySelector(".tntp-message__meta")!.textContent).toBe("Installed version: 4.9.0");
			const probes = s.gateway.probeCalls; event(panel.querySelector(".tntp-message__retry")!, "click"); expect(s.gateway.probeCalls).toBe(probes + 1);
		}
		s.set(null); s.gateway.setState({ kind: "ready" }); await flush();
		expect(panel.querySelector(".tntp-message__body")!.textContent).toBe("Connecting to TaskNotes…");
		expect(panel.classes.has("tntp-panel--loading")).toBe(true);
		s.set([timer({ state: "paused", segmentStartMs: null })]); await flush();
		expect(s.view.getState().tab).toBe(tab);
		expect(s.root.querySelectorAll(".tntp-card")).toHaveLength(1);
		await s.view.onClose(); s.view.unload();
	}
});

test("Staged retains shell wake focus visibility and reveal refresh without writes and closes late completion", async () => {
	const s = setup(); await s.view.setState({ tab: "staged" }, { history: false });
	let finish!: (ready: boolean) => void;
	s.controller.completionAvailable.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
	await s.view.onOpen();
	vi.advanceTimersByTime(1000); const refreshes = s.store.requestRefresh.mock.calls.length;
	vi.setSystemTime(new Date("2026-11-13T13:00:00Z")); vi.advanceTimersByTime(1000);
	expect(s.store.requestRefresh.mock.calls.length).toBeGreaterThan(refreshes);
	for (const [target, type] of [[hostWindow, "focus"], [hostDocument, "visibilitychange"]] as const) {
		const before = s.store.requestRefresh.mock.calls.length; target.dispatchEvent(new HostEvent(type)); expect(s.store.requestRefresh.mock.calls.length).toBeGreaterThan(before);
	}
	s.root.shown = false; vi.advanceTimersByTime(1000); s.root.shown = true;
	const before = s.store.requestRefresh.mock.calls.length; vi.advanceTimersByTime(1000); expect(s.store.requestRefresh.mock.calls.length).toBeGreaterThan(before);
	s.set([timer({ title: "Started elsewhere" })]); finish(true); await flush();
	expect(s.view.getState().tab).toBe("staged");
	event(s.root.querySelectorAll(".tntp-tabs__tab")[1]!, "click"); expect(s.root.textContent).toContain("Started elsewhere");
	for (const fn of [s.controller.stop, s.controller.start, s.controller.pause, s.controller.resume, s.controller.complete, s.controller.stopAll, s.controller.pauseAll, s.controller.resumeAll]) expect(fn).not.toHaveBeenCalled();
	expect(s.gateway.startCalls).toHaveLength(0); expect(s.gateway.stopCalls).toHaveLength(0); expect(s.gateway.updateCalls).toHaveLength(0);
	await s.view.onClose(); s.view.unload();
	const afterClose = s.store.requestRefresh.mock.calls.length;
	hostWindow.dispatchEvent(new HostEvent("focus")); hostDocument.dispatchEvent(new HostEvent("visibilitychange")); vi.advanceTimersByTime(10000);
	s.gateway.setState({ kind: "missing" }); finish(true); await flush();
	expect(s.store.requestRefresh).toHaveBeenCalledTimes(afterClose);
	expect(vi.getTimerCount()).toBe(0);
});

test("serializes explicit selection and requests layout saving after state changes", async () => {
	const s = setup(); await s.view.onOpen();
	const observed: unknown[] = [];
	workspace.requestSaveLayout.mockImplementation(() => { observed.push(s.view.getState().tab); });
	event(s.root.querySelectorAll(".tntp-tabs__tab")[0]!, "click");
	expect(s.view.getState().tab).toBe("staged");
	expect(observed.join(",")).toBe("staged");
	await s.view.onClose();
});

test("restores both lifecycle orders with malformed state falling back to timers", async () => {
	const cases: Array<[unknown, string]> = [[{ tab: "staged" }, "staged"], [{ tab: "timers" }, "timers"], [undefined, "timers"], [null, "timers"], [{}, "timers"], ["staged", "timers"], [true, "timers"], [42, "timers"], [["staged"], "timers"], [{ tab: 1 }, "timers"], [{ tab: "other" }, "timers"]];
	for (const before of [true, false]) for (const [state, expected] of cases) {
		const s = setup();
		if (!before) await s.view.onOpen();
		await s.view.setState(state, { history: false });
		if (before) await s.view.onOpen();
		expect(s.view.getState().tab).toBe(expected);
		expect(s.root.querySelectorAll(".tntp-tabs__tab")[expected === "staged" ? 0 : 1]!.getAttribute("aria-selected")).toBe("true");
		await s.view.onClose();
	}
	expect(workspace.requestSaveLayout).not.toHaveBeenCalled();
});

test("links unique leaf tabs and supports automatic wrapped keyboard activation", async () => {
	const one = setup(); const two = setup();
	await one.view.setState({ tab: "staged" }, { history: false });
	await one.view.onOpen(); await two.view.onOpen();
	const tabs = one.root.querySelectorAll(".tntp-tabs__tab");
	const panels = one.root.querySelectorAll(".tntp-panel");
	expect(one.root.querySelector(".tntp-tabs")!.getAttribute("role")).toBe("tablist");
	for (let i = 0; i < 2; i++) {
		expect(tabs[i]!.getAttribute("role")).toBe("tab");
		expect(panels[i]!.getAttribute("role")).toBe("tabpanel");
		expect(tabs[i]!.getAttribute("aria-controls")).toBe(panels[i]!.getAttribute("id"));
		expect(panels[i]!.getAttribute("aria-labelledby")).toBe(tabs[i]!.getAttribute("id"));
		expect(tabs[i]!.getAttribute("id")).not.toBe(two.root.querySelectorAll(".tntp-tabs__tab")[i]!.getAttribute("id"));
	}
	expect(panels[0]!.getAttribute("tabindex")).toBe("0");
	for (const [key, index] of [["ArrowLeft", 1], ["ArrowRight", 0], ["End", 1], ["Home", 0]] as const) {
		event(tabs[index === 0 ? 1 : 0]!, "keydown", { key });
		expect(hostDocument.activeElement).toBe(tabs[index]);
		expect(tabs[index]!.getAttribute("tabindex")).toBe("0");
		expect(tabs[index === 0 ? 1 : 0]!.getAttribute("tabindex")).toBe("-1");
	}
	expect(workspace.requestSaveLayout).toHaveBeenCalledTimes(4);
	event(tabs[0]!, "keydown", { key: "Tab" });
	expect(hostDocument.activeElement).toBe(panels[0]);
	one.set([timer({ title: "Changed" })]); one.cardOrder.set(["a"]); await flush();
	expect(hostDocument.activeElement).toBe(panels[0]);
	expect(one.view.getState().tab).toBe("staged");
	expect(two.view.getState().tab).toBe("timers");
	await one.view.onClose(); await two.view.onClose();
});

test("switches stable panels with independent actions and empty states", async () => {
	const s = setup(); await s.view.onOpen(); await flush();
	const tabs = s.root.querySelectorAll(".tntp-tabs__tab");
	expect(tabs.map(tab => tab.textContent).join(",")).toBe("Staged 0,Timers 1");
	const panels = s.root.querySelectorAll(".tntp-panel");
	const card = s.root.querySelector(".tntp-card");
	expect(panels[0]!.getAttribute("hidden")).toBe("");
	event(tabs[0]!, "click");
	expect(panels[1]!.getAttribute("hidden")).toBe("");
	expect(panels[0]!.getAttribute("hidden")).toBeNull();
	expect(s.root.querySelector(".tntp-start")!.disabled).toBe(true);
	expect(panels[0]!.querySelector(".tntp-message__heading")!.textContent).toBe("");
	expect(panels[0]!.querySelector(".tntp-message__body")!.textContent).toBe("");
	event(tabs[1]!, "click");
	expect(s.root.querySelector(".tntp-card")).toBe(card);
	event(tabs[0]!, "click");
	for (const value of [[], null, [timer()]]) {
		s.set(value); await flush();
		expect(panels[0]!.querySelector(".tntp-message__heading")!.textContent).toBe("");
	}
	const current = s.root.querySelector(".tntp-card");
	event(tabs[1]!, "click"); event(tabs[0]!, "click"); event(tabs[1]!, "click");
	expect(s.root.querySelector(".tntp-card")).toBe(current);
	expect(card).not.toBeNull();
	const controls = s.root.querySelector(".tntp-tab-row")!.querySelector(".tntp-header")!;
	event(tabs[0]!, "click");
	expect(controls.getAttribute("hidden")).toBe("");
	event(tabs[1]!, "click");
	expect(controls.getAttribute("hidden")).toBeNull();
	expect(controls.children.map(el => el.textContent).join(",")).toBe("Pause all,Resume all,Stop all");
	await s.view.onClose();
});

test("mounted view dispatches current targets and keeps session DOM through pause/resume", async () => {
	const s = setup(); await s.view.onOpen(); await flush();
	const card = s.root.querySelector(".tntp-card")!;
	event(card.querySelector(".tntp-pause-resume")!, "click");
	expect(s.controller.pause).toHaveBeenCalledWith({ taskPath: "A.md", startTime: timer().startTime, title: "Task A" });
	s.set([timer({ state: "paused", segmentStartMs: null, accumulatedMs: 12000, totalKnown: false })]); await flush();
	expect(s.root.querySelector(".tntp-card")).toBe(card);
	expect(card.querySelector(".tntp-clock")!.textContent).toBe("0:00:12");
	expect(card.querySelector(".tntp-total")!.textContent).toBe("—");
	vi.advanceTimersByTime(5000); expect(card.querySelector(".tntp-clock")!.textContent).toBe("0:00:12");
	event(card.querySelector(".tntp-pause-resume")!, "click"); expect(s.controller.resume).toHaveBeenCalledWith({ taskPath: "A.md", title: "Task A" });
	s.set([timer({ startTime: "new-entry", title: "New title" })]); await flush();
	event(card.querySelector(".tntp-complete")!, "click"); expect(s.controller.complete).toHaveBeenCalledWith({ taskPath: "A.md", startTime: "new-entry", title: "New title" });
	s.busy(true); event(card.querySelector(".tntp-stop")!, "click"); expect(s.controller.stop).not.toHaveBeenCalled();
	s.busy(false); event(card.querySelector(".tntp-stop")!, "click"); await flush(); expect(s.controller.stop).toHaveBeenCalledWith({ taskPath: "A.md", startTime: "new-entry", title: "New title" });
	await s.view.onClose();
});

test("removing a card immediately unloads pending title render exactly once", async () => {
	const s = setup(); await s.view.onOpen();
	const render = viewHost.renders[0]!;
	s.set([]);
	expect(render.component.unloads).toBe(1);
	render.resolve(); await flush();
	expect(render.component.unloads).toBe(1);
	expect(s.root.querySelectorAll(".tntp-card")).toHaveLength(0);
	await s.view.onClose();
});

test("disposed list handles cannot change the shared saved order", async () => {
	const s = setup([timer(), timer({ sessionKey: "b", taskPath: "B.md" })]);
	s.cardOrder.load(["a", "b"]);
	await s.view.onOpen();
	const handle = s.root.querySelector(".tntp-handle")!;
	await s.view.onClose();
	event(handle, "keydown", { key: "ArrowDown" });
	expect(s.cardOrder.get().join(",")).toBe("a,b");
});

test("two mounted views share persisted order but retain their own DOM and drag authority", async () => {
	const persist = vi.fn(() => Promise.resolve());
	const order = new CardOrderStore({ log: vi.fn(), persist }); order.load(["a", "b"]);
	const timers = [timer(), timer({ sessionKey: "b", taskPath: "B.md", title: "Task A" })];
	const one = setup(timers, order); const two = setup(timers, order);
	await one.view.onOpen(); await two.view.onOpen(); await flush();
	const first = one.root.querySelectorAll(".tntp-card"); const second = two.root.querySelectorAll(".tntp-card");
	expect(first[0]).not.toBe(second[0]);
	const handle = first[0]!.querySelector(".tntp-handle")!;
	event(handle, "keydown", { key: "ArrowDown" });
	expect(order.get()).toEqual(["b", "a"]); expect(persist).toHaveBeenCalledWith(["b", "a"]);
	expect(one.root.querySelectorAll(".tntp-card")[1]).toBe(first[0]); expect(two.root.querySelectorAll(".tntp-card")[1]).toBe(second[0]);
	expect(hostDocument.activeElement).toBe(handle);
	const dataTransfer = transfer(); event(handle, "dragstart", { dataTransfer });
	event(second[1]!, "drop", { dataTransfer, clientY: 10 }); expect(order.get()).toEqual(["b", "a"]);
	event(first[1]!, "drop", { dataTransfer, clientY: 10 }); expect(order.get()).toEqual(["a", "b"]);
	await one.view.onClose(); await two.view.onClose();
});

test("ready loading/idle states and duplicate session reconciliation never dispatch writes", async () => {
	const s = setup([]); await s.view.onOpen(); await flush();
	expect(s.root.querySelector(".tntp-panel--timers")!.querySelector(".tntp-message__heading")!.textContent).toBe("No task is being timed");
	s.set(null); expect(s.root.querySelector(".tntp-pane")!.classes.has("tntp-pane--loading")).toBe(true);
	s.set([timer(), timer(), timer({ sessionKey: "b", taskPath: "B.md" })]); await flush();
	expect(s.root.querySelectorAll(".tntp-card")).toHaveLength(2);
	expect(s.root.querySelector(".tntp-clock")!.textContent).toBe("0:01:00");
	vi.advanceTimersByTime(5000); expect(s.root.querySelector(".tntp-clock")!.textContent).toBe("0:01:05");
	for (const fn of [s.controller.stop, s.controller.start, s.controller.pause, s.controller.resume, s.controller.complete, s.controller.stopAll, s.controller.pauseAll, s.controller.resumeAll]) expect(fn).not.toHaveBeenCalled();
	await s.view.onClose();
});

test("header guards retain Pause all, Resume all and Stop all dispatch", async () => {
	const s = setup(); await s.view.onOpen(); await flush();
	for (const [selector, fn] of [[".tntp-pause-all", s.controller.pauseAll], [".tntp-resume-all", s.controller.resumeAll], [".tntp-stop-all", s.controller.stopAll]] as const) {
		event(s.root.querySelector(selector)!, "click"); expect(fn).toHaveBeenCalledTimes(1);
		s.busy(true); event(s.root.querySelector(selector)!, "click"); expect(fn).toHaveBeenCalledTimes(1); s.busy(false);
	}
	expect(s.root.querySelector(".tntp-start")!.disabled).toBe(false);
	s.gateway.setState({ kind: "missing" }); expect(s.root.querySelector(".tntp-start")!.disabled).toBe(true);
	await s.view.onClose();
});

test("unreadable Pomodoro ownership is scoped to Timers and survives both tab selections", async () => {
	const s = setup(); s.store.getHeaderState = () => ({ readable: false, eligibleCount: 1, pausedCount: 1 });
	await s.view.onOpen(); await flush();
	const timers = s.root.querySelector(".tntp-panel--timers")!;
	const staged = s.root.querySelector(".tntp-panel--staged")!;
	expect(timers.querySelector(".tntp-pomodoro-note")!.textContent).toBe("Can't check Pomodoro. Showing all timers.");
	expect(staged.querySelector(".tntp-pomodoro-note")).toBeNull();
	for (const tab of s.root.querySelectorAll(".tntp-tabs__tab")) {
		event(tab, "click"); expect(s.root.querySelector(".tntp-pane")!.classes.has("tntp-pane--pomodoro-unknown")).toBe(true);
		expect(s.root.querySelectorAll(".tntp-card")).toHaveLength(1);
	}
	s.gateway.setState({ kind: "missing" }); expect(s.root.querySelector(".tntp-pane")!.classes.has("tntp-pane--pomodoro-unknown")).toBe(false);
	await s.view.onClose(); s.view.unload();
});
