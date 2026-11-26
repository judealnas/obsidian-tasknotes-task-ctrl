import { Component, Notice, Platform, setIcon, setTooltip, type App } from "obsidian";
import { TaskTitle } from "./TaskTitle";
import { CardRelationshipView } from "./CardRelationshipView";
import type { CardRelationshipSnapshot, CardRelationshipSource } from "../state/CardRelationships";
import { formatHms, parseEntries, timerSessionMs, totalMs, type OpenTimer } from "../model/timeMath";
import type { TimerPaneServices } from "./TimerPaneView";
import type { TaskInfo } from "../tasknotes/runtime-api.types";
import { formatCountdown, parseCountdown } from "../model/countdown";

export interface IdleTaskCard {
	state: "idle";
	taskPath: string;
	title: string;
	displayKey: string;
	task?: TaskInfo;
}
export type TaskCardModel = (OpenTimer | IdleTaskCard) & { stagedMetadata?: string; stagedCard?: boolean; pendingCard?: boolean };
function cardKey(model: TaskCardModel): string { return model.state === "idle" ? model.taskPath : model.sessionKey; }

export interface TaskCardOptions {
 relationships?: CardRelationshipSource;
 onRelationships?: (snapshot: CardRelationshipSnapshot) => void;
 app: App;
 gateway: TimerPaneServices["gateway"];
 controller: TimerPaneServices["controller"];
 completion?: TimerPaneServices["completion"];
 isBusy?: () => boolean;
 unstage?: (target: { taskPath: string; title: string }) => Promise<unknown>;
 removeIdle?: (path: string) => Promise<void>;
 startIdle?: (path: string, title: string, countdownMs?: number) => Promise<void>;
 countdown?: TimerPaneServices["countdown"];
 onCountdownChange?: () => void;
}
const STOP_LABEL = "Stop timer";
const STOPPING_LABEL = "Stopping…";
const UNKNOWN_TOTAL = "—";
interface CardElements {
 relationships: CardRelationshipView;
	timer: TaskCardModel;
	card: HTMLElement;
	/** Drag handle; the only draggable element of the card. */
	handle: HTMLButtonElement;
	title: HTMLElement;
	titleLabel: HTMLElement;
	titleOwner: TaskTitle;
	clock: HTMLElement;
	countdown?: {
		label: HTMLElement;
		input: HTMLInputElement;
		stopwatch: HTMLButtonElement;
		alarm: HTMLButtonElement;
		feedback: HTMLElement;
	};
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
	disclosure?: HTMLButtonElement;
	treeGuides?: HTMLElement;
}


/** Writes text only when it changed, so the polite live region is not re-announced. */
function setTextIfChanged(el: HTMLElement, text: string): void {
	if (el.textContent !== text) el.setText(text);
}



/** Context is plain text; normalize prefixes and omit empty or repeated values. */
function formatContexts(value: unknown): string {
 if (!Array.isArray(value)) return "";
 const contexts = value.filter((item): item is string => typeof item === "string")
  .map(item => item.trim().replace(/^@+/, "").trim()).filter(Boolean);
 return [...new Set(contexts)].map(context => `@${context}`).join(", ");
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
 private toggleGroup?: () => void;
 private guideKey: string | null = null;
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
 setGroup(followingSiblings: readonly boolean[], expanded: boolean | null, toggle: () => void): void {
  const { card, disclosure, treeGuides } = this.elements;
  if (!disclosure || !treeGuides) return;
  // Keep the elbow for this card when deep levels share the last indentation step.
  const guides = followingSiblings.length <= 3 ? followingSiblings : [...followingSiblings.slice(0, 2), followingSiblings[followingSiblings.length - 1]];
  const guideKey = guides.join(",");
  if (this.guideKey !== guideKey) {
   this.guideKey = guideKey;
   card.style.setProperty("--tntp-staged-depth", String(guides.length));
   treeGuides.empty();
   for (const [index, continues] of guides.entries()) {
    const last = index === guides.length - 1;
    if (!last && !continues) continue;
    const guide = treeGuides.createSpan({ cls: ["tntp-tree-guide", last ? (continues ? "tntp-tree-guide--branch" : "tntp-tree-guide--end") : "tntp-tree-guide--line"] });
    guide.style.setProperty("--tntp-guide-column", String(index + 1));
   }
  }
  disclosure.hidden = expanded === null;
  this.toggleGroup = expanded === null ? undefined : toggle;
  if (expanded !== null && disclosure.getAttribute("aria-expanded") !== String(expanded)) {
   disclosure.setAttribute("aria-expanded", String(expanded));
   setIcon(disclosure, expanded ? "chevron-down" : "chevron-right");
  }
 }
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
  card.relationships.update(timer.taskPath);
  this.completionReady = completionReady;
  card.titleOwner.update(timer);
  setTextIfChanged(card.titleLabel, `Open ${timer.title}`);
  card.disclosure?.setAttribute("aria-label", `Staged subtask cards for ${timer.title}`);
  setTextIfChanged(card.metadata, [timer.stagedMetadata, formatContexts(timer.task?.contexts)].filter(Boolean).join(" · "));
  card.card.toggleClass("tntp-card--idle", timer.state === "idle");
  card.card.toggleClass("tntp-card--staged", !!timer.stagedCard);
  card.card.toggleClass("tntp-card--pending", !!timer.pendingCard);
  this.updateCountdown(card);
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
  const elapsed = timerSessionMs(timer, nowMs);
  setTextIfChanged(clock, timer.countdownMs === undefined ? formatHms(elapsed) : formatCountdown(timer.countdownMs - elapsed));
  setTextIfChanged(total, timer.totalKnown ? formatHms(totalMs(timer.entries, nowMs)) : UNKNOWN_TOTAL);
 }
 dispose(): void {
  if (this.disposed) return;
  this.disposed = true;
  this.elements.relationships.dispose();
  this.elements.titleOwner.dispose(); this.elements.card.detach();
  this.unload();
 }
	private buildCard(parent: HTMLElement, key: string, timer: TaskCardModel): CardElements {
		const card = parent.createDiv({ cls: "tntp-card" });
		const treeGuides = timer.stagedCard ? card.createDiv({ attr: { "aria-hidden": "true" } }) : undefined;
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
		const titleRow = timer.stagedCard ? card.createDiv({ cls: "tntp-staged-title-row" }) : card;
		const disclosure = timer.stagedCard ? titleRow.createEl("button", {
			cls: "tntp-group-toggle", attr: { type: "button", "aria-label": "Staged subtask cards" },
		}) : undefined;
		if (disclosure) {
			disclosure.hidden = true;
			disclosure.addEventListener("click", () => { if (!this.disposed) this.toggleGroup?.(); });
		}
		const titleOwner = new TaskTitle(titleRow, timer, { app: this.app, gateway: this.options.gateway });
		const title = titleOwner.title; const titleLabel = titleOwner.titleLabel;
		const metadata = card.createDiv({ cls: ["tntp-label", "tntp-staged-metadata"] });
  const relationships = new CardRelationshipView(card, {
   app: this.app, gateway: this.options.gateway, source: this.options.relationships,
   onSnapshot: this.options.onRelationships,
  });
  relationships.update(timer.taskPath);

		const stats = card.createDiv({ cls: "tntp-timer-stats" });
		const session = stats.createDiv({ cls: ["tntp-stat", "tntp-stat--session"] });
		const clockLabel = session.createSpan({ cls: "tntp-label", text: "Session" });
		const clock = session.createSpan({ cls: "tntp-clock", attr: { role: "timer", "aria-live": "off" } });
		const totalRow = stats.createDiv({ cls: ["tntp-stat", "tntp-stat--total"] });
		totalRow.createSpan({ cls: "tntp-label", text: "Total" });
		const total = totalRow.createSpan({ cls: "tntp-total" });
		const countdownService = this.options.countdown;
		let countdown: CardElements["countdown"];
		if (countdownService) {
			const input = session.createEl("input", {
				cls: "tntp-countdown-input",
				attr: { type: "text", "aria-label": "Countdown duration (mm:ss or hh:mm:ss)", maxlength: "9", spellcheck: "false" },
			});
			const mode = stats.createDiv({ cls: "tntp-timer-mode", attr: { role: "group", "aria-label": "Timer mode" } });
			const stopwatch = mode.createEl("button", { attr: { type: "button" } });
			const alarm = mode.createEl("button", { attr: { type: "button" } });
			setIcon(stopwatch, "timer");
			setIcon(alarm, "alarm-clock");
			setTooltip(stopwatch, "Stopwatch");
			setTooltip(alarm, "Countdown");
			const feedback = card.createDiv({ cls: "tntp-countdown-feedback", attr: { role: "status" } });
			countdown = { label: clockLabel, input, stopwatch, alarm, feedback };
			const choose = (enabled: boolean) => {
				const current = this.elements;
				if (this.disposed || this.isBusy() || current.timer.state !== "idle") return;
				const path = current.timer.taskPath;
				countdownService.setCountdownDraft(path, { ...countdownService.countdownDraft(path), enabled, expired: false });
				input.removeAttribute("aria-invalid");
				this.options.onCountdownChange?.();
				this.updateCountdown(current);
				if (enabled) input.focus();
			};
			stopwatch.addEventListener("click", () => choose(false));
			alarm.addEventListener("click", () => choose(true));
			input.addEventListener("input", () => {
				const path = this.elements.timer.taskPath;
				countdownService.setCountdownDraft(path, { enabled: true, text: input.value });
				input.removeAttribute("aria-invalid");
				this.options.onCountdownChange?.();
			});
		}

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
				const draft = countdownService?.countdownDraft(taskPath);
				const duration = draft?.enabled ? parseCountdown(draft.text) : undefined;
				if (duration === null) {
					countdown?.input.setAttribute("aria-invalid", "true");
					countdown?.input.focus();
					new Notice("Enter a positive countdown duration in mm:ss or hh:mm:ss.");
					return;
				}
				if (model.pendingCard) void this.options.startIdle?.(taskPath, title, duration);
				else void this.options.controller.start({ taskPath, title, ...(duration === undefined ? {} : { countdownMs: duration }) });
			}
			else if (model.state === "paused") void this.options.controller.resume({ taskPath, title });
			else void this.options.controller.pause({ taskPath, startTime: model.startTime, title });
		});
		countdown?.input.addEventListener("keydown", event => {
			if (event.key === "Enter") { event.preventDefault(); pauseResume.click(); }
		});
		const stop = actions.createEl("button", { cls: ["mod-cta", "tntp-stop"] });
		setIcon(stop.createSpan({ cls: "tntp-stop__icon" }), "square");
		const stopLabel = stop.createSpan({ cls: "tntp-stop__label", text: STOP_LABEL });
		stop.addEventListener("click", () => void this.stopTask(key));
		const complete = actions.createEl("button", { cls: "tntp-complete" });
		setIcon(complete.createSpan({ cls: "tntp-complete__icon", attr: { "aria-hidden": "true" } }), "check");
		complete.createSpan({ cls: "tntp-complete__label", text: "Complete" });
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
   relationships,
			timer,
			card,
			handle,
			title,
			titleLabel,
			titleOwner,
			clock,
			countdown,
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
			disclosure,
			treeGuides,
		};
	}

	private updateCountdown(card: CardElements): void {
		const { countdown, timer } = card;
		if (!countdown || !this.options.countdown) return;
		const draft = this.options.countdown.countdownDraft(timer.taskPath);
		const idle = timer.state === "idle";
		const enabled = idle ? draft.enabled : timer.countdownMs !== undefined;
		const locked = !idle || this.isBusy();
		card.card.toggleClass("tntp-card--timer-mode", true);
		card.card.toggleClass("tntp-card--countdown", enabled);
		setTextIfChanged(countdown.label, enabled ? (idle ? "Duration" : "Remaining") : "Session");
		countdown.input.hidden = !(idle && enabled);
		countdown.input.disabled = locked;
		card.clock.hidden = idle;
		if (idle && countdown.input.value !== draft.text) countdown.input.value = draft.text;
		if (idle && enabled) setTextIfChanged(card.total, timer.task ? formatHms(totalMs(parseEntries(timer.task.timeEntries), Date.now())) : UNKNOWN_TOTAL);
		countdown.stopwatch.disabled = countdown.alarm.disabled = locked;
		countdown.stopwatch.setAttribute("aria-pressed", String(!enabled));
		countdown.alarm.setAttribute("aria-pressed", String(enabled));
		countdown.feedback.hidden = !(idle && enabled && draft.expired);
		setTextIfChanged(countdown.feedback, countdown.feedback.hidden ? "" : "Time’s up");
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

