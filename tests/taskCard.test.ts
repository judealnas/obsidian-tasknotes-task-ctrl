import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("obsidian", () => import("./fakes/viewHost"));
import type { App } from "obsidian";
import { TaskCard } from "../src/ui/TaskCard";
import type { CardRelationshipSnapshot, CardRelationshipSource } from "../src/state/CardRelationships";
import type { OpenTimer } from "../src/model/timeMath";
import type { TimerPaneServices } from "../src/ui/TimerPaneView";
import { createFakeGateway } from "./fakes/fakeGateway";
import { Element, dom, event, flush, resetViewHost, viewHost, workspace } from "./fakes/viewHost";

const model: OpenTimer = { taskPath: "Folder/A.md", title: "<script>title</script>", startTime: "entry1", startMs: 1000, state: "running", sessionStartedAt: "first", sessionKey: "a", sortMs: 1000, accumulatedMs: 2000, segmentStartMs: 1000, totalKnown: true, entries: [{ startMs: 1000, endMs: null }], displayKey: "" };
function setup(unstage?: (target: { taskPath: string; title: string }) => Promise<unknown>, completion?: TimerPaneServices["completion"], relationships?: CardRelationshipSource) {
	let busy = false;
	const controller = { isBusy: () => busy, start: vi.fn(() => Promise.resolve()), pause: vi.fn(() => Promise.resolve()), resume: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()), stopPaused: vi.fn(() => Promise.resolve()), complete: vi.fn(() => Promise.resolve()) };
	const gateway = createFakeGateway();
	const root = new Element();
	const card = new TaskCard(dom(root), model, { app: { workspace } as unknown as App, gateway, controller: controller as unknown as TimerPaneServices["controller"], unstage, completion, relationships });
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


test.each([
 { contexts: ["home"], metadata: "Nov 18 · today", expected: "Nov 18 · today · @home" },
 { contexts: ["home", "@work", "@@home", "", "@"], metadata: "Nov 18 · today", expected: "Nov 18 · today · @home, @work" },
 { contexts: [], metadata: "Nov 18 · today", expected: "Nov 18 · today" },
 { contexts: ["home"], metadata: undefined, expected: "@home" },
 { contexts: [], metadata: undefined, expected: "" },
])("fixed metadata formats $expected and updates after context removal", ({ contexts, metadata, expected }) => {
 const s = setup();
 const task = { path: model.taskPath, title: model.title, status: "open", archived: false, contexts };
 s.card.update({ ...model, task, stagedMetadata: metadata }, true);
 expect(s.el.querySelector(".tntp-staged-metadata")!.textContent).toBe(expected);
 s.card.update({ ...model, task: { ...task, contexts: [] } }, true);
 expect(s.el.querySelector(".tntp-staged-metadata")!.textContent).toBe("");
 s.card.dispose();
});

test("relationship disclosure keeps plain links, completion counts and expansion", async () => {
 const subscriptions: Array<{ path: string; show: (snapshot: CardRelationshipSnapshot | null) => void; off: ReturnType<typeof vi.fn> }> = [];
 const relationships: CardRelationshipSource = { subscribe(path, show) { const off = vi.fn(); subscriptions.push({ path, show, off }); return off; } };
 const s = setup(undefined, undefined, relationships);
 const snapshot: CardRelationshipSnapshot = {
  parents: [{ path: "Paper.md", title: "Research paper", status: "open", archived: false }],
  subtasks: [
   { path: "Figure.md", title: "<img src=x> figure", status: "finished", archived: false },
   { path: "Text.md", title: "Write interpretation", status: "open", archived: false },
  ], completedStatuses: ["finished"],
 };
 subscriptions[0]!.show(snapshot);
 const parents = s.el.querySelector(".tntp-relationships__parents")!;
 expect(parents.querySelector(".tntp-relationships__link")!.textContent).toBe("Research paper");
 const details = s.el.querySelector("details")!;
 expect(details.getAttribute("open")).toBeNull();
 expect(details.querySelector("summary")!.textContent).toBe("Subtasks · 1 of 2 complete");
 const relatedRenders = viewHost.renders.slice(1);
 expect(relatedRenders.map(render => render.markdown)).toEqual(["[[Paper]]", "[[Figure]]", "[[Text]]"]);
 for (const render of relatedRenders) render.resolve();
 await flush();
 expect(details.querySelector("img")).toBeNull();
 expect(details.querySelector("a")!.textContent).toBe("<img src=x> figure");
 expect(details.querySelector(".tntp-relationships__status")).toBeNull();
 const parentLink = parents.querySelector("a.internal-link")!;
 event(parentLink, "click", { ctrlKey: true });
 expect(workspace.openLinkText).toHaveBeenLastCalledWith("Paper.md", model.taskPath, true);
 const childLink = details.querySelector("a.internal-link")!;
 event(childLink, "click");
 expect(workspace.openLinkText).toHaveBeenLastCalledWith("Figure.md", model.taskPath, false);
 expect(event(childLink, "contextmenu").defaultPrevented).toBe(true);
 expect(s.gateway.menuCalls.map(call => call.taskPath)).toEqual(["Figure.md"]);
 s.gateway.setTaskMenuAvailable(false);
 expect(event(parentLink, "contextmenu").defaultPrevented).toBe(false);
 expect(s.controller.complete).not.toHaveBeenCalled();
 details.setAttribute("open", "");
 s.card.update(model, true);
 expect(subscriptions).toHaveLength(1);
 subscriptions[0]!.show({ ...snapshot, subtasks: snapshot.subtasks.slice(0, 1) });
 expect(s.el.querySelector("details")).toBe(details);
 expect(details.getAttribute("open")).toBe("");
 expect(details.querySelector("summary")!.textContent).toBe("Subtasks · 1 of 1 complete");
 subscriptions[0]!.show({ ...snapshot, completedStatuses: null });
 expect(details.querySelector("summary")!.textContent).toBe("Subtasks · 2");
 s.card.update({ ...model, taskPath: "Changed.md" }, true);
 expect(subscriptions[0]!.off).toHaveBeenCalledTimes(1);
 expect(details.getAttribute("open")).toBeNull();
 subscriptions[0]!.show(snapshot);
 expect(s.el.querySelector(".tntp-relationships")!.classes.has("tntp-relationships--empty")).toBe(true);
 subscriptions[1]!.show(snapshot);
 subscriptions[1]!.show(null);
 expect(s.el.querySelector(".tntp-relationships")!.classes.has("tntp-relationships--empty")).toBe(true);
 s.card.dispose();
 expect(subscriptions[1]!.off).toHaveBeenCalledTimes(1);
 subscriptions[1]!.show(snapshot);
 expect(s.root.children).toHaveLength(0);
});

test("related TaskNotes chips own mouse actions and keep the related task keyboard target", async () => {
 const child = { path: "Folder/Child.md", title: "Child task", status: "open", archived: false };
 const s = setup(undefined, undefined, {
  subscribe(_path, show) { show({ parents: [], subtasks: [child], completedStatuses: ["done"] }); return () => {}; },
 });
 const render = viewHost.renders[1]!;
 render.resolve();
 await flush();
 // TaskNotes can replace the Markdown anchor after Obsidian has rendered it.
 render.wrapper.querySelector("a")!.detach();
 const chip = render.wrapper.createSpan({ text: "Simulated chip" });
 const nativeMenu = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
 chip.addEventListener("contextmenu", nativeMenu);
 event(chip, "click");
 event(chip, "auxclick", { button: 1 });
 event(chip, "keydown", { key: "Enter" });
 expect(workspace.openLinkText).not.toHaveBeenCalled();
 event(chip, "contextmenu");
 expect(nativeMenu).toHaveBeenCalledTimes(1);
 expect(s.gateway.menuCalls).toHaveLength(0);
 const link = s.el.querySelector(".tntp-relationships__link")!;
 event(link, "keydown", { key: "Enter" });
 expect(workspace.openLinkText).toHaveBeenCalledWith(child.path, model.taskPath, false);
 s.card.dispose();
});

test("related link renders are discarded on status refresh and on card disposal", async () => {
 let publish!: (snapshot: CardRelationshipSnapshot) => void;
 const s = setup(undefined, undefined, { subscribe(_path, show) { publish = show; return () => {}; } });
 const parent = { path: "Parent.md", title: "Parent task", status: "open", archived: false };
 const snapshot: CardRelationshipSnapshot = { parents: [parent], subtasks: [], completedStatuses: ["done"] };
 publish(snapshot);
 const oldLink = s.el.querySelector(".tntp-relationships__link")!;
 const oldRender = viewHost.renders[1]!;
 publish(snapshot);
 expect(viewHost.renders).toHaveLength(2);
 publish({ ...snapshot, parents: [{ ...parent, status: "done" }] });
 expect(oldRender.component.unloads).toBe(1);
 oldRender.resolve("chip");
 await flush();
 expect(s.el.querySelector(".tntp-relationships__link")!.textContent).toBe("Parent task");
 event(oldLink, "click");
 event(oldLink, "contextmenu");
 expect(workspace.openLinkText).not.toHaveBeenCalled();
 expect(s.gateway.menuCalls).toHaveLength(0);
 const pending = viewHost.renders[2]!;
 s.card.dispose();
 pending.resolve("chip");
 await flush();
 expect(s.root.children).toHaveLength(0);
 expect(viewHost.renders.every(render => render.component.unloads === 1)).toBe(true);
});
