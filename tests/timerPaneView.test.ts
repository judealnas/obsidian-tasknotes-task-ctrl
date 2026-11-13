import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("obsidian", () => import("./fakes/viewHost"));
import type { WorkspaceLeaf } from "obsidian";
import { TimerPaneView, type TimerPaneServices } from "../src/ui/TimerPaneView";
import type { OpenTimer, TimerSnapshot } from "../src/model/timeMath";
import { CardOrderStore } from "../src/state/CardOrderStore";
import { createFakeGateway } from "./fakes/fakeGateway";
import { Element, event, flush, resetViewHost, viewHost, transfer, hostDocument } from "./fakes/viewHost";

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
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T12:01:00Z")); resetViewHost(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

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
	expect(s.root.querySelector(".tntp-message__heading")!.textContent).toBe("No task is being timed");
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
