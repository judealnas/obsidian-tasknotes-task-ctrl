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
import type { ActiveTimeEntry, TaskInfo } from "../src/tasknotes/runtime-api.types";
import { createFakeGateway } from "./fakes/fakeGateway";
import { Element, event, flush, resetViewHost, viewHost, transfer, hostDocument, hostWindow, HostEvent, workspace } from "./fakes/viewHost";

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
	const staging = new StagingStore({ gateway, schedule: (fn, ms) => { const timers = { setTimeout, clearTimeout }; const id = timers.setTimeout(fn, ms); return () => timers.clearTimeout(id); }, log: vi.fn() });
	const stagingController = new StagingController({ gateway, staging, store: { refreshNow: () => Promise.resolve() }, queue: new WriteQueue(), timerBusy: controller.isBusy, settingsReady: () => Promise.resolve(), getSettings: () => ({ rolloverHour: 4, completionStatus: null }), newCorrelationId: () => "test", log: vi.fn() });
	const view = new TimerPaneView({} as WorkspaceLeaf, { gateway, controller, store, cardOrder, staging: withStaging ? staging : undefined, stagingController: withStaging ? stagingController : undefined } as unknown as TimerPaneServices);
	view.register(() => staging.dispose());
	const root = view.contentEl as unknown as Element;
	return { view, root, gateway, controller, cardOrder, store, staging, stagingController,
		set(timers: OpenTimer[] | null) { snapshot = timers === null ? null : { primary: timers[0] ?? null, others: timers.slice(1) }; listeners.forEach(fn => fn()); },
		busy(value: boolean) { busy = value; busyListeners.forEach(fn => fn()); },
	};
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T12:01:00Z")); resetViewHost(); pickerHost.instances = []; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

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
	const s = setup([timer()], undefined, true);
	s.gateway.listTasks = () => Promise.resolve(["A", "B"].map(name => ({ path: `${name}.md`, title: name, status: "open", archived: false, staged: "2026-11-12" })));
	await s.view.onOpen(); await s.staging.refreshNow(); await flush();
	const panel = s.root.querySelector(".tntp-panel--staged")!;
	const handle = panel.querySelector(".tntp-handle")!; handle.focus(); event(handle, "keydown", { key: "ArrowDown" });
	expect(panel.querySelectorAll(".tntp-title").map(title => title.textContent).join(",")).toBe("B,A");
	expect(s.cardOrder.get()).toEqual([]); expect(hostDocument.activeElement).toBe(handle);
	await s.view.onClose(); s.view.unload();
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

test("Start opens start-only options once and releases its guard after close and bridge loss", async () => {
	const s = setup(); await s.view.onOpen(); await flush();
	const start = s.root.querySelector(".tntp-start")!;
	event(s.root.querySelector(".tntp-stage")!, "click"); expect(pickerHost.instances).toHaveLength(0);
	s.busy(true); event(start, "click"); expect(pickerHost.instances).toHaveLength(0); s.busy(false);
	event(start, "click"); event(start, "click"); expect(pickerHost.instances).toHaveLength(1);
	expect(pickerHost.instances[0]!.options.mode).toBe("start");
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
	expect(tabs.map(tab => tab.textContent).join(",")).toBe("Staged,Timers");
	const panels = s.root.querySelectorAll(".tntp-panel");
	const card = s.root.querySelector(".tntp-card");
	expect(panels[0]!.getAttribute("hidden")).toBe("");
	event(tabs[0]!, "click");
	expect(panels[1]!.getAttribute("hidden")).toBe("");
	expect(panels[0]!.getAttribute("hidden")).toBeNull();
	expect(panels[0]!.querySelector(".tntp-stage")!.disabled).toBe(true);
	expect(panels[0]!.querySelector(".tntp-message__heading")!.textContent).toBe("Nothing staged for today");
	expect(panels[0]!.querySelector(".tntp-message__body")!.textContent).toBe("Choose Stage above to pick today's tasks.");
	event(tabs[1]!, "click");
	expect(s.root.querySelector(".tntp-card")).toBe(card);
	event(tabs[0]!, "click");
	for (const value of [[], null, [timer()]]) {
		s.set(value); await flush();
		expect(panels[0]!.querySelector(".tntp-message__heading")!.textContent).toBe(value === null ? "" : "Nothing staged for today");
	}
	const current = s.root.querySelector(".tntp-card");
	event(tabs[1]!, "click"); event(tabs[0]!, "click"); event(tabs[1]!, "click");
	expect(s.root.querySelector(".tntp-card")).toBe(current);
	expect(card).not.toBeNull();
	expect(panels[1]!.querySelector(".tntp-header")!.children.map(el => el.textContent).join(",")).toBe("Start task,Pause all,Resume all,Stop all");
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
