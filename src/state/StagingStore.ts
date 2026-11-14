import { normalizeTimerPath } from "../model/pomodoroOwnership";
import { fieldStatus, type FieldStatus } from "../model/stagedField";
import { deriveStaged, type StagedItem } from "../model/staging";
import { stagingDay } from "../model/stagingDay";
import type { Schedule, TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import { REFRESH_DEBOUNCE_MS } from "./TimerStore";
import type { StagedOrderStore } from "./StagedOrderStore";
import type { TaskInfo } from "../tasknotes/runtime-api.types";

export type { StagedItem } from "../model/staging";
export interface StagingSnapshot {
	items: readonly StagedItem[];
	loaded: boolean;
	supported: boolean;
	field: FieldStatus;
	canStage: boolean;
	warning: string;
	/** Null unless a current, unfiltered full task read succeeded. */
	authoritativePaths: ReadonlySet<string> | null;
}
export interface StagingStoreDeps {
	gateway: TaskNotesGateway;
	schedule: Schedule;
	log: (message: string) => void;
	getRolloverHour?: () => number;
	now?: () => number;
	ready?: () => Promise<void>;
	order?: StagedOrderStore;
	fileCheck?: () => ((path: string) => boolean) | null;
}

function under(path: string, parent: string): boolean { return path === parent || path.startsWith(parent + "/"); }

/** Shared read-only projection. Failed reads retain cards and revoke write readiness. */
export class StagingStore {
	private snapshot: StagingSnapshot = { items: [], loaded: false, supported: false, field: { kind: "unknown" }, canStage: false, warning: "", authoritativePaths: null };
	private generation = 0;
	private disposed = false;
	private dirty = false;
	private inFlight: Promise<void> | null = null;
	private cancel: (() => void) | null = null;
	private readonly listeners = new Set<() => void>();
	private readonly off: Array<() => void>;
	private remaps: Array<{ from: string; to: string }> = [];
	constructor(private readonly deps: StagingStoreDeps) {
		this.snapshot = { ...this.snapshot, supported: deps.gateway.stagingAvailability().available };
		this.off = [deps.gateway.onState(() => { this.invalidate(); this.requestRefresh(); }), deps.gateway.onData(() => { this.invalidate(); this.requestRefresh(); })];
		if (deps.gateway.getState().kind === "ready") this.requestRefresh();
	}
	getSnapshot(): StagingSnapshot { return this.snapshot; }
	get revision(): number { return this.generation; }
	/** Successful explicit null write only; refreshes never mutate TaskNotes. */
	removeItem(path: string): void {
		this.invalidate();
		this.snapshot = { ...this.snapshot, items: this.snapshot.items.filter(item => item.taskPath !== normalizeTimerPath(path)) };
		this.notify();
	}
	/** Vault rename authority precedes TaskNotes cache reindex and invalidates pending reads. */
	renamePath(oldPath: string, newPath: string): void {
		const from = normalizeTimerPath(oldPath); const to = normalizeTimerPath(newPath);
		if (!from || !to || from === to) return;
		this.invalidate(); this.remaps.push({ from, to });
		const mapped = new Map<string, StagedItem>();
		for (const item of this.snapshot.items) {
			const path = under(item.taskPath, from) ? to + item.taskPath.slice(from.length) : item.taskPath;
			if (!mapped.has(path)) mapped.set(path, { ...item, taskPath: path, task: { ...item.task, path } });
		}
		this.snapshot = { ...this.snapshot, items: [...mapped.values()] }; this.notify();
	}
	subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
	invalidate(): void {
		this.generation++;
		this.snapshot = { ...this.snapshot, field: { kind: "unknown" }, canStage: false, authoritativePaths: null };
		this.notify();
	}
	requestRefresh(): void {
		if (this.disposed) return;
		this.cancel?.();
		this.cancel = this.deps.schedule(() => { this.cancel = null; void this.refreshNow(); }, REFRESH_DEBOUNCE_MS);
	}
	resync(): void { if (this.deps.gateway.getState().kind === "ready") void this.refreshNow(); }
	refreshNow(): Promise<void> {
		this.cancel?.(); this.cancel = null;
		if (this.disposed) return Promise.resolve();
		if (this.inFlight) this.generation++;
		this.snapshot = { ...this.snapshot, canStage: false, field: { kind: "unknown" }, authoritativePaths: null };
		this.notify();
		if (this.inFlight) { this.dirty = true; return this.inFlight; }
		const run = this.refreshLoop().finally(() => { if (this.inFlight === run) this.inFlight = null; });
		this.inFlight = run; return run;
	}
	dispose(): void { this.disposed = true; this.generation++; this.cancel?.(); this.cancel = null; this.off.forEach(fn => fn()); this.listeners.clear(); }
	private async refreshLoop(): Promise<void> {
		do { this.dirty = false; await this.refreshOnce(); } while (this.dirty && !this.disposed);
	}
	private async refreshOnce(): Promise<void> {
		const { gateway } = this.deps;
		if (this.disposed || gateway.getState().kind !== "ready") return;
		const generation = this.generation;
		await this.deps.ready?.();
		if (this.disposed || generation !== this.generation || gateway.getState().kind !== "ready") return;
		if (!gateway.stagingAvailability().available) {
			this.snapshot = { ...this.snapshot, supported: false, canStage: false, field: { kind: "unknown" }, authoritativePaths: null };
			this.notify(); return;
		}
		const [tasks, statuses, fields] = await Promise.allSettled([gateway.listTasks(), gateway.statuses(), gateway.userFields()]);
		if (this.disposed || gateway.getState().kind !== "ready") return;
		if (generation !== this.generation) { this.dirty = true; return; }
		const field = fieldStatus(fields.status === "fulfilled" ? fields.value : null);
		const good = tasks.status === "fulfilled" && Array.isArray(tasks.value) && statuses.status === "fulfilled" && Array.isArray(statuses.value);
		const warning = !good ? "Couldn't refresh staged tasks. Showing the last available tasks." : field.kind === "unknown" ? "Couldn't check the staged field configuration." : "";
		const rawTasks = tasks.status === "fulfilled" && Array.isArray(tasks.value) ? tasks.value.filter(task => typeof task?.path === "string") : null;
		const fullTasks: TaskInfo[] | null = rawTasks?.map(task => {
			let path = normalizeTimerPath(task.path);
			for (const { from, to } of this.remaps) if (under(path, from)) path = to + path.slice(from.length);
			return path === task.path ? task : { ...task, path };
		}) ?? null;
		const paths = fullTasks ? new Set(fullTasks.map(task => normalizeTimerPath(task.path))) : null;
		const exists = this.deps.fileCheck?.() ?? null;
		let items = this.snapshot.items;
		if (good && fullTasks) {
			items = deriveStaged(fullTasks, new Set(statuses.value.filter(status => status?.isCompleted === true && typeof status.value === "string").map(status => status.value)), stagingDay((this.deps.now ?? Date.now)(), this.deps.getRolloverHour?.() ?? 4));
			// Only known vault renames earn reindex-gap retention. Filtered existing tasks do not.
			for (const previous of this.snapshot.items) if (!paths?.has(previous.taskPath) && this.remaps.some(({ to }) => under(previous.taskPath, to)) && (!exists || exists(previous.taskPath))) items = [...items, previous];
			const rawPaths = new Set(rawTasks?.map(task => normalizeTimerPath(task.path)));
			this.remaps = this.remaps.filter(({ from, to }) => [...rawPaths].some(path => under(path, from)) || this.snapshot.items.some(item => under(item.taskPath, to) && !rawPaths.has(item.taskPath)));
			if (paths) this.deps.order?.observe(items, paths, exists);
		}
		this.snapshot = {
			items,
			loaded: this.snapshot.loaded || good, supported: true, field,
			canStage: good && field.kind === "ok" && !field.hasDefault,
			warning, authoritativePaths: paths,
		};
		this.notify();
	}
	private notify(): void { for (const listener of [...this.listeners]) { try { listener(); } catch { this.deps.log("A staged task listener failed."); } } }
}
