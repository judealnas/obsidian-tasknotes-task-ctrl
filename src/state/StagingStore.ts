import { normalizeTimerPath } from "../model/pomodoroOwnership";
import { fieldStatus, STAGED_FIELD_KEY, type FieldStatus } from "../model/stagedField";
import { stagingDay } from "../model/stagingDay";
import type { TaskInfo } from "../tasknotes/runtime-api.types";
import type { Schedule, TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import { REFRESH_DEBOUNCE_MS } from "./TimerStore";

export interface StagedItem { task: TaskInfo; taskPath: string; date: string; age: number; metadata: string; }
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
}

function readStaged(task: TaskInfo): unknown {
	const fields = task as TaskInfo & { staged?: unknown; customProperties?: Record<string, unknown> };
	return Object.hasOwn(fields, STAGED_FIELD_KEY) ? fields.staged : fields.customProperties?.[STAGED_FIELD_KEY];
}
function parseStagedValue(value: unknown): string | null {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split("-").map(Number) as [number, number, number];
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const limit = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
	return month >= 1 && month <= 12 && day >= 1 && day <= limit ? value : null;
}
function ordinal(date: string): number {
	const [year, month, day] = date.split("-").map(Number) as [number, number, number];
	const d = new Date(0); d.setUTCFullYear(year, month - 1, day); d.setUTCHours(0, 0, 0, 0);
	return d.getTime() / 86400000;
}
function deriveStaged(tasks: readonly TaskInfo[], completed: ReadonlySet<string>, today: string): StagedItem[] {
	const result = new Map<string, StagedItem>();
	for (const task of tasks) {
		if (typeof task?.path !== "string") continue;
		const taskPath = normalizeTimerPath(task.path);
		const date = parseStagedValue(readStaged(task));
		if (!taskPath || !date || date > today || task.archived || completed.has(task.status) || result.has(taskPath)) continue;
		const age = ordinal(today) - ordinal(date);
		const [year, month, day] = date.split("-").map(Number) as [number, number, number];
		const display = new Date(0); display.setFullYear(year, month - 1, day); display.setHours(12, 0, 0, 0);
		const formatted = display.toLocaleDateString(undefined, { month: "short", day: "numeric" });
		result.set(taskPath, { task, taskPath, date, age, metadata: `${formatted} · ${age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`}` });
	}
	return [...result.values()];
}

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
	constructor(private readonly deps: StagingStoreDeps) {
		this.snapshot = { ...this.snapshot, supported: deps.gateway.stagingAvailability().available };
		this.off = [deps.gateway.onState(() => { this.invalidate(); this.requestRefresh(); }), deps.gateway.onData(() => { this.invalidate(); this.requestRefresh(); })];
		if (deps.gateway.getState().kind === "ready") this.requestRefresh();
	}
	getSnapshot(): StagingSnapshot { return this.snapshot; }
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
		const paths = tasks.status === "fulfilled" && Array.isArray(tasks.value) ? new Set(tasks.value.filter(task => typeof task?.path === "string").map(task => normalizeTimerPath(task.path))) : null;
		this.snapshot = {
			items: good ? deriveStaged(tasks.value, new Set(statuses.value.filter(status => status.isCompleted).map(status => status.value)), stagingDay((this.deps.now ?? Date.now)(), this.deps.getRolloverHour?.() ?? 4)) : this.snapshot.items,
			loaded: this.snapshot.loaded || good, supported: true, field,
			canStage: good && field.kind === "ok" && !field.hasDefault,
			warning, authoritativePaths: paths,
		};
		this.notify();
	}
	private notify(): void { for (const listener of [...this.listeners]) { try { listener(); } catch { this.deps.log("A staged task listener failed."); } } }
}
