/* eslint-disable @typescript-eslint/unbound-method -- Assertions inspect mocks; they do not call detached methods. */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { App } from "obsidian";
import { createFakeGateway } from "./fakes/fakeGateway";
const host = vi.hoisted(() => ({ loaded: 0, unloaded: 0, notices: 0, throwNotice: false, renders: [] as Array<() => void> }));
class Element {
 value = "";
 disabled = false;
 hidden = false;
 style = { setProperty: () => undefined };
 removeEventListener(name: string): void { this.listeners.delete(name); }
 createEl(_tag: string, options?: { text?: string; cls?: unknown }): Element { return this.createDiv(options); }
 focusCalls = 0;
 focus(): void { this.focusCalls++; }
 setText(text: string): void { this.textContent = text; }
 textContent = "";
 children: Element[] = [];
 attrs = new Map<string, string>();
 listeners = new Map<string, (event: MouseEvent) => void>();
 win = { Event, setTimeout, clearTimeout, createDiv: () => new Element() };
 doc = { win: this.win };
 addClass(): void {}
 cls: unknown = undefined;
 createDiv(options?: { text?: string; cls?: unknown }): Element { const el = new Element(); el.textContent = options?.text ?? ""; el.cls = options?.cls; this.children.push(el); return el; }
 createSpan(options?: { text?: string; cls?: unknown }): Element { return this.createDiv(options); }
 addEventListener(name: string, fn: (event: MouseEvent) => void): void { this.listeners.set(name, fn); }
 dispatchEvent(): boolean { return true; }
 querySelector(): Element | null { return this.children[0] ?? null; }
 querySelectorAll(): Element[] { return this.children; }
 setAttribute(name: string, value: string): void { this.attrs.set(name, value); }
 empty(): void { this.children = []; this.textContent = ""; }
 appendChild(el: Element): void { this.children.push(el); }
}
vi.mock("obsidian", () => ({
 Component: class { load(): void { host.loaded++; } unload(): void { host.unloaded++; } },
 MarkdownRenderer: { render: (_app: unknown, _markdown: string, wrapper: Element) => new Promise<void>(resolve => { host.renders.push(() => { wrapper.createDiv(); resolve(); }); }) },
 Notice: class { constructor() { host.notices++; if (host.throwNotice) throw new Error("Notice failed"); } },
 SuggestModal: class {
  inputEl = new Element();
  contentEl = new Element();
  modalEl = this.contentEl;
  app: App;
  shortcuts = new Map<string, (event: KeyboardEvent) => unknown>();
  scope = { register: (modifiers: string[], key: string, callback: (event: KeyboardEvent) => unknown) => { this.shortcuts.set([...modifiers, key].join("+"), callback); } };
  constructor(app: App) { this.app = app; }
  setPlaceholder(): void {}
  setInstructions(): void {}
  onOpen(): void {}
  onClose(): void {}
  close(): void { this.onClose(); }
  selectSuggestion(task: unknown): void { this.close(); (this as unknown as { onChooseSuggestion(t: unknown): void }).onChooseSuggestion(task); }
 }
}));
import { TaskPickerModal } from "../src/ui/TaskPickerModal";
import { PickerCreationController } from "../src/state/PickerCreationController";
import { StagingController } from "../src/state/StagingController";
import { StagingStore } from "../src/state/StagingStore";
import { WriteQueue } from "../src/state/WriteQueue";
const task = { title: "Task", path: "Task.md", status: "open", archived: false, due: "2026-10-15" };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test("a batch picker passes its insertion anchor for every chosen task", async () => {
	const gateway = createFakeGateway(); gateway.setState({ kind: "ready" });
	const second = { ...task, path: "Second.md", title: "Second" };
	gateway.listTasks = () => Promise.resolve([task, second]);
	const stage = vi.fn(() => Promise.resolve({ kind: "staged" as const }));
	const modal = new TaskPickerModal({} as App, { mode: "stage", gateway, controller: { stage, isBusy: () => false }, beforePath: "Anchor.md", onClose: vi.fn() });
	modal.onOpen(); await flush();
	for (const chosen of [task, second]) {
		modal.selectSuggestion(chosen, {} as KeyboardEvent);
		for (let i = 0; i < 4; i++) await flush();
	}
	expect(stage.mock.calls).toEqual([[{ taskPath: task.path, title: task.title, beforePath: "Anchor.md" }, expect.any(Function)], [{ taskPath: second.path, title: second.title, beforePath: "Anchor.md" }, expect.any(Function)]]);
	modal.onClose();
});

test("Stage selection keeps the native public modal path open and preserves its newest query", async () => {
 const gateway = createFakeGateway(); let current = { ...task, staged: null as string | null };
 gateway.listTasks = () => Promise.resolve([current]); gateway.getTask = () => Promise.resolve(current);
 gateway.setUserFields([{ id: "s", key: "staged", type: "date", displayName: "Staged" }]);
 const original = gateway.updateTask.bind(gateway); gateway.updateTask = async (path, patch, context) => { await original(path, patch, context); current = { ...current, staged: patch.staged as string }; };
 const staging = new StagingStore({ gateway, log: vi.fn(), schedule: () => () => undefined, now: () => new Date(2026, 10, 14, 12).getTime() });
 const controller = new StagingController({ gateway, staging, store: { refreshNow: () => Promise.resolve() }, queue: new WriteQueue(), timerBusy: () => false, getSettings: () => ({ completionStatus: null }), settingsReady: () => Promise.resolve(), now: () => new Date(2026, 10, 14, 12).getTime(), newCorrelationId: () => "test", log: vi.fn() });
 const closed = vi.fn(); const start = vi.fn();
 const modal = new TaskPickerModal({} as App, { mode: "stage", gateway, controller, onClose: closed });
 modal.onOpen(); await flush(); modal.inputEl.value = "Task";
 modal.selectSuggestion(task, {} as KeyboardEvent);
 for (let i = 0; i < 12; i++) await flush();
 expect(closed.mock.calls.length).toBe(0);
 expect(modal.inputEl.value).toBe("Task");
 expect(modal.getSuggestions("")).toEqual([]);
 expect(start).not.toHaveBeenCalled();
 expect(gateway.updateCalls[0]?.patch).toEqual({ staged: "2026-11-14" });
 expect(staging.getSnapshot().items.map(item => item.taskPath)).toEqual(["Task.md"]);
 expect(gateway.startCalls).toEqual([]); expect(host.notices).toBe(0);
 expect((modal.inputEl as unknown as Element).focusCalls).toBe(1);
 modal.onClose(); staging.dispose();
});

test("Stage failures retain rows and query, pending selection is unique, and closed results never refocus", async () => {
 host.notices = 0; vi.stubGlobal("createDiv", () => new Element());
 const gateway = createFakeGateway(); gateway.listTasks = () => Promise.resolve([task, { ...task, path: "Done.md", status: "done" }, { ...task, path: "Archived.md", archived: true }, { ...task, path: "Future.md", staged: "2026-12-31" }]);
 gateway.statuses = () => Promise.resolve([{ value: "done", isCompleted: true }]);
 let settle!: (result: { kind: "staged" | "failed"; message?: string }) => void;
 const stage = vi.fn(() => new Promise<{ kind: "staged" | "failed"; message?: string }>(resolve => { settle = resolve; }));
 const close = vi.fn(); const modal = new TaskPickerModal({} as App, { mode: "stage", gateway, controller: { stage, isBusy: () => false }, onClose: close });
 modal.onOpen(); await flush(); expect(modal.getSuggestions("").map(item => item.path)).toEqual(["Task.md"]);
 modal.inputEl.value = "Task"; modal.selectSuggestion(task, {} as MouseEvent); modal.selectSuggestion(task, {} as KeyboardEvent);
 expect(stage).toHaveBeenCalledTimes(1); modal.inputEl.value = "newest"; settle({ kind: "failed", message: "Try again" }); await flush();
 expect(modal.inputEl.value).toBe("newest"); expect(modal.getSuggestions("")).toHaveLength(1); expect((modal.contentEl as unknown as Element).children[0]?.textContent).toBe("Try again");
 modal.selectSuggestion(task, {} as KeyboardEvent); expect(stage).toHaveBeenCalledTimes(2); settle({ kind: "staged" }); await flush();
 expect(modal.inputEl.value).toBe("newest"); expect(modal.getSuggestions("")).toHaveLength(0); expect(close).not.toHaveBeenCalled();
 const input = modal.inputEl as unknown as Element; const focuses = input.focusCalls;
 modal.selectSuggestion(task, {} as KeyboardEvent); modal.onClose(); settle({ kind: "staged" }); await flush();
 expect(input.focusCalls).toBe(focuses); expect(host.notices).toBe(0);
});
describe("task picker lifecycle", () => {
 beforeEach(() => { host.loaded = 0; host.unloaded = 0; host.notices = 0; host.throwNotice = false; host.renders = []; vi.stubGlobal("createDiv", () => new Element()); });
 function setup() {
  const gateway = createFakeGateway();
  gateway.listTasks = () => Promise.resolve([task]); gateway.setTask(task.path, task);
  const add = vi.fn(() => Promise.resolve({ kind: "added-and-saved" as const }));
  const closed = vi.fn();
  const modal = new TaskPickerModal({} as App, { mode: "add", gateway, controller: { add, isBusy: () => false, availability: () => ({ available: gateway.getState().kind === "ready", reason: "TaskNotes is unavailable" }) }, onClose: closed });
  return { modal, gateway, add, closed };
 }
 test("renders static text without MarkdownRenderer", async () => {
  const { modal } = setup(); modal.onOpen(); await flush();
  const el = new Element(); modal.renderSuggestion(task, el as unknown as HTMLElement);
  expect(el.children[0]!.textContent).toBe("Task");
  expect(host.loaded).toBe(0); expect(host.renders).toHaveLength(0);
  modal.getSuggestions("next"); modal.onClose(); expect(host.unloaded).toBe(0);
 });
 test("fetches once and closing before a read resolves discards results", async () => {
  const { modal, gateway } = setup();
  let resolve!: (tasks: typeof task[]) => void;
  const load = vi.fn(() => new Promise<typeof task[]>(r => { resolve = r; }));
  gateway.listTasks = load;
  modal.onOpen(); modal.getSuggestions("first"); modal.onClose(); resolve([task]); await flush();
  expect(modal.getSuggestions("")).toEqual([]);
  expect(load).toHaveBeenCalledTimes(1);
 });
 test("mouse and keyboard share once-only selection even when host closes first", async () => {
  const { modal, add } = setup(); modal.onOpen(); await flush();
  modal.selectSuggestion(task, {} as KeyboardEvent); modal.onChooseSuggestion(task); await flush(); await flush();
  expect(add).toHaveBeenCalledTimes(1);
  expect(add).toHaveBeenCalledWith(task, expect.any(Function));
 });
 test("bridge loss closes the picker and blocks stale selection", async () => {
  const { modal, gateway, add, closed } = setup(); modal.onOpen(); await flush();
  gateway.setState({ kind: "missing" }); modal.selectSuggestion(task, {} as MouseEvent);
  expect(closed).toHaveBeenCalledTimes(1); expect(add).not.toHaveBeenCalled();
 });
});

test.each([false, true])("picker read failure closes and releases guards when Notice throws=%s", async throws => {
 const gateway = createFakeGateway(); gateway.listTasks = () => Promise.reject(new Error("Read failed"));
 const closed = vi.fn(); host.notices = 0; host.throwNotice = throws;
 const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
 const modal = new TaskPickerModal({} as App, { mode: "add", gateway, controller: { add: () => Promise.resolve({ kind: "added-and-saved" as const }), isBusy: () => false, availability: () => ({ available: true, reason: "" }) }, onClose: closed });
 modal.onOpen(); await flush();
 expect(closed).not.toHaveBeenCalled(); expect(host.notices).toBe(0);
 expect(modal.getSuggestions("")).toEqual([]);
 host.throwNotice = false; errorLog.mockRestore();
});

// ---- plan 03-04: the Pomodoro row tag (D-17) ----
describe("Pomodoro row tag (D-17)", () => {
 const other = { title: "Other", path: "Other.md", status: "open", archived: false };
 beforeEach(() => { host.loaded = 0; host.unloaded = 0; host.notices = 0; host.throwNotice = false; host.renders = []; vi.stubGlobal("createDiv", () => new Element()); });
 function open(ownership: () => Promise<import("../src/model/pomodoroOwnership").Ownership>) {
  const gateway = createFakeGateway();
  gateway.listTasks = () => Promise.resolve([task, other]); gateway.setTask(task.path, task);
  const read = vi.fn(ownership);
  gateway.pomodoroOwnership = read;
  const closed = vi.fn();
  const add = vi.fn(() => Promise.resolve({ kind: "added-and-saved" as const }));
  const modal = new TaskPickerModal({} as App, { mode: "add", gateway, controller: { add, isBusy: () => false, availability: () => ({ available: true, reason: "" }) }, onClose: closed });
  return { modal, gateway, read, closed, add };
 }
 function tags(modal: TaskPickerModal, row: typeof task | typeof other): Element[] {
  const el = new Element();
  modal.renderSuggestion(row, el as unknown as HTMLElement);
  return el.children.filter(child => child.cls === "tntp-picker-pomodoro");
 }
 test("a readable owner on Task.md tags only that row with a muted Pomodoro span", async () => {
  const { modal } = open(() => Promise.resolve({ readable: true, owner: { taskPath: "./Task.md", startTime: "2026-10-14T09:00:00.000Z" } }));
  modal.onOpen(); await flush();
  const tagged = tags(modal, task);
  expect(tagged).toHaveLength(1);
  expect(tagged[0]!.textContent).toBe("Pomodoro");
  expect(tags(modal, other)).toHaveLength(0);
 });
 test("no owner tags no row", async () => {
  const { modal } = open(() => Promise.resolve({ readable: true, owner: null }));
  modal.onOpen(); await flush();
  expect(tags(modal, task)).toHaveLength(0);
 });
 test.each([
  ["unreadable", () => Promise.resolve({ readable: false } as const)],
  ["rejected", () => Promise.reject(new Error("pomodoro down"))],
 ])("%s ownership tags no row and the task list still loads", async (_label, ownership) => {
  const { modal, closed } = open(ownership);
  modal.onOpen(); await flush();
  expect(closed).not.toHaveBeenCalled();
  expect(host.notices).toBe(0);
  expect(modal.getSuggestions("").map(row => row.path)).toEqual(expect.arrayContaining(["Task.md", "Other.md"]));
  expect(tags(modal, task)).toHaveLength(0);
 });
 test("ownership is read once per opening, together with the task list", async () => {
  const { modal, read } = open(() => Promise.resolve({ readable: true, owner: null }));
  modal.onOpen(); await flush();
  modal.getSuggestions("t"); modal.getSuggestions("ta");
  expect(read).toHaveBeenCalledTimes(1);
  modal.onClose(); modal.onOpen(); await flush();
  expect(read).toHaveBeenCalledTimes(2);
 });
 test("a close before the ownership read resolves discards it", async () => {
  let resolve!: (value: { readable: true; owner: { taskPath: string; startTime: string } }) => void;
  let calls = 0;
  const { modal } = open(() => {
   calls++;
   if (calls === 1) return new Promise(r => { resolve = r; });
   return new Promise(() => undefined);
  });
  modal.onOpen(); modal.onClose();
  resolve({ readable: true, owner: { taskPath: "Task.md", startTime: "2026-10-14T09:00:00.000Z" } });
  await flush();
  modal.onOpen(); await flush();
  expect(tags(modal, task)).toHaveLength(0);
 });
 test("choosing the tagged row still calls controller.add", async () => {
  const { modal, add } = open(() => Promise.resolve({ readable: true, owner: { taskPath: "Task.md", startTime: "2026-10-14T09:00:00.000Z" } }));
  modal.onOpen(); await flush();
  modal.onChooseSuggestion(task); await flush(); await flush();
  expect(add).toHaveBeenCalledWith(task, expect.any(Function));
 });
});

function elements(root: Element): Element[] { return [root, ...root.children.flatMap(elements)]; }
function input(modal: TaskPickerModal, query: string): void {
 modal.inputEl.value = query; (modal.inputEl as unknown as Element).listeners.get("input")?.({} as MouseEvent);
}
function inlineSetup(mode: "stage" | "add" = "stage") {
 const gateway = createFakeGateway(); gateway.listTasks = () => Promise.resolve([]);
 gateway.inlineCreationAvailability = () => ({ available: true, reason: "" });
 gateway.parseTask = vi.fn((text: string) => Promise.resolve({ title: text }));
 gateway.createTask = vi.fn((data: import("../src/tasknotes/runtime-api.types").TaskCreationData) => { const created = { ...task, title: data.title }; gateway.setTask(created.path, created); return Promise.resolve(created); });
 const coordinator = new PickerCreationController({ gateway, queue: new WriteQueue(), notify: vi.fn(), newCorrelationId: () => "id" });
 const creation = { coordinator, destinationAvailability: () => ({ available: true, reason: "" }), subscribeDestination: () => () => undefined };
 const stage = vi.fn(() => Promise.resolve({ kind: "staged" as const }));
 const add = vi.fn(() => Promise.resolve({ kind: "added-and-saved" as const })); const closed = vi.fn();
 const modal = mode === "stage"
  ? new TaskPickerModal({} as App, { mode, gateway, creation, controller: { stage, isBusy: () => false }, onClose: closed })
  : new TaskPickerModal({} as App, { mode, gateway, creation, controller: { add, isBusy: () => false, availability: () => ({ available: true, reason: "" }) }, onClose: closed });
 modal.onOpen(); return { gateway, coordinator, modal, stage, add, closed };
}

function shiftEnter(modal: TaskPickerModal, properties: Partial<KeyboardEvent> = {}): void {
 (modal as unknown as { shortcuts: Map<string, (event: KeyboardEvent) => unknown> }).shortcuts.get("Shift+Enter")!({ isComposing: false, repeat: false, ...properties } as KeyboardEvent);
}

test("Shift+Enter flushes the query debounce and creates once even with an existing result", async () => {
 vi.useFakeTimers(); const { modal, gateway, coordinator, stage } = inlineSetup(); await flush();
 input(modal, "New note"); shiftEnter(modal); shiftEnter(modal);
 for (let i = 0; i < 16; i++) await flush();
 expect(gateway.parseTask).toHaveBeenCalledExactlyOnceWith("New note");
 expect(gateway.createTask).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: "New note" }), expect.anything());
 expect(stage).toHaveBeenCalledTimes(1);
 modal.onClose(); coordinator.dispose(); vi.useRealTimers();
});

test("modal-wide shortcut honors the edited query and ignores composition/repeated keys", async () => {
 vi.useFakeTimers(); const { modal, gateway, coordinator } = inlineSetup(); await flush();
 input(modal, "Search text"); await vi.advanceTimersByTimeAsync(151);
 input(modal, "Edited title");
 shiftEnter(modal, { isComposing: true }); shiftEnter(modal, { repeat: true }); await flush();
 expect(gateway.createTask).not.toHaveBeenCalled();
 shiftEnter(modal); for (let i = 0; i < 16; i++) await flush();
 expect(gateway.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Edited title" }), expect.anything());
 modal.onClose(); coordinator.dispose(); vi.useRealTimers();
});

test.each(["close", "edit"])("Shift+Enter cannot submit a stale pending parse after %s", async action => {
 vi.useFakeTimers(); const { modal, gateway, coordinator } = inlineSetup(); await flush();
 let resolve!: (data: { title: string }) => void;
 gateway.parseTask = () => new Promise(r => { resolve = r; });
 input(modal, "Old query"); await vi.advanceTimersByTimeAsync(151); shiftEnter(modal);
 if (action === "close") modal.onClose(); else input(modal, "New query");
 resolve({ title: "Old query" }); for (let i = 0; i < 8; i++) await flush();
 expect(gateway.createTask).not.toHaveBeenCalled();
 if (action !== "close") modal.onClose(); coordinator.dispose(); vi.useRealTimers();
});
test("inline create retains stage query/focus and disables unchanged draft, but edited query can create", async () => {
 vi.useFakeTimers(); const { modal, gateway, stage, coordinator } = inlineSetup(); await flush();
 expect(elements(modal.contentEl as unknown as Element).some(el => el.textContent === "New task title")).toBe(false);
 input(modal, "Brand new task"); shiftEnter(modal);
 for (let i = 0; i < 16; i++) await flush();
 expect(gateway.createTask).toHaveBeenCalledTimes(1); expect(stage).toHaveBeenCalledTimes(1);
 expect(modal.inputEl.value).toBe("Brand new task");
 shiftEnter(modal); for (let i = 0; i < 16; i++) await flush();
 expect(gateway.createTask).toHaveBeenCalledTimes(1);
 input(modal, "Next task"); shiftEnter(modal); for (let i = 0; i < 16; i++) await flush();
 expect(gateway.createTask).toHaveBeenCalledTimes(2);
 modal.onClose(); coordinator.dispose(); vi.useRealTimers();
});
test("metadata-only query asks for a title without creating", async () => {
 vi.useFakeTimers(); const { modal, gateway, coordinator } = inlineSetup();
 gateway.parseTask = () => Promise.resolve({ title: "Untitled Task", contexts: ["home"] });
 await flush(); input(modal, "@home"); shiftEnter(modal);
 for (let i = 0; i < 16; i++) await flush();
 expect(gateway.createTask).not.toHaveBeenCalled();
 expect(elements(modal.contentEl as unknown as Element).some(el => el.textContent.includes("Add a task title"))).toBe(true);
 modal.onClose(); coordinator.dispose(); vi.useRealTimers();
});
test("created add awaits save acknowledgement; failure retries the returned identity without creating again", async () => {
 vi.useFakeTimers(); const { modal, gateway, coordinator, add, closed } = inlineSetup("add");
 add.mockResolvedValueOnce({ kind: "failed/unsaved" } as never);
 await flush(); input(modal, "New"); await vi.advanceTimersByTimeAsync(151);
 shiftEnter(modal); for (let i = 0; i < 8; i++) await flush();
 expect(closed).not.toHaveBeenCalled(); expect(gateway.createTask).toHaveBeenCalledTimes(1);
 shiftEnter(modal); for (let i = 0; i < 8; i++) await flush();
 expect(closed).toHaveBeenCalledTimes(1); expect(add).toHaveBeenCalledTimes(2); expect(gateway.createTask).toHaveBeenCalledTimes(1);
 expect(gateway.startCalls).toEqual([]); coordinator.dispose(); vi.useRealTimers();
});
test("stale parse completion is discarded and close clears callbacks", async () => {
 vi.useFakeTimers(); const { modal, gateway, coordinator } = inlineSetup(); await flush();
 let resolve!: (value: { title: string }) => void;
 gateway.parseTask = () => new Promise(r => { resolve = r; });
 input(modal, "Old"); await vi.advanceTimersByTimeAsync(151); input(modal, "New"); resolve({ title: "Old" }); await flush();
 expect(gateway.createTask).not.toHaveBeenCalled();
 modal.onClose(); await vi.advanceTimersByTimeAsync(200); coordinator.dispose(); vi.useRealTimers();
});
test("selected task becoming completed before add stays open and is not persisted", async () => {
 const { modal, gateway, coordinator, add, closed } = inlineSetup("add"); await flush();
 gateway.setTask(task.path, { ...task, status: "done" }); gateway.statuses = () => Promise.resolve([{ value: "done", isCompleted: true }]);
 modal.selectSuggestion(task, {} as KeyboardEvent); for (let i = 0; i < 5; i++) await flush();
 expect(add).not.toHaveBeenCalled(); expect(closed).not.toHaveBeenCalled(); modal.onClose(); coordinator.dispose();
});

/* eslint-enable @typescript-eslint/unbound-method -- Restore method binding checks. */
