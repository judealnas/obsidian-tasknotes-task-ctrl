import { fieldStatus, STAGED_FIELD_KEY } from "../model/stagedField";
import { isStageReserved } from "../model/staging";
import { stagingDay } from "../model/stagingDay";
import { MUTATION_SOURCE, type TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TimerPaneSettings } from "../settings";
import type { StagingStore } from "./StagingStore";
import type { TimerStore } from "./TimerStore";
import type { WriteQueue } from "./WriteQueue";
import { PauseStore } from "./PauseStore";
import { normalizeTimerPath, sameEntry, type EntryId, type Ownership } from "../model/pomodoroOwnership";
import { isNoActiveSessionError } from "../model/errors";

export type StageOutcome = { kind: "staged" | "already-staged" | "blocked" | "failed" | "busy"; message?: string; warning?: string };
export type UnstageOutcome = { kind: "unstaged" | "blocked" | "failed" | "partial" | "busy"; message?: string; warning?: string };
export interface StagingControllerDeps {
	gateway: TaskNotesGateway;
	queue: WriteQueue;
	staging: StagingStore;
	store: Pick<TimerStore, "refreshNow">;
	getSettings: () => TimerPaneSettings;
	settingsReady: () => Promise<void>;
	timerBusy: () => boolean;
	newCorrelationId: () => string;
	log: (message: string) => void;
	now?: () => number;
	/** Explicit action-only persistence seam, connected by the ordering plan. */
	commitOrder?: (path: string, action: "stage" | "unstage") => Promise<void>;
	pauses?: PauseStore;
	notify?: (message: string) => void;
}

/** User commands only; every TaskNotes mutation runs in the existing shared queue. */
export class StagingController {
	private pending = false;
	private readonly listeners = new Set<() => void>();
	private readonly pauses: PauseStore;
	constructor(private readonly deps: StagingControllerDeps) {
		this.pauses = deps.pauses ?? new PauseStore({ log: deps.log });
		if (!deps.pauses) this.pauses.load([]);
	}
	isBusy(): boolean { return this.pending; }
	subscribeBusy(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
	private busy(value: boolean): void { this.pending = value; for (const listener of [...this.listeners]) { try { listener(); } catch { this.deps.log("A staging action listener failed."); } } }
	async stage(target: { taskPath: string; title: string }): Promise<StageOutcome> {
		if (this.pending || this.deps.timerBusy()) return { kind: "busy", message: "Another task action is in progress. Try again." };
		this.busy(true);
		const { gateway, staging } = this.deps;
		let result: StageOutcome = { kind: "failed", message: "Couldn't stage this task. Try again." };
		try {
			result = await this.deps.queue.run(async (): Promise<StageOutcome> => {
				await this.deps.settingsReady();
				if (!gateway.stagingAvailability().available) return { kind: "blocked", message: "Staging is unavailable. Check TaskNotes and retry." };
				const revision = staging.revision;
				const [fields, statuses, task] = await Promise.all([gateway.userFields(), gateway.statuses(), gateway.getTask(target.taskPath)]);
				const field = fieldStatus(fields);
				if (field.kind !== "ok" || field.hasDefault) return { kind: "blocked", message: "Register staged as a Date field with no default value, then retry." };
				if (!task || task.archived || statuses.some(status => status.isCompleted && status.value === task.status)) return { kind: "blocked", message: "This task is no longer available to stage." };
				if (isStageReserved(task)) return { kind: "already-staged" };
				const latestField = fieldStatus(await gateway.userFields());
				if (revision !== staging.revision || !gateway.stagingAvailability().available || latestField.kind !== "ok" || latestField.hasDefault) return { kind: "blocked", message: "TaskNotes changed while checking this task. Retry." };
				const latestTask = await gateway.getTask(target.taskPath);
				if (revision !== staging.revision || !gateway.stagingAvailability().available || !latestTask || latestTask.archived || statuses.some(status => status.isCompleted && status.value === latestTask.status)) return { kind: "blocked", message: "This task changed while checking. Retry." };
				if (isStageReserved(latestTask)) return { kind: "already-staged" };
				const date = stagingDay((this.deps.now ?? Date.now)(), this.deps.getSettings().rolloverHour);
				staging.invalidate();
				await gateway.updateTask(task.path, { [STAGED_FIELD_KEY]: date }, { source: MUTATION_SOURCE, reason: "user stage", correlationId: this.deps.newCorrelationId() });
				staging.invalidate();
				const outcome: StageOutcome = { kind: "staged" };
				try { await this.deps.commitOrder?.(task.path, "stage"); }
				catch { outcome.warning = "Task staged, but its order couldn't be saved."; }
				return outcome;
			});
		} catch { this.deps.log("Staging a task failed."); }
		finally {
			try { await Promise.all([this.deps.store.refreshNow(), staging.refreshNow()]); }
			catch { if (result.kind === "staged") result.warning = "Task staged. The list couldn't refresh yet; retry the refresh."; }
			this.busy(false);
		}
		return result;
	}

	async unstage(target: { taskPath: string; title: string }): Promise<UnstageOutcome> {
		if (this.pending || this.deps.timerBusy()) return { kind: "busy", message: "Another task action is in progress. Try again." };
		this.busy(true);
		const { gateway, staging } = this.deps;
		let stopped = false;
		let pauseCleared = false;
		let result: UnstageOutcome = { kind: "failed", message: "Couldn't unstage this task. Try again." };
		try {
			result = await this.deps.queue.run(async (): Promise<UnstageOutcome> => {
				await this.deps.settingsReady(); await this.pauses.ready();
				if (!gateway.stagingAvailability().available) return { kind: "blocked", message: "Staging is unavailable. Check TaskNotes and retry." };
				const revision = staging.revision;
				const field = fieldStatus(await gateway.userFields());
				if (field.kind !== "ok") return { kind: "blocked", message: "Check the registered staged Date field, then retry." };
				const active = await gateway.active();
				const ownership = await this.readOwnership();
				const onPath = active.filter(item => !item.entry.endTime && normalizeTimerPath(item.taskPath) === normalizeTimerPath(target.taskPath));
				if (onPath.length && !ownership.readable) return { kind: "blocked", message: "Couldn't verify Pomodoro ownership. Retry when TaskNotes is ready." };
				const latestField = fieldStatus(await gateway.userFields());
				if (revision !== staging.revision || !gateway.stagingAvailability().available || latestField.kind !== "ok") return { kind: "blocked", message: "TaskNotes changed while checking this task. Retry." };
				for (const item of onPath) {
					const id = { taskPath: item.taskPath, startTime: item.entry.startTime };
					if (ownership.readable && ownership.owner && sameEntry(id, ownership.owner)) continue;
					const outcome = await this.stopForUnstage(id);
					if (outcome === "blocked") return { kind: stopped ? "partial" : "blocked", message: "The timer changed while unstaging. The task stays staged; retry." };
					if (outcome === "stopped") stopped = true;
				}
				// Recheck registration after any stop. A nonempty default only blocks Stage.
				if (!gateway.stagingAvailability().available || fieldStatus(await gateway.userFields()).kind !== "ok") return { kind: stopped ? "partial" : "blocked", message: "Check the staged Date field, then retry. The task is still staged." };
				pauseCleared = this.pauses.get(target.taskPath) !== undefined;
				this.pauses.remove(target.taskPath);
				staging.invalidate();
				await gateway.updateTask(target.taskPath, { [STAGED_FIELD_KEY]: null }, { source: MUTATION_SOURCE, reason: "user unstage", correlationId: this.deps.newCorrelationId() });
				staging.removeItem(target.taskPath);
				const outcome: UnstageOutcome = { kind: "unstaged" };
				try { await this.deps.commitOrder?.(target.taskPath, "unstage"); }
				catch { outcome.warning = "Task unstaged, but its order couldn't be saved."; }
				return outcome;
			});
		} catch {
			this.deps.log("Unstaging a task failed.");
			if (stopped || pauseCleared) result = { kind: "partial", message: "Timing stopped or its pause cleared, but the task is still staged. Retry unstage." };
		} finally {
			try { await Promise.all([this.deps.store.refreshNow(), staging.refreshNow()]); }
			catch { if (result.kind === "unstaged") result.warning = "Task unstaged. The list couldn't refresh yet."; }
			this.busy(false);
		}
		const message = result.warning ?? result.message;
		if (message) { try { this.deps.notify?.(message); } catch { this.deps.log("Showing the staging result failed."); } }
		return result;
	}
	private async readOwnership(): Promise<Ownership> {
		try { return await this.deps.gateway.pomodoroOwnership(); } catch { return { readable: false }; }
	}
	/** Nonqueued body: never call a public TimerController action from inside queue.run. */
	private async stopForUnstage(target: EntryId): Promise<"stopped" | "absent" | "owned" | "blocked"> {
		const { gateway } = this.deps;
		if (!Number.isFinite(Date.parse(target.startTime))) return "blocked";
		const active = await gateway.active();
		const ownership = await this.readOwnership();
		const onPath = active.filter(item => !item.entry.endTime && normalizeTimerPath(item.taskPath) === normalizeTimerPath(target.taskPath));
		if (!onPath.length) return "absent";
		if (!ownership.readable) return "blocked";
		if (!onPath.some(item => sameEntry({ taskPath: item.taskPath, startTime: item.entry.startTime }, target))) return "blocked";
		if (ownership.owner && sameEntry(target, ownership.owner)) return "owned";
		if (!gateway.stagingAvailability().available) return "blocked";
		// TaskNotes stop is path-only: an external actor can still race this final check.
		try { await gateway.stop(target.taskPath, { source: MUTATION_SOURCE, reason: "user unstage stop", correlationId: this.deps.newCorrelationId() }); }
		catch (error) { if (isNoActiveSessionError(gateway.normalizeError(error).message)) return "absent"; throw error; }
		return "stopped";
	}
}
