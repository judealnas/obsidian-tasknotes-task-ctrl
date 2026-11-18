import { afterEach, beforeEach, expect, test, vi } from "vitest";
import TaskNotesTimerPanePlugin from "../src/main";
import { emitVault, fireLayoutReady, host, resetHost, TFile } from "./fakes/fakeObsidian";
import { StagingController } from "../src/state/StagingController";
import type { TimerStore, TimerStoreDeps } from "../src/state/TimerStore";
import type { PauseStore } from "../src/state/PauseStore";
import type { TimerPaneSettingTab } from "../src/ui/TimerPaneSettingTab";
import type { TimerPaneSettings } from "../src/settings";
import type { App, PluginManifest } from "obsidian";
import type { StagedOrderStore } from "../src/state/StagedOrderStore";
import type { CompletionStore } from "../src/state/CompletionStore";
import type { StagingStore, StagingStoreDeps } from "../src/state/StagingStore";

vi.mock("obsidian", () => import("./fakes/fakeObsidian"));
// Captures the TimerStore main.ts builds, with its deps, so tests can reach fileCheck and requestRefresh.
const captured = vi.hoisted(() => ({ stores: [] as Array<{ deps: unknown; store: unknown }> }));
const capturedStaging = vi.hoisted(() => ({ stores: [] as Array<StagingStore> }));
vi.mock("../src/state/StagingStore", async (importOriginal) => {
 const actual = await importOriginal<typeof import("../src/state/StagingStore")>();
 return { ...actual, StagingStore: class extends actual.StagingStore {
  constructor(deps: StagingStoreDeps) { super(deps); capturedStaging.stores.push(this); }
 } };
});
vi.mock("../src/state/TimerStore", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../src/state/TimerStore")>();
	class CapturingTimerStore extends actual.TimerStore {
		constructor(deps: TimerStoreDeps) {
			super(deps);
			captured.stores.push({ deps, store: this });
		}
	}
	return { ...actual, TimerStore: CapturingTimerStore };
});
beforeEach(() => { resetHost(); captured.stores = []; vi.useFakeTimers(); vi.stubGlobal("window", { setTimeout, clearTimeout, setInterval }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test("TaskNotes Note actions stages the selected file only after clicking", async () => {
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 const staging = capturedStaging.stores[capturedStaging.stores.length - 1]!;
 const gateway = (staging as unknown as { deps: StagingStoreDeps }).deps.gateway;
 const available = vi.spyOn(gateway, "stagingAvailability").mockReturnValue({ available: true, reason: "" });
 const stage = vi.spyOn(StagingController.prototype, "stage").mockResolvedValue({ kind: "already-staged" });
 try {
  let click: (() => Promise<void>) | undefined;
  const item = { setTitle: vi.fn(() => item), setIcon: vi.fn(() => item), setDisabled: vi.fn(() => item), onClick: (callback: () => Promise<void>) => { click = callback; return item; } };
  const menu = { addItem: (callback: (value: typeof item) => void) => callback(item) };
  const handler = host.workspaceHandlers["file-menu"]![0]!;
  handler(menu, new TFile("Tasks/Chosen.md"), "tasknotes-context-menu");
  expect(item.setTitle).toHaveBeenCalledWith("Stage task");
  expect(item.setDisabled).toHaveBeenLastCalledWith(false);
  expect(stage).not.toHaveBeenCalled();
  await click!();
  expect(stage).toHaveBeenCalledExactlyOnceWith({ taskPath: "Tasks/Chosen.md", title: "Chosen" });
  expect(host.notices).toContain("This task is already staged.");
  available.mockReturnValue({ available: false, reason: "Disconnected" });
  handler(menu, new TFile("Tasks/Chosen.md"), "tasknotes-context-menu");
  expect(item.setDisabled).toHaveBeenLastCalledWith(true);
 } finally { stage.mockRestore(); available.mockRestore(); }
});

test("Stage task is absent from unrelated file menus and folder menus", async () => {
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 const menu = { addItem: vi.fn() };
 const handler = host.workspaceHandlers["file-menu"]![0]!;
 handler(menu, new TFile("Notes/Other.md"), "file-explorer");
 handler(menu, { path: "Folder" }, "tasknotes-context-menu");
 expect(menu.addItem).not.toHaveBeenCalled();
});

test.each([null, undefined, {}])("legacy empty data %j keeps defaults and stable registration", async data => {
 host.data = data;
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 expect(host.viewTypes).toEqual(["tasknotes-timer-pane"]);
 expect(host.commands).toEqual([{ id: "open-timer-pane", name: "Open timer pane" }]);
 expect(host.ribbonLabels).toEqual(["Open TaskNotes Task Control"]);
 expect(depsOf(host.tabs[0]).getSettings()).toEqual({ completionStatus: null });
 expect(host.saved).toEqual([]);
});

test("retired card details preferences survive unrelated settings saves unchanged", async () => {
 host.data = { completionStatus: "done", pauseRecordsVersion: 1, pauseRecords: [], cardDetails: { contexts: false, tags: true, subtasks: true }, extra: { retained: true } };
 const old = structuredClone(host.data);
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
 expect(host.saved[host.saved.length - 1]).toEqual(old);
});

test("populated 0.2 data round-trips through candidate settings saves without losing user state", async () => {
 host.data = { completionStatus: "done", pauseRecordsVersion: 1, pauseRecords: [PAUSED], cardOrder: ["a", "b"], stagedOrder: ["Tasks/A.md", "Tasks/B.md"], unknownExtension: { retained: true } };
 const old = structuredClone(host.data);
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
 expect(host.saved[host.saved.length - 1]).toEqual(old);
 host.data = host.saved[host.saved.length - 1];
 const next = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); next.onload(); await flush();
 expect(depsOf(host.tabs[1]).getSettings()).toEqual({ completionStatus: "done" });
 expect(orderOf(next).get()).toEqual(["a", "b"]);
 expect(stagedOrderOf(next).get()).toEqual(["Tasks/A.md", "Tasks/B.md"]);
});

test("no-pane safety refresh updates calendar age across midnight even offline", async () => {
 vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 59));
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 const staging = capturedStaging.stores[capturedStaging.stores.length - 1]!;
 const gateway = (staging as unknown as { deps: StagingStoreDeps }).deps.gateway;
 vi.spyOn(gateway, "getState").mockReturnValue({ kind: "ready" });
 vi.spyOn(gateway, "stagingAvailability").mockReturnValue({ available: true, reason: "" });
 const list = vi.spyOn(gateway, "listTasks").mockResolvedValue([{ path: "A.md", title: "A", status: "open", archived: false, ...{ staged: "2026-11-12" } }]);
 vi.spyOn(gateway, "statuses").mockResolvedValue([{ value: "done", label: "Done", isCompleted: true }]);
 vi.spyOn(gateway, "userFields").mockResolvedValue([{ id: "s", key: "staged", displayName: "Staged", type: "date" }]);
 await staging.refreshNow(); expect(staging.getSnapshot().items[0]?.age).toBe(1);
 list.mockRejectedValue(new Error("offline"));
 await vi.advanceTimersByTimeAsync(30_000); await flush();
 expect(staging.getSnapshot().items[0]?.age).toBe(2);
 staging.dispose();
});

test("completion history survives production saves, reloads and unrelated settings changes", async () => {
 const record = { attemptId: "one", sourcePath: "Tasks/a.md", requestDay: "2026-11-14", requestedAt: 123, beforeEvidence: { status: "open", staged: null, title: "A", completedStatus: "done" }, phase: "pending" as const, pendingCleanupPaths: [] };
 host.data = { completionRecordsVersion: 1, completionRecords: [record], extra: "kept", stagedOrder: ["Tasks/a.md"] };
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 const store = (plugin as unknown as { completions: CompletionStore }).completions;
 expect(store.records()).toEqual([record]);
 await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
 expect(host.saved[host.saved.length - 1]).toMatchObject({ completionRecordsVersion: 1, completionRecords: [record], extra: "kept", stagedOrder: ["Tasks/a.md"] });
 host.data = host.saved[host.saved.length - 1];
 const next = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); next.onload(); await flush();
 expect((next as unknown as { completions: CompletionStore }).completions.records()).toEqual([record]);
});
test("future completion safety data is retained by production settings saves", async () => {
 host.data = { completionRecordsVersion: 99, completionRecords: { protected: true }, extra: "kept" };
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
 expect(host.saved[host.saved.length - 1]).toMatchObject({ completionRecordsVersion: 99, completionRecords: { protected: true }, extra: "kept" });
 expect((plugin as unknown as { completions: CompletionStore }).completions.available()).toBe(false);
});

const PAUSED = {
	state: "paused",
	taskPath: "TaskNotes/Tasks/Write report.md",
	title: "Write report",
	sessionStartedAt: "2026-10-14T09:00:00.000Z",
	accumulatedMs: 600_000,
	pausedAt: "2026-10-14T09:10:00.000Z",
	lastEntryStart: "2026-10-14T09:00:00.000Z",
};

/** The settings tab's own save path, the one the dropdown calls. */
function saveSettingsOf(tab: unknown): (settings: TimerPaneSettings) => Promise<void> {
	return (tab as { deps: { saveSettings: (settings: TimerPaneSettings) => Promise<void> } }).deps.saveSettings;
}

test("registers view synchronously before loading settings and registering tab", async () => {
	host.data = { completionStatus: "removed" };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload();
	expect(host.order).toEqual(["view", "load", "settings"]);
	(host.tabs[0] as TimerPaneSettingTab).display(); await flush();
	expect(host.settings[0]!.dropdown.options).toEqual([{ value: "default", label: "Same as TaskNotes" }]);
	expect(host.saved).toEqual([]);
	host.settings[0]!.dropdown.change("default"); await flush();
	expect(host.saved).toEqual([{ completionStatus: null, pauseRecordsVersion: 1, pauseRecords: [] }]);
});

test("loading failures keep the plugin usable and log a safe explanation", async () => {
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest);
	vi.spyOn(plugin, "loadData").mockRejectedValue(new Error("private/path"));
	const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
	plugin.onload(); (host.tabs[0] as TimerPaneSettingTab).display(); await flush();
	expect(host.settings).toHaveLength(1);
	expect(log).toHaveBeenCalledWith("[tasknotes-timer-pane] Loading timer pane settings failed; using defaults.");
	await expect(saveSettingsOf(host.tabs[0])({ completionStatus: "done" })).rejects.toThrow("Saved plugin data is unreadable");
 expect(host.saved).toEqual([]);
	log.mockRestore();
});

test("stored pauses survive a restart and a settings save keeps them, the settings and unknown keys together", async () => {
	host.data = { completionStatus: "x", pauseRecordsVersion: 1, pauseRecords: [PAUSED], extraKey: 1 };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload();
	await flush();
	await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
	expect(host.saved).toEqual([{ extraKey: 1, completionStatus: "done", pauseRecordsVersion: 1, pauseRecords: [PAUSED] }]);
});

test("back-to-back settings saves never overlap, run in order and end with the newest setting and the pauses", async () => {
	host.data = { completionStatus: "x", pauseRecordsVersion: 1, pauseRecords: [PAUSED] };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest);
	const calls: unknown[] = [];
	const releases: Array<() => void> = [];
	let inFlight = 0;
	let maxInFlight = 0;
	plugin.saveData = (value: unknown) => {
		calls.push(structuredClone(value));
		maxInFlight = Math.max(maxInFlight, ++inFlight);
		return new Promise<void>(resolve => releases.push(() => { inFlight--; resolve(); }));
	};
	plugin.onload();
	await flush();
	const save = saveSettingsOf(host.tabs[0]);
	const first = save({ completionStatus: "first" });
	await flush();
	const second = save({ completionStatus: "second" });
	await flush();
	expect(calls).toHaveLength(1);
	releases[0]!();
	await flush();
	expect(calls).toHaveLength(2);
	releases[1]!();
	await Promise.all([first, second]);
	expect(maxInFlight).toBe(1);
	expect(calls.map(call => (call as { completionStatus: unknown }).completionStatus)).toEqual(["first", "second"]);
	expect(calls[1]).toEqual({ completionStatus: "second", pauseRecordsVersion: 1, pauseRecords: [PAUSED] });
});

test("a failed settings save rejects to the caller and does not break later saves", async () => {
	host.data = { completionStatus: "x" };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload();
	await flush();
	const save = saveSettingsOf(host.tabs[0]);
	host.failSave = true;
	await expect(save({ completionStatus: "lost" })).rejects.toThrow();
	host.failSave = false;
	await save({ completionStatus: "kept" });
	expect(host.saved).toEqual([{ completionStatus: "kept", pauseRecordsVersion: 1, pauseRecords: [] }]);
});

test("a pause change writes data.json with the settings last saved, never an older setting", async () => {
	host.data = { completionStatus: "x", extraKey: 1 };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest);
	const calls: unknown[] = [];
	const releases: Array<() => void> = [];
	plugin.saveData = (value: unknown) => {
		calls.push(structuredClone(value));
		return new Promise<void>(resolve => releases.push(resolve));
	};
	plugin.onload();
	await flush();
	const pauses = (plugin as unknown as { pauses: { set(record: unknown): void } }).pauses;
	const settingsSave = saveSettingsOf(host.tabs[0])({ completionStatus: "newer" });
	await flush();
	// The settings write is in flight; this pause save queues behind it.
	pauses.set(PAUSED);
	releases[0]!();
	await settingsSave; await flush();
	releases[1]!();
	await flush();
	expect(calls).toEqual([
		{ extraKey: 1, completionStatus: "newer", pauseRecordsVersion: 1, pauseRecords: [] },
		{ extraKey: 1, completionStatus: "newer", pauseRecordsVersion: 1, pauseRecords: [PAUSED] },
	]);
});

// ---- plan 03-02: vault rename/delete follow the pause (D-12) ----

function started(data: unknown) {
	host.data = data;
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest);
	plugin.onload();
	const pauses = (plugin as unknown as { pauses: PauseStore }).pauses;
	const entry = captured.stores[0] as { deps: TimerStoreDeps; store: TimerStore };
	const seen: string[][] = [];
	vi.spyOn(entry.store, "requestRefresh").mockImplementation(() => {
		seen.push(pauses.records().map(record => record.taskPath));
	});
	return { plugin, pauses, deps: entry.deps, seen };
}

test("the vault rename handler moves the pause before it requests a refresh", async () => {
	const ctx = started({ pauseRecordsVersion: 1, pauseRecords: [PAUSED] });
	await flush();
	emitVault("rename", { path: "TaskNotes/Tasks/Renamed.md" }, PAUSED.taskPath);
	expect(ctx.seen).toEqual([["TaskNotes/Tasks/Renamed.md"]]);
	expect(ctx.pauses.get("TaskNotes/Tasks/Renamed.md")).toEqual({ ...PAUSED, taskPath: "TaskNotes/Tasks/Renamed.md" });
});

test("the vault delete handler removes the pause before it requests a refresh", async () => {
	const ctx = started({ pauseRecordsVersion: 1, pauseRecords: [PAUSED] });
	await flush();
	emitVault("delete", { path: PAUSED.taskPath });
	expect(ctx.seen).toEqual([[]]);
});

test("a folder rename moves every pause inside it", async () => {
	const ctx = started({ pauseRecordsVersion: 1, pauseRecords: [PAUSED] });
	await flush();
	emitVault("rename", { path: "Archive/Tasks" }, "TaskNotes/Tasks");
	expect(ctx.seen).toEqual([["Archive/Tasks/Write report.md"]]);
});

test("fileCheck is null before layout ready and backed by vault.getFileByPath after it", () => {
	const ctx = started(undefined);
	const fileCheck = ctx.deps.fileCheck;
	expect(fileCheck).toBeTypeOf("function");
	expect(fileCheck!()).toBeNull();
	fireLayoutReady();
	const exists = fileCheck!();
	expect(exists).toBeTypeOf("function");
	host.files.add(PAUSED.taskPath);
	expect(exists!(PAUSED.taskPath)).toBe(true);
	expect(exists!("TaskNotes/Tasks/Gone.md")).toBe(false);
});

// ---- quick 261027-mcs: card order persistence ----

type OrderStore = { get(): readonly string[]; set(order: string[]): void };
const orderOf = (plugin: unknown) => (plugin as { cardOrder: OrderStore }).cardOrder;
const stagedOrderOf = (plugin: unknown) => (plugin as { stagedOrder: StagedOrderStore }).stagedOrder;

test("Staged ordering round-trips through the production writer and preserves every other key", async () => {
	host.data = { completionStatus: "x", pauseRecordsVersion: 1, pauseRecords: [PAUSED], cardOrder: ["timerA", "timerB"], stagedOrder: ["A.md", "B.md"], unknownKey: { keep: true } };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
	stagedOrderOf(plugin).set(["B.md", "A.md"]); orderOf(plugin).set(["timerB", "timerA"]);
	await saveSettingsOf(host.tabs[0])({ completionStatus: "done" }); await flush();
	const written = host.saved[host.saved.length - 1];
	expect(written).toEqual({ completionStatus: "done", pauseRecordsVersion: 1, pauseRecords: [PAUSED], cardOrder: ["timerB", "timerA"], stagedOrder: ["B.md", "A.md"], unknownKey: { keep: true } });
	host.data = written; const restarted = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); restarted.onload(); await flush();
	expect(stagedOrderOf(restarted).get()).toEqual(["B.md", "A.md"]);
	stagedOrderOf(restarted).set([]); await flush(); expect(host.saved[host.saved.length - 1]).not.toHaveProperty("stagedOrder");
});

test("a failed Staged order save does not poison the single writer's next save", async () => {
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
	const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
	host.failSave = true; stagedOrderOf(plugin).set(["B.md"]); await flush(); host.failSave = false;
	await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
	expect(host.saved[host.saved.length - 1]).toMatchObject({ stagedOrder: ["B.md"], completionStatus: "done" }); log.mockRestore();
});

test("vault renames synchronously remap Staged order at slash boundaries", async () => {
	host.data = { stagedOrder: ["Tasks/A.md", "Tasks2/B.md", "Tasks/C.md"] };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
	emitVault("rename", { path: "Archive" }, "Tasks");
	expect(stagedOrderOf(plugin).get().join(",")).toBe("Archive/A.md,Tasks2/B.md,Archive/C.md");
});

test("a stored card order loads and a settings save keeps it", async () => {
	host.data = { cardOrder: ["a", "b"], extraKey: 1 };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload();
	await flush();
	expect(orderOf(plugin).get()).toEqual(["a", "b"]);
	await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
	expect(host.saved).toEqual([{ extraKey: 1, completionStatus: "done", pauseRecordsVersion: 1, pauseRecords: [], cardOrder: ["a", "b"] }]);
});

test("setting the card order writes data.json with the settings and pauses", async () => {
	host.data = { completionStatus: "x", pauseRecordsVersion: 1, pauseRecords: [PAUSED] };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload();
	await flush();
	orderOf(plugin).set(["b", "a"]);
	await flush();
	expect(host.saved).toEqual([{ completionStatus: "x", pauseRecordsVersion: 1, pauseRecords: [PAUSED], cardOrder: ["b", "a"] }]);
});

test("no saved order means no cardOrder key is written", async () => {
	host.data = { cardOrder: [] };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload();
	await flush();
	await saveSettingsOf(host.tabs[0])({ completionStatus: "done" });
	expect(host.saved).toEqual([{ completionStatus: "done", pauseRecordsVersion: 1, pauseRecords: [] }]);
});

test("a malformed card order loads empty; a load rejection keeps the plugin usable", async () => {
	host.data = { cardOrder: { a: 1 } };
	const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload();
	await flush();
	expect(orderOf(plugin).get()).toEqual([]);
	const failing = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest);
	vi.spyOn(failing, "loadData").mockRejectedValue(new Error("private/path"));
	const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
	failing.onload();
	await flush();
	expect(orderOf(failing).get()).toEqual([]);
	orderOf(failing).set(["z"]);
	await flush();
	expect(host.saved).toEqual([]);
	log.mockRestore();
});

// ---- 04-03: rollover hour (SETUP-01, D-01, D-07) ----

const depsOf = (tab: unknown) => (tab as { deps: { getSettings: () => TimerPaneSettings } }).deps;

test("legacy rollover setting is retired on the next save without changing pauses or other data", async () => {
 host.data = { completionStatus: "x", rolloverHour: 6, pauseRecordsVersion: 1, pauseRecords: [PAUSED], cardOrder: ["a", "b"], extraKey: 1 };
 const plugin = new TaskNotesTimerPanePlugin({} as App, {} as PluginManifest); plugin.onload(); await flush();
 expect(depsOf(host.tabs[0]).getSettings()).toEqual({ completionStatus: "x" });
 await saveSettingsOf(host.tabs[0])({ completionStatus: null });
 expect(host.saved[host.saved.length - 1]).toEqual({ completionStatus: null, pauseRecordsVersion: 1, pauseRecords: [PAUSED], cardOrder: ["a", "b"], extraKey: 1 });
 (host.tabs[0] as TimerPaneSettingTab).display(); await flush();
 expect(host.settings.map(s => s.name)).toEqual(["Completion status"]);
});
