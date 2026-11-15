import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("obsidian", () => import("./fakes/viewHost"));
import type { App } from "obsidian";
import { TaskCard } from "../src/ui/TaskCard";
import type { OpenTimer } from "../src/model/timeMath";
import type { TimerPaneServices } from "../src/ui/TimerPaneView";
import { createFakeGateway } from "./fakes/fakeGateway";
import { Element, dom, event, flush, resetViewHost, viewHost, workspace } from "./fakes/viewHost";

const model: OpenTimer = { taskPath: "Folder/A.md", title: "<script>title</script>", startTime: "entry1", startMs: 1000, state: "running", sessionStartedAt: "first", sessionKey: "a", sortMs: 1000, accumulatedMs: 2000, segmentStartMs: 1000, totalKnown: true, entries: [{ startMs: 1000, endMs: null }], displayKey: "" };
function setup(unstage?: (target: { taskPath: string; title: string }) => Promise<unknown>, completion?: TimerPaneServices["completion"]) {
	let busy = false;
	const controller = { isBusy: () => busy, start: vi.fn(() => Promise.resolve()), pause: vi.fn(() => Promise.resolve()), resume: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()), stopPaused: vi.fn(() => Promise.resolve()), complete: vi.fn(() => Promise.resolve()) };
	const gateway = createFakeGateway();
	const root = new Element();
	const card = new TaskCard(dom(root), model, { app: { workspace } as unknown as App, gateway, controller: controller as unknown as TimerPaneServices["controller"], unstage, completion });
	card.update(model, true);
	return { card, root, el: root.children[0]!, controller, gateway, busy(value: boolean) { busy = value; card.update(card.currentModel, true); } };
}
beforeEach(resetViewHost);
afterEach(() => vi.unstubAllGlobals());

test("coordinated completion supports staged idle/running/paused targets and explains unavailable controls", async () => {
 const availability = vi.fn(() => Promise.resolve({ available: true, reason: "Complete this task" }));
 const s = setup(undefined, { availability } as unknown as TimerPaneServices["completion"]);
 for (const state of ["idle", "running", "paused"] as const) {
  const timer = state === "idle" ? { state, taskPath: "Idle.md", title: "Idle", displayKey: "" } : { ...model, state };
  s.card.update({ ...timer, stagedCard: true }, true); await flush();
  const button = s.el.querySelector(".tntp-complete")!;
  expect(button.disabled).toBe(false); event(button, "click");
  expect(s.controller.complete).toHaveBeenLastCalledWith({ taskPath: timer.taskPath, title: timer.title, ...(state === "idle" ? {} : { startTime: model.startTime }) });
 }
 availability.mockResolvedValue({ available: false, reason: "Previous completion needs checking" });
 s.card.update(model, true); await flush();
 expect(s.el.querySelector(".tntp-complete")!.disabled).toBe(true);
 expect(s.el.querySelector(".tntp-complete")!.getAttribute("aria-label")).toBe("Previous completion needs checking");
 s.card.dispose();
});
test("unchanged card renders reuse availability instead of multiplying catalog reads", async () => {
 const availability = vi.fn(() => Promise.resolve({ available: true, reason: "Available" }));
 const s = setup(undefined, { availability } as unknown as TimerPaneServices["completion"]);
 await flush();
 for (let i = 0; i < 10; i++) s.card.update(model, true);
 await flush(); expect(availability).toHaveBeenCalledTimes(1);
 s.busy(true); await flush(); expect(availability).toHaveBeenCalledTimes(1);
 s.busy(false); await flush(); expect(availability).toHaveBeenCalledTimes(2);
 s.card.dispose();
});

test("staged completion never dispatches, and separate Unstage reads the newest model", () => {
	const unstage = vi.fn(() => Promise.resolve()); const s = setup(unstage);
	const title = s.el.querySelector(".tntp-title");
	for (const state of ["idle", "running", "paused"] as const) {
		const card = state === "idle" ? { state, taskPath: "New.md", title: "New", displayKey: "" } : { ...model, state, taskPath: "New.md", title: "New", startTime: "latest" };
		s.card.update({ ...card, stagedCard: true, stagedMetadata: "Nov 12 · 2 days ago" }, true);
		expect(s.el.querySelector(".tntp-complete")!.disabled).toBe(true); event(s.el.querySelector(".tntp-complete")!, "click");
		expect(s.el.querySelector(".tntp-title")).toBe(title); expect(s.el.querySelector(".tntp-staged-metadata")!.textContent).toBe("Nov 12 · 2 days ago");
	}
	const button = s.el.querySelector(".tntp-unstage")!; expect(button.getAttribute("aria-label")).toBe("Unstage task"); expect(button.parentElement).toBe(s.el);
	event(button, "click"); expect(unstage).toHaveBeenCalledWith({ taskPath: "New.md", title: "New" }); expect(s.controller.complete).not.toHaveBeenCalled();
	s.busy(true); event(button, "click"); expect(unstage).toHaveBeenCalledTimes(1); s.card.dispose(); event(button, "click"); expect(unstage).toHaveBeenCalledTimes(1);
});

test("card clocks derive from wall time, freeze paused sessions and show unknown totals", () => {
	const s = setup(); s.card.writeTimes(61000);
	expect(s.el.querySelector(".tntp-clock")!.textContent).toBe("0:01:02");
	expect(s.el.querySelector(".tntp-total")!.textContent).toBe("0:01:00");
	s.card.update({ ...model, state: "paused", segmentStartMs: null, accumulatedMs: 7000, totalKnown: false }, true);
	s.card.writeTimes(999000);
	expect(s.el.querySelector(".tntp-clock")!.textContent).toBe("0:00:07");
	expect(s.el.querySelector(".tntp-total")!.textContent).toBe("—");
	expect(s.el.classes.has("tntp-card--paused")).toBe(true);
	s.card.dispose();
});

test("card uses latest exact targets, blocks busy/unavailable actions and forgets paused stops", async () => {
	const s = setup();
	const next = { ...model, taskPath: "Other.md", title: "Other", startTime: "entry2" };
	s.card.update(next, false);
	event(s.el.querySelector(".tntp-complete")!, "click"); expect(s.controller.complete).not.toHaveBeenCalled();
	s.busy(true);
	for (const selector of [".tntp-stop", ".tntp-pause-resume", ".tntp-complete"]) event(s.el.querySelector(selector)!, "click");
	expect(s.controller.pause).not.toHaveBeenCalled(); expect(s.controller.stop).not.toHaveBeenCalled();
	s.busy(false); event(s.el.querySelector(".tntp-pause-resume")!, "click");
	expect(s.controller.pause).toHaveBeenCalledWith({ taskPath: "Other.md", title: "Other", startTime: "entry2" });
	s.card.update({ ...next, state: "paused" }, true);
	event(s.el.querySelector(".tntp-stop")!, "click"); await flush();
	expect(s.controller.stopPaused).toHaveBeenCalledWith({ taskPath: "Other.md", title: "Other" });
	s.card.dispose(); event(s.el.querySelector(".tntp-pause-resume")!, "click"); expect(s.controller.resume).not.toHaveBeenCalled();
});

test("stop retains captured target and settlement cannot revive a disposed card", async () => {
	const s = setup(); let settle!: () => void;
	s.controller.stop.mockImplementation(() => new Promise<void>(resolve => { settle = resolve; }));
	event(s.el.querySelector(".tntp-stop")!, "click");
	expect(s.el.querySelector(".tntp-stop__label")!.textContent).toBe("Stopping…");
	s.card.update({ ...model, taskPath: "New.md", startTime: "entry2" }, true);
	expect(s.controller.stop).toHaveBeenCalledWith({ taskPath: model.taskPath, startTime: "entry1", title: model.title });
	s.card.dispose(); settle(); await flush();
	expect(s.root.children).toHaveLength(0); expect(viewHost.renders.every(render => render.component.unloads === 1)).toBe(true);
});

test("titles stay text, render only wikilinks and retain unique accessible labels", async () => {
	const a = setup(); const b = setup();
	expect(a.el.querySelector(".tntp-title")!.textContent).toBe(model.title);
	expect(viewHost.renders[0]!.markdown).toBe("[[Folder/A]]");
	expect(a.el.querySelector(".tntp-title")!.getAttribute("aria-labelledby")).not.toBe(b.el.querySelector(".tntp-title")!.getAttribute("aria-labelledby"));
	viewHost.renders[0]!.resolve(); await flush();
	const link = a.el.querySelector("a.internal-link")!;
	expect(link.textContent).toBe(model.title); expect(link.getAttribute("tabindex")).toBe("-1"); expect(link.getAttribute("draggable")).toBe("false");
	a.card.dispose(); b.card.dispose();
});

test("plain titles support click modifiers, middle click, Enter/Space and default prevention", async () => {
	const s = setup(); viewHost.renders[0]!.resolve(); await flush();
	const title = s.el.querySelector(".tntp-title")!;
	event(title, "click"); expect(workspace.openLinkText).toHaveBeenLastCalledWith(model.taskPath, "", false);
	event(title, "click", { ctrlKey: true }); expect(workspace.openLinkText).toHaveBeenLastCalledWith(model.taskPath, "", true);
	event(title, "auxclick", { button: 1 }); expect(workspace.openLinkText).toHaveBeenLastCalledWith(model.taskPath, "", "tab");
	event(title, "keydown", { key: "Enter" }); event(title, "keydown", { key: " " }); expect(workspace.openLinkText).toHaveBeenCalledTimes(5);
	event(title, "click", { defaultPrevented: true }); event(title, "auxclick", { button: 2 }); expect(workspace.openLinkText).toHaveBeenCalledTimes(5);
	event(title, "contextmenu", { defaultPrevented: true }); expect(s.gateway.menuCalls).toHaveLength(0);
	event(title, "contextmenu"); expect(s.gateway.menuCalls[0]!.taskPath).toBe(model.taskPath);
	s.card.dispose();
});

test("chip-owned mouse actions do not navigate but keyboard opens the current task", async () => {
	const s = setup(); viewHost.renders[0]!.resolve("chip"); await flush();
	const title = s.el.querySelector(".tntp-title")!;
	expect(title.getAttribute("aria-label")).toBeNull();
	event(title.children[0]!.children[0]!, "click"); event(title, "auxclick", { button: 1 }); expect(workspace.openLinkText).not.toHaveBeenCalled();
	event(title, "keydown", { key: "Enter" }); expect(workspace.openLinkText).toHaveBeenCalledTimes(1);
	s.card.dispose();
});

test.each(["resolve", "reject"] as const)("replacement/removal invalidate delayed renders (%s) and unload once", async outcome => {
	const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
	const s = setup(); const old = viewHost.renders[0]!;
	s.card.update({ ...model, title: "Replacement", displayKey: "new" }, true);
	expect(old.component.unloads).toBe(1);
	const latest = viewHost.renders[1]!; latest.resolve(); await flush();
	if (outcome === "resolve") old.resolve(); else old.reject(new Error("render failed"));
	await flush(); expect(s.el.querySelector(".tntp-title")!.textContent).toBe("Replacement");
	s.card.update({ ...model, title: "Pending close" }, true);
	const pending = viewHost.renders[2]!;
	s.card.dispose(); s.card.dispose(); expect(pending.component.unloads).toBe(1);
	if (outcome === "resolve") pending.resolve(); else pending.reject(new Error("late failed"));
	await flush(); expect(s.root.children).toHaveLength(0); expect(viewHost.renders.every(render => render.component.unloads === 1)).toBe(true);
	log.mockRestore();
});

test("failed current title render falls back to text and releases its component", async () => {
	const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
	const s = setup(); viewHost.renders[0]!.reject(new Error("failed")); await flush();
	expect(s.el.querySelector(".tntp-title")!.textContent).toBe(model.title); expect(viewHost.renders[0]!.component.unloads).toBe(1);
	s.card.dispose(); log.mockRestore();
});
