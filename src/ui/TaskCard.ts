import { Component, Keymap, MarkdownRenderer, setIcon, setTooltip, type App, type PaneType } from "obsidian";
import { taskLinkpath, taskWikilink } from "../model/taskLink";
import { formatHms, timerSessionMs, totalMs, type OpenTimer } from "../model/timeMath";
import type { TimerPaneServices } from "./TimerPaneView";

export interface IdleStagedCard {
	state: "idle";
	taskPath: string;
	title: string;
	displayKey: string;
}
export type TaskCardModel = (OpenTimer | IdleStagedCard) & { stagedMetadata?: string; stagedCard?: boolean; stagedMarker?: boolean };
function cardKey(model: TaskCardModel): string { return model.state === "idle" ? model.taskPath : model.sessionKey; }

export interface TaskCardOptions {
 app: App;
 gateway: TimerPaneServices["gateway"];
 controller: TimerPaneServices["controller"];
 isBusy?: () => boolean;
 unstage?: (target: { taskPath: string; title: string }) => Promise<unknown>;
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
	/** Inputs of the last title update (see titleRenderKey). */
	titleKey: string | null;
	/** Title render generation: a render that finishes with an older value is discarded. */
	titleSeq: number;
	/** "text": plain title text; "markdown": the rendered wikilink (TaskNotes' chip or a plain link). */
	titleMode: "text" | "markdown";
	/** The pane's own plain link inside the rendered output; null when none was found. */
	titleLink: HTMLAnchorElement | null;
	/** Owns the current title render; unloaded on re-render, card removal and pane close. */
	titleComponent: Component | null;
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


/**
 * The inputs a card title is rendered from; a new value triggers a re-render. The
 * display key matters because TaskNotes never refreshes a chip outside markdown
 * leaves: a status or priority change must re-render it here.
 */
function titleRenderKey(timer: TaskCardModel): string {
	return [timer.taskPath, timer.title, timer.displayKey].join("\u0000");
}

/** Writes text only when it changed, so the polite live region is not re-announced. */
function setTextIfChanged(el: HTMLElement, text: string): void {
	if (el.textContent !== text) el.setText(text);
}

/** Unique per card: several panes and cards may be open at once. */
let titleLabelSeq = 0;


/** Owns a single timer's DOM, actions and all pending/current title renderers. No interval. */
export class TaskCard extends Component {
 private elements: CardElements;
 private disposed = false;
 private completionReady = false;
 private stopping = new Set<string>();
 private titleOwners = new Set<Component>();
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
 update(timer: TaskCardModel, completionReady: boolean): void {
  if (this.disposed) return;
  const card = this.elements;
  card.timer = timer;
  this.completionReady = completionReady;
  this.updateTitle(cardKey(timer), card);
  setTextIfChanged(card.titleLabel, `Open ${timer.title}`);
  setTextIfChanged(card.metadata, timer.stagedMetadata ?? (timer.stagedMarker ? "Staged" : ""));
  card.card.toggleClass("tntp-card--idle", timer.state === "idle");
  card.card.toggleClass("tntp-card--staged", !!timer.stagedCard);
  this.updatePauseResume(card);
  const busy = this.isBusy();
  card.unstage.disabled = busy || !this.options.unstage;
  card.complete.disabled = busy || !completionReady || !!timer.stagedCard || timer.state === "idle";
  setTooltip(card.complete, timer.stagedCard ? "Staged task completion will be available in a later update" : busy ? "A timer action is in progress" : completionReady ? "Complete this task and stop its timer" : "No completed status is available from TaskNotes");
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
  this.discardCard(this.elements);
  for (const owner of this.titleOwners) this.releaseTitle(owner);
  this.unload();
 }
 private releaseTitle(component: Component): void {
  if (this.titleOwners.delete(component)) this.removeChild(component);
 }
	private buildCard(parent: HTMLElement, key: string, timer: TaskCardModel): CardElements {
		const card = parent.createDiv({ cls: "tntp-card" });
		const handle = card.createEl("button", { cls: "tntp-handle", attr: { "aria-label": "Reorder card", draggable: "true" } });
		setIcon(handle, "grip-vertical");
		setTooltip(handle, "Drag to reorder, or use Up and Down arrow keys");
		// The tooltip owns aria-label ("Open task note"); the accessible name
		// "Open {title}" comes from a visually hidden label via aria-labelledby.
		const titleLabelId = `tntp-title-label-${++titleLabelSeq}`;
		const title = card.createDiv({
			cls: "tntp-title",
			attr: { role: "link", tabindex: "0", "aria-labelledby": titleLabelId },
		});
		setTooltip(title, "Open task note");
		const titleLabel = card.createSpan({ cls: "tntp-visually-hidden", attr: { id: titleLabelId } });
		const metadata = card.createDiv({ cls: ["tntp-label", "tntp-staged-metadata"] });
		title.addEventListener("click", (evt) => this.onTitleClick(key, evt));
		title.addEventListener("auxclick", (evt) => this.onTitleAuxClick(key, evt));
		title.addEventListener("keydown", (evt) => {
			if (evt.key !== "Enter" && evt.key !== " ") return;
			evt.preventDefault();
			this.openTask(key, false);
		});
		title.addEventListener("contextmenu", (evt) => this.openTaskMenu(key, evt));

		const session = card.createDiv({ cls: ["tntp-stat", "tntp-stat--session"] });
		session.createSpan({ cls: "tntp-label", text: "Session" });
		const clock = session.createSpan({ cls: "tntp-clock", attr: { role: "timer", "aria-live": "off" } });
		session.createSpan({ cls: ["tntp-label", "tntp-card__paused"], text: "Paused" });
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
			if (model.state === "idle") void this.options.controller.start({ taskPath, title });
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
			if (!current || complete.disabled || this.isBusy() || current.timer.state === "idle" || current.timer.stagedCard) return;
			const { taskPath, startTime, title } = current.timer;
			void this.options.controller.complete({ taskPath, startTime, title });
		});
		const unstage = card.createEl("button", { cls: "tntp-unstage", text: "✕" });
		setTooltip(unstage, "Unstage task");
		unstage.addEventListener("click", () => {
			if (this.disposed || unstage.disabled || this.isBusy() || !this.elements.timer.stagedCard) return;
			const { taskPath, title } = this.elements.timer;
			void this.options.unstage?.({ taskPath, title });
		});

		return {
			timer,
			card,
			handle,
			title,
			titleLabel,
			titleKey: null,
			titleSeq: 0,
			titleMode: "text",
			titleLink: null,
			titleComponent: null,
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
	 * Brings a card's title up to date. Synchronous: a text title updates at once, and a
	 * card already showing a chip or link keeps it until the new render is ready.
	 */
	private updateTitle(key: string, card: CardElements): void {
		const next = titleRenderKey(card.timer);
		if (next === card.titleKey) return;
		card.titleKey = next;
		const seq = ++card.titleSeq;
		for (const owner of this.titleOwners) if (owner !== card.titleComponent) this.releaseTitle(owner);
		// A new card is never blank, and a text-mode rename shows immediately.
		if (card.titleMode === "text") this.showTitleText(card);
		const markdown = taskWikilink(card.timer.taskPath);
		const linkpath = taskLinkpath(card.timer.taskPath);
		if (markdown === null || linkpath === null) {
			this.showTitleText(card);
			return;
		}
		void this.renderTitleLink(key, card, seq, markdown, linkpath);
	}

	/**
	 * Renders "[[linkpath]]" through Obsidian's renderer so TaskNotes' post-processor can
	 * turn it into its chip (when TaskNotes' overlay setting is on). The task title never
	 * passes through the Markdown parser.
	 */
	private async renderTitleLink(
		key: string,
		card: CardElements,
		seq: number,
		markdown: string,
		linkpath: string,
	): Promise<void> {
		const component = this.addChild(new Component());
		this.titleOwners.add(component);
		const wrapper = createDiv({ cls: "tntp-title__md" });
		const isCurrent = () => (this.disposed ? undefined : this.elements) === card && card.titleSeq === seq;
		try {
			await MarkdownRenderer.render(this.app, markdown, wrapper, "", component);
		} catch (error) {
			console.error(
				"[tasknotes-timer-pane] Rendering the task link failed: " +
					(error instanceof Error ? error.message : String(error)),
			);
			this.releaseTitle(component);
			if (isCurrent()) this.showTitleText(card);
			return;
		}
		// The card was removed or re-rendered meanwhile: this render lost the race.
		if (!isCurrent()) {
			this.releaseTitle(component);
			return;
		}
		let link: HTMLAnchorElement | null = null;
		for (const candidate of Array.from(wrapper.querySelectorAll<HTMLAnchorElement>("a.internal-link"))) {
			if (candidate.getAttribute("data-href") === linkpath) {
				link = candidate;
				break;
			}
		}
		if (link) {
			// The plain link shows the pane's title, not the path. The container stays the
			// single tab stop, and dragging the title does not drop an app:// URL.
			link.setText(card.timer.title);
			link.setAttribute("tabindex", "-1");
			link.setAttribute("draggable", "false");
		} else if (wrapper.childElementCount === 0) {
			this.releaseTitle(component);
			this.showTitleText(card);
			return;
		}
		card.title.empty();
		card.title.appendChild(wrapper);
		if (card.titleComponent) this.releaseTitle(card.titleComponent);
		card.titleComponent = component;
		card.titleLink = link;
		card.titleMode = "markdown";
		this.applyTitleOwnership(card);
	}

	/** Plain title text (textContent only), releasing any rendered link. */
	private showTitleText(card: CardElements): void {
		if (card.titleComponent) {
			this.releaseTitle(card.titleComponent);
			card.titleComponent = null;
		}
		card.titleLink = null;
		card.titleMode = "text";
		card.title.setText(card.timer.title);
		this.applyTitleOwnership(card);
	}

	/**
	 * True when clicks on the title are the pane's to handle: plain text, or the pane's
	 * own link is still in place. Evaluated at event time, so a chip that replaced the
	 * link at any moment is respected.
	 */
	private paneOwnsTitle(card: CardElements): boolean {
		return card.titleMode === "text" || (card.titleLink !== null && card.title.contains(card.titleLink));
	}

	/**
	 * Over a chip the "Open task note" tooltip would mislead, since a chip click runs
	 * TaskNotes' single-click action. The accessible name still comes from aria-labelledby.
	 */
	private applyTitleOwnership(card: CardElements): void {
		const owned = this.paneOwnsTitle(card);
		card.title.toggleClass("tntp-title--chip", !owned);
		if (owned) setTooltip(card.title, "Open task note");
		else card.title.removeAttribute("aria-label");
	}

	/** A click TaskNotes' chip handled (or one bubbling from its dots) never also opens the note. */
	private onTitleClick(key: string, evt: MouseEvent): void {
		const card = (this.disposed ? undefined : this.elements);
		if (!card || evt.defaultPrevented || !this.paneOwnsTitle(card)) return;
		// Stops the anchor's own navigation.
		evt.preventDefault();
		this.openTask(key, Keymap.isModEvent(evt));
	}

	/** Middle click opens a new tab, like a link in a note. */
	private onTitleAuxClick(key: string, evt: MouseEvent): void {
		if (evt.button !== 1) return;
		const card = (this.disposed ? undefined : this.elements);
		if (!card || evt.defaultPrevented || !this.paneOwnsTitle(card)) return;
		evt.preventDefault();
		this.openTask(key, Keymap.isModEvent(evt));
	}

	/** Detaches a card, invalidating an in-flight title render and unloading its Component. */
	private discardCard(card: CardElements): void {
		card.titleSeq++;
		if (card.titleComponent) {
			this.releaseTitle(card.titleComponent);
			card.titleComponent = null;
		}
		card.card.detach();
	}

	/** Opens a card's task note; a modifier click opens it in a new tab (DISP-01). */
	private openTask(key: string, newLeaf: PaneType | boolean): void {
		const card = (this.disposed ? undefined : this.elements);
		if (!card) return;
		this.app.workspace.openLinkText(card.timer.taskPath, "", newLeaf).catch((error: unknown) => {
			console.error(
				"[tasknotes-timer-pane] Opening the task note failed: " +
					(error instanceof Error ? error.message : String(error)),
			);
		});
	}

	/**
	 * Right-click on a title: TaskNotes' native task menu. A chip TaskNotes rendered
	 * prevents the default itself, so an already-handled event is left alone (no
	 * TaskNotes class names involved). The target is read from the card at event time.
	 */
	private openTaskMenu(key: string, evt: MouseEvent): void {
		if (evt.defaultPrevented) return;
		const card = (this.disposed ? undefined : this.elements);
		if (!card) return;
		if (this.options.gateway.showTaskMenu(card.timer.taskPath, evt)) evt.preventDefault();
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
		card.pauseResume.disabled = busy;
		setTooltip(card.pauseResume, busy ? "A timer action is in progress" : idle ? "Start this task" : paused ? "Resume this timer" : "Pause this timer");
	}


}

