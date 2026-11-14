import { fieldStatus, STAGED_FIELD_KEY } from "../model/stagedField";
import { isStageReserved } from "../model/staging";
import { stagingDay } from "../model/stagingDay";
import { MUTATION_SOURCE, type TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TimerPaneSettings } from "../settings";
import type { StagingStore } from "./StagingStore";
import type { TimerStore } from "./TimerStore";
import type { WriteQueue } from "./WriteQueue";

export type StageOutcome = { kind: "staged" | "already-staged" | "blocked" | "failed" | "busy"; message?: string; warning?: string };
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
}

/** User commands only; every TaskNotes mutation runs in the existing shared queue. */
export class StagingController {
	private pending = false;
	private readonly listeners = new Set<() => void>();
	constructor(private readonly deps: StagingControllerDeps) {}
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
}
