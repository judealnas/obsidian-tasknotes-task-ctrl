/*
 * The sidebar pane. Builds its frame once in onOpen and updates it in place from the
 * bridge state and the store snapshot: one card per timer session (running or
 * paused), reconciled by session key.
 * Visibility of the card list and message area is driven only by the root
 * `tntp-pane--{state}` modifier class (styles.css).
 */
import {
	ItemView,
	setTooltip,
	type WorkspaceLeaf,
} from "obsidian";
import { TaskCard } from "./TaskCard";
import {
	derivePaneState,
	detectWakeGap,
	type OpenTimer,
	type PaneState,
} from "../model/timeMath";
import { moveKey, moveKeyBy, orderTimers } from "../model/cardOrder";
import type { CardOrderStore } from "../state/CardOrderStore";
import type { TimerController } from "../state/TimerController";
import type { TimerStore } from "../state/TimerStore";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import { TaskPickerModal } from "./TaskPickerModal";

export const VIEW_TYPE_TIMER_PANE = "tasknotes-timer-pane";

export interface TimerPaneServices {
	gateway: TaskNotesGateway;
	store: TimerStore;
	cardOrder: CardOrderStore;
	controller: Pick<TimerController, "stop" | "start" | "stopAll" | "complete" | "pause" | "resume" | "stopPaused" | "pauseAll" | "resumeAll" | "completionAvailable" | "isBusy" | "subscribeBusy">;
}

const PANE_STATES: readonly PaneState[] = ["running", "idle", "loading", "missing", "incompatible"];

interface PaneElements {
	root: HTMLElement;
	start: HTMLButtonElement;
	pauseAll: HTMLButtonElement;
	resumeAll: HTMLButtonElement;
	stopAll: HTMLButtonElement;
	pomodoroNote: HTMLElement;
	cards: HTMLElement;
	heading: HTMLElement;
	body: HTMLElement;
	meta: HTMLElement;
}

function setTextIfChanged(el: HTMLElement, text: string): void {
 if (el.textContent !== text) el.setText(text);
}

export class TimerPaneView extends ItemView {
	private readonly services: TimerPaneServices;
	private els: PaneElements | null = null;
	/** Cards by timer key, in display order. */
	private cards = new Map<string, TaskCard>();
	/** Wall-clock time of the previous tick, for sleep/wake gap detection. */
	private lastTickMs: number | null = null;
	/** Whether the content was visible on the previous tick, for reveal detection. */
	private wasShown = false;
	/** Keys of timers from a Stop click until that stop settles; render() keeps their busy label. */
	private picker: TaskPickerModal | null = null;
	private completionReady = false;
	private completionGeneration = 0;
	private closed = true;
	/** Key of the card being dragged by its handle; null unless our own drag is active. */
	private dragKey: string | null = null;

	constructor(leaf: WorkspaceLeaf, services: TimerPaneServices) {
		super(leaf);
		this.services = services;
	}

	getViewType(): string {
		return VIEW_TYPE_TIMER_PANE;
	}

	getDisplayText(): string {
		return "TaskNotes timer";
	}

	getIcon(): string {
		return "timer";
	}

	onOpen(): Promise<void> {
		this.closed = false;
		const { gateway, store } = this.services;
		this.contentEl.empty();
		this.lastTickMs = null;
		this.wasShown = false;
		this.cards = new Map();
		this.dragKey = null;
		const root = this.contentEl.createDiv({ cls: ["tntp-pane", "tntp-pane--loading"] });
		const header = root.createDiv({ cls: "tntp-header" });
		// D-02: Start task, Pause all, Resume all, Stop all; text labels in a wrapping row.
		const start = header.createEl("button", { text: "Start task", cls: "tntp-start" });
		const pauseAll = header.createEl("button", { text: "Pause all", cls: "tntp-pause-all" });
		const resumeAll = header.createEl("button", { text: "Resume all", cls: "tntp-resume-all" });
		const stopAll = header.createEl("button", { text: "Stop all", cls: "tntp-stop-all" });
		this.registerDomEvent(start, "click", () => void this.openPicker());
		this.registerDomEvent(pauseAll, "click", () => {
			if (!this.services.controller.isBusy() && !pauseAll.disabled) void this.services.controller.pauseAll();
		});
		this.registerDomEvent(resumeAll, "click", () => {
			if (!this.services.controller.isBusy() && !resumeAll.disabled) void this.services.controller.resumeAll();
		});
		this.registerDomEvent(stopAll, "click", () => {
			if (!this.services.controller.isBusy() && !stopAll.disabled) void this.services.controller.stopAll();
		});
		// D-15: shown only while TaskNotes is ready but Pomodoro ownership cannot be read.
		const pomodoroNote = root.createDiv({ cls: ["tntp-label", "tntp-pomodoro-note"], text: "Can't check Pomodoro. Showing all timers." });
		const cards = root.createDiv({ cls: "tntp-cards" });

		const message = root.createDiv({ cls: "tntp-message", attr: { "aria-live": "polite" } });
		const heading = message.createDiv({ cls: "tntp-message__heading" });
		const body = message.createDiv({ cls: "tntp-message__body" });
		const meta = message.createDiv({ cls: ["tntp-label", "tntp-message__meta"] });
		const retry = message.createEl("button", { cls: "tntp-message__retry", text: "Check for TaskNotes" });
		this.registerDomEvent(retry, "click", () => gateway.probe());

		this.els = { root, start, pauseAll, resumeAll, stopAll, pomodoroNote, cards, heading, body, meta };

		this.register(store.subscribe(() => { this.render(); void this.refreshCompletion(); }));
		this.register(gateway.onState(() => { this.render(); void this.refreshCompletion(); }));
		this.register(this.services.controller.subscribeBusy(() => this.render()));
		// Keeps two open panes in the same order.
		this.register(this.services.cardOrder.subscribe(() => this.render()));
		this.registerInterval(window.setInterval(() => this.tick(), 1000));
		// The pane's own document and window, so this also works in a pop-out window.
		// Electron may suspend timers in the background or during OS sleep: tick at once
		// from the wall clock and re-read TaskNotes when the pane can be seen again.
		this.registerDomEvent(this.containerEl.doc, "visibilitychange", () => {
			if (this.containerEl.doc.visibilityState !== "visible") return;
			this.tick();
			store.requestRefresh();
		});
		this.registerDomEvent(this.containerEl.win, "focus", () => {
			this.tick();
			store.requestRefresh();
		});
		gateway.probe();
		this.render();
		void this.refreshCompletion();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.closed = true;
		this.completionGeneration++;
		this.completionReady = false;
		this.picker?.close();
		this.picker = null;
		this.dragKey = null;
		for (const card of this.cards.values()) card.dispose();
		this.els = null;
		this.cards = new Map();
		return Promise.resolve();
	}

	private openPicker(): void {
  const { gateway, controller } = this.services;
  if (this.picker || controller.isBusy() || !gateway.startAvailability().available) return;
  const modal = new TaskPickerModal(this.app, gateway, controller, () => {
   if (this.picker === modal) this.picker = null;
  });
  this.picker = modal;
  modal.open();
 }

	/** Every open timer in display order (the saved order, new timers on top); none unless running. */
	private currentTimers(): { state: PaneState; timers: OpenTimer[] } {
		const snapshot = this.services.store.getSnapshot();
		const state = derivePaneState(this.services.gateway.getState(), snapshot);
		if (state !== "running" || !snapshot?.primary) return { state, timers: [] };
		return { state, timers: orderTimers([snapshot.primary, ...snapshot.others], this.services.cardOrder.get()) };
	}

	/** Commits a new display order; the store subscription re-renders every pane. */
	private commitOrder(order: string[]): void {
		this.services.cardOrder.set(order);
	}

	private clearDropMarks(): void {
		for (const { card } of this.cards.values()) {
			card.removeClass("tntp-card--drop-before");
			card.removeClass("tntp-card--drop-after");
		}
	}

	private clearDragMarks(): void {
		this.clearDropMarks();
		for (const { card } of this.cards.values()) card.removeClass("tntp-card--dragging");
	}

	/** Handle events: keyboard reorder and the HTML5 drag source. */
	private wireHandle(card: HTMLElement, handle: HTMLButtonElement, key: string): void {
		handle.addEventListener("keydown", (evt) => {
			if (evt.key !== "ArrowUp" && evt.key !== "ArrowDown") return;
			evt.preventDefault();
			this.commitOrder(moveKeyBy([...this.cards.keys()], key, evt.key === "ArrowUp" ? -1 : 1));
			if (handle.ownerDocument.activeElement !== handle) handle.focus();
		});
		handle.addEventListener("dragstart", (evt) => {
			this.dragKey = key;
			const transfer = evt.dataTransfer;
			if (transfer) {
				transfer.effectAllowed = "move";
				transfer.setData("application/x-tntp-card", key);
				transfer.setDragImage(card, 0, 0);
			}
			card.addClass("tntp-card--dragging");
		});
		handle.addEventListener("dragend", () => {
			this.dragKey = null;
			this.clearDragMarks();
		});
		// Only our own handle's drag is acted on; foreign drags are left alone.
		card.addEventListener("dragover", (evt) => {
			if (this.dragKey === null || this.dragKey === key) return;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
			const rect = card.getBoundingClientRect();
			const after = evt.clientY > rect.top + rect.height / 2;
			this.clearDropMarks();
			card.toggleClass("tntp-card--drop-before", !after);
			card.toggleClass("tntp-card--drop-after", after);
		});
		card.addEventListener("drop", (evt) => {
			const dragKey = this.dragKey;
			if (dragKey === null || dragKey === key) return;
			evt.preventDefault();
			const rect = card.getBoundingClientRect();
			const after = evt.clientY > rect.top + rect.height / 2;
			this.dragKey = null;
			this.clearDragMarks();
			this.commitOrder(moveKey([...this.cards.keys()], dragKey, key, after));
		});
	}


	private render(): void {
		const els = this.els;
		if (!els) return;
		const { state, timers } = this.currentTimers();
		const gate = this.services.gateway.startAvailability();
		els.start.disabled = !gate.available || this.services.controller.isBusy();
		setTooltip(els.start, gate.reason);
		const header = this.services.store.getHeaderState();
		const busy = this.services.controller.isBusy();
		const busyTip = "A timer action is in progress";
		els.pauseAll.disabled = busy || !header.readable || header.eligibleCount === 0;
		setTooltip(els.pauseAll, busy ? busyTip : !header.readable ? "Cannot verify Pomodoro ownership" : header.eligibleCount === 0 ? "No running timers to pause" : "Pause all running timers");
		els.resumeAll.disabled = busy || header.pausedCount === 0;
		setTooltip(els.resumeAll, busy ? busyTip : header.pausedCount === 0 ? "No paused timers to resume" : "Resume all paused timers");
		const nothingToStop = header.eligibleCount === 0 && header.pausedCount === 0;
		els.stopAll.disabled = busy || !header.readable || nothingToStop;
		setTooltip(els.stopAll, busy ? "A timer action is in progress" : !header.readable ? "Cannot verify Pomodoro ownership" : nothingToStop ? "No timers to stop" : "Stop all timers and clear paused ones");
		for (const candidate of PANE_STATES) els.root.toggleClass(`tntp-pane--${candidate}`, candidate === state);
		els.root.toggleClass("tntp-pane--pomodoro-unknown", this.services.gateway.getState().kind === "ready" && !header.readable);
		this.reconcileCards(els, timers);
		if (timers.length > 0) {
			this.writeTimes(Date.now());
			return;
		}
		this.renderMessage(els, state);
	}

	private async refreshCompletion(): Promise<void> {
		const generation = ++this.completionGeneration;
		this.completionReady = false;
		this.render();
		const ready = await this.services.controller.completionAvailable();
		if (this.closed || generation !== this.completionGeneration) return;
		this.completionReady = ready;
		this.render();
	}

	/**
	 * Keeps exactly one card per session, in display order, reusing existing cards. The
	 * key is the session (path plus first start), so pause and resume keep the card.
	 */
	private reconcileCards(els: PaneElements, timers: readonly OpenTimer[]): void {
  const next = new Map<string, TaskCard>();
  for (const timer of timers) {
   const key = timer.sessionKey;
   if (next.has(key)) continue;
   let card = this.cards.get(key);
   if (!card) {
    card = new TaskCard(els.cards, timer, { app: this.app, gateway: this.services.gateway, controller: this.services.controller });
    this.wireHandle(card.card, card.handle, key);
   }
   next.set(key, card);
   card.update(timer, this.completionReady);
  }
  for (const [key, card] of this.cards) if (!next.has(key)) card.dispose();
  let i = 0;
  for (const card of next.values()) {
   if (els.cards.children[i] !== card.card) els.cards.insertBefore(card.card, els.cards.children[i] ?? null);
   i++;
  }
  this.cards = next;
 }

	private renderMessage(els: PaneElements, state: PaneState): void {
		let heading = "";
		let body = "";
		let meta = "";
		switch (state) {
			case "idle":
				heading = "No task is being timed";
				body = "Choose Start task above to start a timer.";
				break;
			case "loading":
				body = "Connecting to TaskNotes…";
				break;
			case "missing":
				heading = "TaskNotes is not enabled";
				body =
					"This pane needs the TaskNotes plugin. Install or enable it in Settings → Community plugins, and the pane will connect on its own.";
				break;
			case "incompatible": {
				heading = "TaskNotes needs an update";
				body =
					"This pane needs TaskNotes 4.10 or later. Update it in Settings → Community plugins, and the pane will connect on its own.";
				const bridge = this.services.gateway.getState();
				const version = bridge.kind === "incompatible" ? bridge.version : null;
				if (version) meta = `Installed version: ${version}`;
				break;
			}
			case "running":
				break;
		}
		setTextIfChanged(els.heading, heading);
		setTextIfChanged(els.body, body);
		setTextIfChanged(els.meta, meta);
	}

	private writeTimes(nowMs: number): void {
  for (const card of this.cards.values()) card.writeTimes(nowMs);
 }

	/**
	 * Wall-clock tick: every duration is recomputed from startTime and Date.now(), never
	 * counted, so the first tick after sleep is already right. It never calls TaskNotes;
	 * after a wake gap or a reveal it asks the store for a (debounced) refresh.
	 */
	private tick(): void {
		const now = Date.now();
		const { store } = this.services;
		// A wake or throttle gap: data may have changed while timers were suspended.
		if (detectWakeGap(this.lastTickMs, now)) store.requestRefresh();
		this.lastTickMs = now;
		const shown = this.contentEl.isShown();
		// Revealed (sidebar tab switched back, pane expanded): re-read TaskNotes.
		if (shown && !this.wasShown) store.requestRefresh();
		this.wasShown = shown;
		// Hidden: no DOM writes.
		if (!shown) return;
		this.writeTimes(now);
	}
}
