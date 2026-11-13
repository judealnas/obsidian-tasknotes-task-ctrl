import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("obsidian", () => import("./fakes/viewHost"));
const pickerHost = vi.hoisted(() => ({ instances: [] as Array<{ options: { mode?: string }; close: () => void }> }));
vi.mock("../src/ui/TaskPickerModal", () => ({ TaskPickerModal: class {
	options: { mode?: string };
	private off: (() => void) | undefined;
	private gateway: ReturnType<typeof createFakeGateway>;
	private didClose: () => void;
	constructor(_app: unknown, options: { mode?: string; gateway: ReturnType<typeof createFakeGateway>; onClose: () => void } | ReturnType<typeof createFakeGateway>, _controller?: unknown, onClose?: () => void) {
		this.options = options;
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
import { createFakeGateway } from "./fakes/fakeGateway";
import { Element, event, flush, resetViewHost, viewHost, transfer, hostDocument, hostWindow, HostEvent, workspace } from "./fakes/viewHost";

export function timer(patch: Partial<OpenTimer> = {}): OpenTimer {
	return { taskPath: "A.md", title: "Task A", startTime: "2026-11-13T12:00:00Z", startMs: 0, state: "running", sessionStartedAt: "2026-11-13T12:00:00Z", sessionKey: "a", sortMs: 0, accumulatedMs: 0, segmentStartMs: Date.parse("2026-11-13T12:00:00Z"), totalKnown: true, entries: [], displayKey: "", ...patch };
}
export function setup(initial: OpenTimer[] = [timer()], cardOrder = new CardOrderStore({ log: vi.fn() })) {
	const gateway = createFakeGateway(); gateway.setState({ kind: "ready" });
	let snapshot: TimerSnapshot | null = { primary: initial[0] ?? null, others: initial.slice(1) };
	const listeners = new Set<() => void>();
	const busyListeners = new Set<() => void>();
	let busy = false;
	const controller = { stop: vi.fn(() => Promise.resolve()), pause: vi.fn(() => Promise.resolve()), resume: vi.fn(() => Promise.resolve()), stopPaused: vi.fn(() => Promise.resolve()), complete: vi.fn(() => Promise.resolve()), start: vi.fn(), pauseAll: vi.fn(), resumeAll: vi.fn(), stopAll: vi.fn(), completionAvailable: vi.fn(() => Promise.resolve(true)), isBusy: () => busy, subscribeBusy: (fn: () => void) => { busyListeners.add(fn); return () => busyListeners.delete(fn); } };
	const store = { getSnapshot: () => snapshot, getHeaderState: () => ({ readable: true, eligibleCount: 1, pausedCount: 1 }), subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, requestRefresh: vi.fn() };
	const view = new TimerPaneView({} as WorkspaceLeaf, { gateway, controller, store, cardOrder } as unknown as TimerPaneServices);
	const root = view.contentEl as unknown as Element;
	return { view, root, gateway, controller, cardOrder, store,
		set(timers: OpenTimer[] | null) { snapshot = timers === null ? null : { primary: timers[0] ?? null, others: timers.slice(1) }; listeners.forEach(fn => fn()); },
		busy(value: boolean) { busy = value; busyListeners.forEach(fn => fn()); },
	};
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T12:01:00Z")); resetViewHost(); pickerHost.instances = []; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

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
