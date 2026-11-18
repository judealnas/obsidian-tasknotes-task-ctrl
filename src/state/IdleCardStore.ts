import { normalizeTimerPath, selectRegularStopTargets } from "../model/pomodoroOwnership";
import { displayTitle, taskDisplayKey, deriveSnapshot } from "../model/timeMath";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TaskInfo } from "../tasknotes/runtime-api.types";
import type { TaskCardModel } from "../ui/TaskCard";
import type { CardOrderStore } from "./CardOrderStore";
import type { PauseStore } from "./PauseStore";
import type { TimerController } from "./TimerController";

export const idleCardKey = (path: string): string => "idle-task:" + normalizeTimerPath(path);
const MAX_PATHS = 1000;
const under = (path: string, parent: string): boolean => path === parent || path.startsWith(parent + "/");
interface IdleCardDeps {
	gateway: TaskNotesGateway;
	pauses: PauseStore;
	order: CardOrderStore;
	controller: Pick<TimerController, "start" | "isBusy">;
	persist: () => Promise<void>;
	notify: (message: string) => void;
	log: (message: string) => void;
	fileCheck: () => ((path: string) => boolean) | null;
	visibleKeys: () => string[];
}

/** Pending local membership only. All TaskNotes writes remain in TimerController. */
export class IdleCardStore {
	private paths: string[] = [];
	private tasks = new Map<string, TaskInfo>();
	private loaded = false;
	private blocked = "Loading saved tasks";
	private preserved: Record<string, unknown> = {};
	private revision = 0;
	private disposed = false;
	private pending = false;
	private refreshing: Promise<void> | null = null;
	private dirty = false;
	private pathChanges: Array<{ from: string; to?: string }> = [];
	private listeners = new Set<() => void>();
	private resolveReady: () => void = () => undefined;
	private readonly readyPromise = new Promise<void>(resolve => { this.resolveReady = resolve; });
	constructor(private readonly deps: IdleCardDeps) {}
	ready(): Promise<void> { return this.readyPromise; }
	isBusy(): boolean { return this.pending; }
	availability(): { available: boolean; reason: string } {
		return { available: this.loaded && !this.blocked && !this.disposed && this.deps.gateway.getState().kind === "ready", reason: this.blocked || "Add a task without starting its timer" };
	}
	load(data: unknown, readable = true): void {
		if (this.loaded) return;
		const raw = typeof data === "object" && data !== null && !Array.isArray(data) ? data as Record<string, unknown> : {};
		for (const key of ["idleTaskPathsVersion", "idleTaskPaths"]) if (Object.prototype.hasOwnProperty.call(raw, key)) this.preserved[key] = raw[key];
		const absent = !Object.prototype.hasOwnProperty.call(raw, "idleTaskPathsVersion") && !Object.prototype.hasOwnProperty.call(raw, "idleTaskPaths");
		const valid = raw.idleTaskPathsVersion === 1 && Array.isArray(raw.idleTaskPaths) && raw.idleTaskPaths.every((path: unknown) => typeof path === "string" && path.length > 0 && path.length <= 4096 && normalizeTimerPath(path) !== "" && !path.split(/[\\/]/).includes(".."));
		this.blocked = !readable ? "Saved tasks could not be read. Reload Obsidian before adding or removing tasks." : !absent && !valid ? "Saved tasks use an unsupported or malformed format. Add and Remove are unavailable to preserve them." : "";
		if (!this.blocked && valid) this.paths = [...new Set((raw.idleTaskPaths as string[]).slice(0, MAX_PATHS).map(normalizeTimerPath))];
		this.loaded = true;
		this.resolveReady();
		this.changed();
		for (const change of this.pathChanges.splice(0)) this.changePath(change.from, change.to);
	}
	serialize(): Record<string, unknown> {
		if (this.blocked) return this.preserved;
		return this.paths.length ? { idleTaskPathsVersion: 1, idleTaskPaths: [...this.paths] } : {};
	}
	models(): TaskCardModel[] {
		return this.paths.map(path => {
			const task = this.tasks.get(path);
			return { state: "idle", taskPath: path, title: displayTitle(task?.title, path), displayKey: taskDisplayKey(task), task, pendingCard: true };
		});
	}
	subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
	private changed(): void {
		this.revision++;
		for (const listener of [...this.listeners]) { try { listener(); } catch { this.deps.log("An added-task listener failed."); } }
	}
	private async save(): Promise<void> { await this.deps.persist(); }
	private async action(run: () => Promise<void>): Promise<void> {
		if (this.pending || this.deps.controller.isBusy() || !this.availability().available) return;
		this.pending = true; this.changed();
		try { await run(); }
		catch { this.deps.log("Updating added tasks failed."); this.deps.notify("Couldn't update saved tasks. Changes may not survive a restart. Try again."); }
		finally { this.pending = false; this.changed(); }
	}
	/** An authoritative active read is required before Add/Remove/Start can change membership. */
	private async represented(path: string): Promise<boolean> {
		const active = await this.deps.gateway.active();
		return active.some(item => !item.entry.endTime && normalizeTimerPath(item.taskPath) === path) || !!this.deps.pauses.get(path);
	}
	async add(task: TaskInfo): Promise<void> {
		await this.action(async () => {
			const path = normalizeTimerPath(task.path); const revision = this.revision;
			if (!path || path.length > 4096 || path.split("/").includes("..")) return;
			const represented = await this.represented(path);
			if (!this.availability().available || revision !== this.revision || represented) return;
			if (!this.paths.includes(path)) {
				if (this.paths.length >= MAX_PATHS) { this.deps.notify("The added-task list is full. Remove a task first."); return; }
				this.paths.unshift(path); this.tasks.set(path, task);
				this.deps.order.prepend(idleCardKey(path), this.deps.visibleKeys()); this.changed();
			}
			await this.save();
		});
	}
	async remove(path: string): Promise<void> {
		await this.action(async () => {
			path = normalizeTimerPath(path); const revision = this.revision;
			const represented = await this.represented(path);
			if (!this.availability().available || revision !== this.revision || represented || !this.paths.includes(path)) return;
			this.forget(path); await this.save();
		});
	}
	async start(path: string, title: string): Promise<void> {
		await this.action(async () => {
			path = normalizeTimerPath(path); const revision = this.revision;
			if (!this.paths.includes(path)) return;
			const represented = await this.represented(path);
			if (!this.availability().available || revision !== this.revision) return;
			if (represented) { await this.reconcile(); return; }
			const outcome = await this.deps.controller.start({ taskPath: path, title });
			if (this.disposed || revision !== this.revision) return;
			if (outcome === "started" || outcome === "already-running") {
				await this.reconcile();
				// The controller confirmed a write. Never resurrect this pending card after Stop.
				if (outcome === "started" && !this.disposed && revision === this.revision && this.paths.includes(path)) { this.forget(path); await this.save(); }
			}
		});
	}
	private forget(path: string, sessionKey?: string): void {
		this.paths = this.paths.filter(item => item !== path); this.tasks.delete(path);
		this.deps.order.replaceIdentity(idleCardKey(path), sessionKey); this.changed();
	}
	private async reconcile(): Promise<void> {
		const revision = this.revision; const pauseRevision = this.deps.pauses.revision;
		// A failed read is not evidence to discard membership; save failures still propagate.
		const read = await Promise.all([this.deps.gateway.active(), this.deps.gateway.pomodoroOwnership()]).catch(() => null);
		if (!read) return;
		const [active, ownership] = read;
		if (this.disposed || revision !== this.revision || pauseRevision !== this.deps.pauses.revision || this.deps.gateway.getState().kind !== "ready") return;
		const regular = selectRegularStopTargets(active, ownership);
		const snapshot = deriveSnapshot(active, { records: this.deps.pauses.records(), tasks: new Map() });
		const timers = snapshot.primary ? [snapshot.primary, ...snapshot.others] : [];
		let changed = false;
		for (const path of [...this.paths]) {
			if (!regular.some(item => normalizeTimerPath(item.taskPath) === path)) continue;
			const timer = timers.find(item => normalizeTimerPath(item.taskPath) === path);
			if (timer) { this.forget(path, timer.sessionKey); changed = true; }
		}
		if (changed) await this.save();
	}
	refresh(): Promise<void> {
		if (this.refreshing) { this.dirty = true; return this.refreshing; }
		const run = this.refreshLoop().finally(() => { if (this.refreshing === run) this.refreshing = null; });
		this.refreshing = run; return run;
	}
	/** Invalidate reads across bridge disconnect/reconnect, even if it becomes ready again. */
	invalidate(): void { this.changed(); }
	private async refreshLoop(): Promise<void> {
		await this.ready();
		do {
			this.dirty = false;
			if (!this.availability().available || this.pending) return;
			const revision = this.revision;
			const exists = this.deps.fileCheck();
			let changed = false;
			for (const path of [...this.paths]) {
				if (this.disposed || revision !== this.revision) { this.dirty = true; break; }
				if (exists && !exists(path)) { this.forget(path); changed = true; this.dirty = true; break; }
				try {
					const task = await this.deps.gateway.getTask(path);
					if (this.disposed || revision !== this.revision || this.deps.gateway.getState().kind !== "ready") { this.dirty = true; break; }
					if (task) this.tasks.set(path, task);
				} catch { /* Failed reads retain membership and last good metadata. */ }
			}
			if (changed) { try { await this.save(); } catch { this.deps.log("Saving added tasks failed."); } }
			if (revision === this.revision) this.changed();
			if (!this.pending && !this.disposed) { try { await this.reconcile(); } catch { this.deps.log("Refreshing added tasks failed."); } }
		} while (this.dirty && !this.disposed);
	}
	removePath(path: string): void { this.changePath(path); }
	renamePath(from: string, to: string): void { this.changePath(from, to); }
	private changePath(rawFrom: string, rawTo?: string): void {
		if (this.disposed) return;
		if (!this.loaded) { this.pathChanges.push({ from: rawFrom, to: rawTo }); return; }
		if (this.blocked) return;
		const from = normalizeTimerPath(rawFrom); const to = rawTo === undefined ? undefined : normalizeTimerPath(rawTo);
		if (!from || (to !== undefined && !to)) return;
		// Even an in-flight Add for this path must be invalidated before its read returns.
		this.revision++;
		if (!this.paths.some(path => under(path, from))) return;
		this.paths = [...new Set(this.paths.flatMap(path => under(path, from) ? to === undefined ? [] : [to + path.slice(from.length)] : [path]))];
		const tasks = new Map<string, TaskInfo>();
		for (const [path, task] of this.tasks) {
			if (under(path, from)) { if (to !== undefined) { const next = to + path.slice(from.length); if (!tasks.has(next)) tasks.set(next, { ...task, path: next }); } }
			else if (!tasks.has(path)) tasks.set(path, task);
		}
		this.tasks = tasks; this.deps.order.changeIdlePath(from, to); this.changed();
		void this.save().catch(() => this.deps.log("Saving added tasks failed."));
	}
	dispose(): void { this.disposed = true; this.revision++; this.resolveReady(); this.listeners.clear(); }
}
