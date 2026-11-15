import { Component, Platform, setIcon, setTooltip, type App } from "obsidian";
import { TaskTitle } from "./TaskTitle";
import { formatHms, timerSessionMs, totalMs, type OpenTimer } from "../model/timeMath";
import type { TimerPaneServices } from "./TimerPaneView";

export interface IdleTaskCard {
	state: "idle";
	taskPath: string;
	title: string;
	displayKey: string;
}
export type TaskCardModel = (OpenTimer | IdleTaskCard) & { stagedMetadata?: string; stagedCard?: boolean; stagedMarker?: boolean; pendingCard?: boolean };
function cardKey(model: TaskCardModel): string { return model.state === "idle" ? model.taskPath : model.sessionKey; }

export interface TaskCardOptions {
 app: App;
 gateway: TimerPaneServices["gateway"];
 controller: TimerPaneServices["controller"];
 completion?: TimerPaneServices["completion"];
 isBusy?: () => boolean;
 unstage?: (target: { taskPath: string; title: string }) => Promise<unknown>;
 removeIdle?: (path: string) => Promise<void>;
 startIdle?: (path: string, title: string) => Promise<void>;
}
const STOP_LABEL = "Stop timer";
const STOPPING_LABEL = "Stopping…";
const UNKNOWN_TOTAL = "—";
interface CardElements {
	timer: TaskCardModel;
	card: HTMLElement;
	/** Drag handle; the only draggable element of the card. */
	handle: HTMLButtonElement;
	title: HTMLElement;
	titleLabel: HTMLElement;
	titleOwner: TaskTitle;
	clock: HTMLElement;
	total: HTMLElement;
	/** Pause on a running card, Resume on a paused one (D-01, D-09). */
	pauseResume: HTMLButtonElement;
	pauseResumeIcon: HTMLElement;
	pauseResumeLabel: HTMLElement;
	/** The state the pause/resume button last showed; null before the first render. */
	shownState: TaskCardModel["state"] | null;
	metadata: HTMLElement;
	stop: HTMLButtonElement;
	stopLabel: HTMLElement;
	complete: HTMLButtonElement;
	unstage: HTMLButtonElement;
}


/** Writes text only when it changed, so the polite live region is not re-announced. */
function setTextIfChanged(el: HTMLElement, text: string): void {
	if (el.textContent !== text) el.setText(text);
}



/** Owns a single timer's DOM, actions and all pending/current title renderers. No interval. */
export class TaskCard extends Component {
 private elements: CardElements;
 private disposed = false;
 private completionReady = false;
 private availabilityGeneration = 0;
 private availabilityKey: string | null = null;
 private availabilityResult: { available: boolean; reason: string } | null = null;
 private stopping = new Set<string>();
 private reorder: ((delta: -1 | 1) => void) | null = null;
 private moveUp: HTMLButtonElement | null = null;
 private moveDown: HTMLButtonElement | null = null;
 private get app(): App { return this.options.app; }
 private isBusy(): boolean { return this.options.isBusy?.() ?? this.options.controller.isBusy(); }
 constructor(parent: HTMLElement, timer: TaskCardModel, private readonly options: TaskCardOptions) {
  super();
  this.load();
  this.elements = this.buildCard(parent, cardKey(timer), timer);
 }
 get card(): HTMLElement { return this.elements.card; }
 get handle(): HTMLButtonElement { return this.elements.handle; }
 get currentModel(): TaskCardModel { return this.elements.timer; }
 setPosition(index: number, count: number, move: (delta: -1 | 1) => void): void {
  if (this.disposed) return;
  this.reorder = move;
  if (this.moveUp) this.moveUp.disabled = index === 0;
  if (this.moveDown) this.moveDown.disabled = index === count - 1;
 }
 update(timer: TaskCardModel, completionReady: boolean): void {
  if (this.disposed) return;
  const card = this.elements;
  card.timer = timer;
  this.completionReady = completionReady;
  card.titleOwner.update(timer);
  setTextIfChanged(card.titleLabel, `Open ${timer.title}`);
  setTextIfChanged(card.metadata, timer.stagedMetadata ?? (timer.stagedMarker ? "Staged" : ""));
  card.card.toggleClass("tntp-card--idle", timer.state === "idle");
  card.card.toggleClass("tntp-card--staged", !!timer.stagedCard);
  card.card.toggleClass("tntp-card--pending", !!timer.pendingCard);
  this.updatePauseResume(card);
  const busy = this.isBusy();
  card.unstage.disabled = busy || (timer.pendingCard ? !this.options.removeIdle : !this.options.unstage);
  setTooltip(card.unstage, timer.pendingCard ? "Remove task from Timers" : "Unstage task");
  card.complete.disabled = busy || !completionReady || !!timer.stagedCard || timer.state === "idle";
  setTooltip(card.complete, timer.stagedCard ? "Staged task completion will be available in a later update" : busy ? "A timer action is in progress" : completionReady ? "Complete this task and stop its timer" : "No completed status is available from TaskNotes");
  if (this.options.completion) {
   const key = [timer.taskPath, timer.displayKey, timer.state, completionReady, busy].join("\0");
   if (key !== this.availabilityKey) {
    this.availabilityKey = key; this.availabilityResult = null;
    const generation = ++this.availabilityGeneration;
    if (!busy) void this.options.completion.availability({ sourcePath: timer.taskPath, title: timer.title }).then(result => {
     if (this.disposed || generation !== this.availabilityGeneration) return;
     this.availabilityResult = result;
     card.complete.disabled = this.isBusy() || !result.available;
     setTooltip(card.complete, this.isBusy() ? "A task action is in progress" : result.reason);
    });
   }
   card.complete.disabled = busy || !this.availabilityResult?.available;
   setTooltip(card.complete, busy ? "A task action is in progress" : this.availabilityResult?.reason ?? "Checking completion availability");
  }
  if (!this.stopping.has(cardKey(timer))) {
   card.stop.disabled = busy;
   setTextIfChanged(card.stopLabel, STOP_LABEL);
  }
 }
 writeTimes(nowMs: number): void {
  if (this.disposed) return;
  const { timer, clock, total } = this.elements;
  if (timer.state === "idle") return;
  setTextIfChanged(clock, formatHms(timerSessionMs(timer, nowMs)));
  setTextIfChanged(total, timer.totalKnown ? formatHms(totalMs(timer.entries, nowMs)) : UNKNOWN_TOTAL);
 }
 dispose(): void {
  if (this.disposed) return;
  this.disposed = true;
  this.elements.titleOwner.dispose(); this.elements.card.detach();
  this.unload();
 }
	private buildCard(parent: HTMLElement, key: string, timer: TaskCardModel): CardElements {
		const card = parent.createDiv({ cls: "tntp-card" });
		if (Platform.isMobile) {
			card.addClass("tntp-card--mobile");
			const column = card.createDiv({ cls: "tntp-reorder" });
			this.moveUp = column.createEl("button", { cls: "tntp-reorder__up", text: "▲", attr: { "aria-label": "Move task up" } });
			this.moveDown = column.createEl("button", { cls: "tntp-reorder__down", text: "▼", attr: { "aria-label": "Move task down" } });
			this.moveUp.disabled = true; this.moveDown.disabled = true;
			for (const [button, delta] of [[this.moveUp, -1], [this.moveDown, 1]] as const) button.addEventListener("click", () => {
				if (this.disposed || button.disabled || !this.reorder) return;
				this.reorder(delta);
				if (this.disposed) return;
				const other = delta === -1 ? this.moveDown : this.moveUp;
				const focus = !button.disabled ? button : other && !other.disabled ? other : this.elements.handle;
				focus.focus();
			});
		}
		const handle = card.createEl("button", { cls: "tntp-handle", attr: { "aria-label": "Reorder card", draggable: "true" } });
		setIcon(handle, "grip-vertical");
		setTooltip(handle, "Drag to reorder, or use Up and Down arrow keys");
		// The tooltip owns aria-label ("Open task note"); the accessible name
		// "Open {title}" comes from a visually hidden label via aria-labelledby.
		const titleOwner = new TaskTitle(card, timer, { app: this.app, gateway: this.options.gateway });
		const title = titleOwner.title; const titleLabel = titleOwner.titleLabel;
		const metadata = card.createDiv({ cls: ["tntp-label", "tntp-staged-metadata"] });

		const session = card.createDiv({ cls: ["tntp-stat", "tntp-stat--session"] });
		session.createSpan({ cls: "tntp-label", text: "Session" });
		const clock = session.createSpan({ cls: "tntp-clock", attr: { role: "timer", "aria-live": "off" } });
		const totalRow = card.createDiv({ cls: ["tntp-stat", "tntp-stat--total"] });
		totalRow.createSpan({ cls: "tntp-label", text: "Total" });
		const total = totalRow.createSpan({ cls: "tntp-total" });

		// One click, no confirmation: stopping closes the entry and keeps it (CTRL-01).
		// Card listeners live on the card itself and go away with it when it is detached.
		const actions = card.createDiv({ cls: "tntp-actions" });
		const pauseResume = actions.createEl("button", { cls: "tntp-pause-resume" });
		const pauseResumeIcon = pauseResume.createSpan({ cls: "tntp-pause-resume__icon" });
		const pauseResumeLabel = pauseResume.createSpan({ cls: "tntp-pause-resume__label" });
		// The target is read from the card at click time, so a refresh cannot redirect the write.
		pauseResume.addEventListener("click", () => {
			const current = (this.disposed ? undefined : this.elements);
			if (!current || pauseResume.disabled || this.isBusy()) return;
			const model = current.timer;
			const { taskPath, title } = model;
			if (model.state === "idle") {
				if (model.pendingCard) void this.options.startIdle?.(taskPath, title);
				else void this.options.controller.start({ taskPath, title });
			}
			else if (model.state === "paused") void this.options.controller.resume({ taskPath, title });
			else void this.options.controller.pause({ taskPath, startTime: model.startTime, title });
		});
		const stop = actions.createEl("button", { cls: ["mod-cta", "tntp-stop"] });
		setIcon(stop.createSpan({ cls: "tntp-stop__icon" }), "square");
		const stopLabel = stop.createSpan({ cls: "tntp-stop__label", text: STOP_LABEL });
		stop.addEventListener("click", () => void this.stopTask(key));
		const complete = actions.createEl("button", { cls: "tntp-complete", text: "Complete" });
		complete.addEventListener("click", () => {
			const current = (this.disposed ? undefined : this.elements);
			if (!current || complete.disabled || this.isBusy()) return;
   const model = current.timer;
   if (!this.options.completion && (model.state === "idle" || model.stagedCard)) return;
			void this.options.controller.complete({ taskPath: model.taskPath, title: model.title, ...(model.state === "idle" ? {} : { startTime: model.startTime }) });
		});
		const unstage = card.createEl("button", { cls: "tntp-unstage", text: "✕" });
		setTooltip(unstage, "Unstage task");
		unstage.addEventListener("click", () => {
			if (this.disposed || unstage.disabled || this.isBusy()) return;
			if (this.elements.timer.pendingCard) { void this.options.removeIdle?.(this.elements.timer.taskPath); return; }
			if (!this.elements.timer.stagedCard) return;
			const { taskPath, title } = this.elements.timer;
			void this.options.unstage?.({ taskPath, title });
		});

		return {
			timer,
			card,
			handle,
			title,
			titleLabel,
			titleOwner,
			clock,
			total,
			pauseResume,
			pauseResumeIcon,
			pauseResumeLabel,
			shownState: null,
			stop,
			stopLabel,
			complete,
			metadata,
			unstage,
		};
	}

	/**
	 * Stops that card's timer only. The target is captured at click time, so a
	 * refresh landing mid-stop cannot redirect the write to another task. On a paused
	 * card nothing is running: Stop only forgets the pause (D-09).
	 */
	private async stopTask(key: string): Promise<void> {
		const card = (this.disposed ? undefined : this.elements);
		if (this.isBusy() || this.stopping.has(key) || !card) return;
		if (card.timer.state === "idle") return;
		const { taskPath, startTime, title, state } = card.timer;
		this.stopping.add(key);
		card.stop.disabled = true;
		setTextIfChanged(card.stopLabel, STOPPING_LABEL);
		try {
			if (state === "paused") await this.options.controller.stopPaused({ taskPath, title });
			else await this.options.controller.stop({ taskPath, startTime, title });
		} finally {
			this.stopping.delete(key);
			// The card, or the whole view, may be gone once the stop settles.
			const current = (this.disposed ? undefined : this.elements);
			if (current) {
				current.stop.disabled = false;
				setTextIfChanged(current.stopLabel, STOP_LABEL);
			}
			if (!this.disposed) this.update(this.elements.timer, this.completionReady);
		}
	}


	private updatePauseResume(card: CardElements): void {
		const paused = card.timer.state === "paused";
		const idle = card.timer.state === "idle";
		if (card.shownState !== card.timer.state) {
			card.shownState = card.timer.state;
			card.card.toggleClass("tntp-card--paused", paused);
			setIcon(card.pauseResumeIcon, paused || idle ? "play" : "pause");
			setTextIfChanged(card.pauseResumeLabel, idle ? "Start" : paused ? "Resume" : "Pause");
			card.pauseResume.toggleClass("mod-cta", paused || idle);
			card.stop.toggleClass("mod-cta", !paused);
		}
		const busy = this.isBusy();
		const gate = idle && card.timer.pendingCard ? this.options.gateway.startAvailability() : null;
		card.pauseResume.disabled = busy || !!gate && !gate.available;
		setTooltip(card.pauseResume, busy ? "A timer action is in progress" : gate && !gate.available ? gate.reason : idle ? "Start this task" : paused ? "Resume this timer" : "Pause this timer");
	}


}

