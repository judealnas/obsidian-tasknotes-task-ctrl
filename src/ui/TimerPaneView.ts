/*
 * The sidebar pane. Builds its frame once in onOpen and updates it in place from the
 * bridge state and the store snapshot: one card per timer session (running or
 * paused), reconciled by session key.
	 * Each tab panel owns its content visibility; bridge subscriptions stay shared.
 */
import {
	ItemView,
	setTooltip,
	type WorkspaceLeaf,
	type ViewStateResult,
} from "obsidian";
import { TaskCard, type TaskCardModel } from "./TaskCard";
import type { StagingStore } from "../state/StagingStore";
import type { StagingController } from "../state/StagingController";
import { displayTitle, taskDisplayKey } from "../model/timeMath";
import { normalizeTimerPath } from "../model/pomodoroOwnership";
import { orderStaged } from "../model/staging";
import type { StagedOrderStore } from "../state/StagedOrderStore";
import { CardList } from "./CardList";
import {
	derivePaneState,
	detectWakeGap,
	type OpenTimer,
	type PaneState,
} from "../model/timeMath";
import { orderTimers } from "../model/cardOrder";
import type { CardOrderStore } from "../state/CardOrderStore";
import type { TimerController } from "../state/TimerController";
import type { TimerStore } from "../state/TimerStore";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import { TaskPickerModal } from "./TaskPickerModal";
import type { CompletionController } from "../state/CompletionController";
import type { CompletionStore } from "../state/CompletionStore";
import { TaskTitle } from "./TaskTitle";
import { stagingDay } from "../model/stagingDay";

export const VIEW_TYPE_TIMER_PANE = "tasknotes-timer-pane";

export interface TimerPaneServices {
 completions?: CompletionStore;
 completion?: CompletionController;
	gateway: TaskNotesGateway;
	store: TimerStore;
	cardOrder: CardOrderStore;
	controller: Pick<TimerController, "stop" | "start" | "stopAll" | "complete" | "pause" | "resume" | "stopPaused" | "pauseAll" | "resumeAll" | "completionAvailable" | "isBusy" | "subscribeBusy">;
	staging?: StagingStore;
	stagingController?: StagingController;
	stagedOrder?: StagedOrderStore;
}

const PANE_STATES: readonly PaneState[] = ["running", "idle", "loading", "missing", "incompatible"];
export type PaneTab = "staged" | "timers";
let nextPaneId = 0;

interface TabElements {
	button: HTMLButtonElement;
	count: HTMLElement;
	panel: HTMLElement;
	heading: HTMLElement;
	body: HTMLElement;
	meta: HTMLElement;
	stage?: HTMLButtonElement;
	retry?: HTMLButtonElement;
}

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
	tabs: Record<PaneTab, TabElements>;
}

function setTextIfChanged(el: HTMLElement, text: string): void {
 if (el.textContent !== text) el.setText(text);
}

export class TimerPaneView extends ItemView {
	private readonly services: TimerPaneServices;
	private els: PaneElements | null = null;
	/** Cards by timer key, in display order. */
	private cards: CardList<OpenTimer, TaskCard> | null = null;
	private stagedCards: CardList<TaskCardModel, TaskCard> | null = null;
	private tab: PaneTab = "timers";
	private readonly paneId = `tntp-pane-${++nextPaneId}`;
	/** Wall-clock time of the previous tick, for sleep/wake gap detection. */
	private lastTickMs: number | null = null;
	/** Whether the content was visible on the previous tick, for reveal detection. */
	private wasShown = false;
	private picker: TaskPickerModal | null = null;
	private completionReady = false;
	private completionGeneration = 0;
	private closed = true;
	private doneRows = new Map<string, { row: HTMLElement; title: TaskTitle }>();
	private doneList: HTMLElement | null = null;
	private doneEmpty: HTMLElement | null = null;

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

	override getState(): Record<string, unknown> {
		return { ...super.getState(), tab: this.tab };
	}

	override async setState(state: unknown, result: ViewStateResult): Promise<void> {
		this.tab = state !== null && typeof state === "object" && !Array.isArray(state) &&
			"tab" in state && (state.tab === "staged" || state.tab === "timers") ? state.tab : "timers";
		this.updateTabs();
		await super.setState(state, result);
	}

	onOpen(): Promise<void> {
		this.closed = false;
		const { gateway, store } = this.services;
		this.contentEl.empty();
		this.lastTickMs = null;
		this.wasShown = false;
		this.cards?.dispose();
		this.stagedCards?.dispose();
		this.cards = null;
		const root = this.contentEl.createDiv({ cls: ["tntp-pane", "tntp-pane--loading"] });
		const strip = root.createDiv({ cls: "tntp-tabs", attr: { role: "tablist", "aria-label": "Task views" } });
		const stagedButton = strip.createEl("button", { text: "Staged", cls: "tntp-tabs__tab" });
		const timersButton = strip.createEl("button", { text: "Timers", cls: "tntp-tabs__tab" });
		const stagedCount = stagedButton.createSpan({ cls: "tntp-tabs__count", text: " 0" });
		const timersCount = timersButton.createSpan({ cls: "tntp-tabs__count", text: " 0" });
		const stagedPanel = root.createDiv({ cls: ["tntp-panel", "tntp-panel--staged"] });
		const timersPanel = root.createDiv({ cls: ["tntp-panel", "tntp-panel--timers"] });
		const stage = stagedPanel.createDiv({ cls: "tntp-header" }).createEl("button", { text: "Stage", cls: "tntp-stage" });
		stage.disabled = true;
		setTooltip(stage, "Staging isn't available yet");
		this.registerDomEvent(stage, "click", () => this.openStagePicker());
		const stagedList = stagedPanel.createDiv({ cls: "tntp-cards" });
		this.stagedCards = new CardList(stagedList, {
			key: timer => timer.taskPath,
			create: (parent, timer) => new TaskCard(parent, timer, { app: this.app, gateway, controller: this.services.controller, completion: this.services.completion, isBusy: () => this.isBusy(), unstage: this.services.stagingController ? target => this.services.stagingController!.unstage(target) : undefined }),
			update: (card, timer) => card.update(timer, false),
			dispose: card => card.dispose(),
			commitOrder: order => this.services.stagedOrder?.reorder(order),
		});
		const stagedMessage = stagedPanel.createDiv({ cls: "tntp-message", attr: { "aria-live": "polite" } });
		const stagedHeading = stagedMessage.createDiv({ cls: "tntp-message__heading" });
		const stagedBody = stagedMessage.createDiv({ cls: "tntp-message__body" });
		const stagedMeta = stagedMessage.createDiv({ cls: "tntp-message__meta" });
		const stagedRetry = stagedMessage.createEl("button", { cls: "tntp-message__retry", text: "Check for TaskNotes" });
		const done = stagedPanel.createEl("section", { cls: "tntp-done-today", attr: { "aria-label": "Done today" } });
		done.createEl("h3", { text: "Done today" });
		this.doneEmpty = done.createDiv({ cls: "tntp-done-today__empty", text: "Nothing completed yet" });
		this.doneList = done.createDiv({ cls: "tntp-done-today__list" });
		this.registerDomEvent(stagedRetry, "click", () => { gateway.probe(); void this.services.staging?.refreshNow(); });
		this.registerDomEvent(stagedButton, "click", () => this.selectTab("staged"));
		this.registerDomEvent(timersButton, "click", () => this.selectTab("timers"));
		const header = timersPanel.createDiv({ cls: "tntp-header" });
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
		const pomodoroNote = timersPanel.createDiv({ cls: ["tntp-label", "tntp-pomodoro-note"], text: "Can't check Pomodoro. Showing all timers." });
		const cards = timersPanel.createDiv({ cls: "tntp-cards" });
		this.cards = new CardList(cards, {
			key: timer => timer.sessionKey,
			create: (parent, timer) => new TaskCard(parent, timer, { app: this.app, gateway, controller: this.services.controller, completion: this.services.completion, isBusy: () => this.isBusy() }),
			update: (card, timer) => card.update(timer, this.completionReady),
			dispose: card => card.dispose(),
			commitOrder: order => this.services.cardOrder.set(order),
		});

		const message = timersPanel.createDiv({ cls: "tntp-message", attr: { "aria-live": "polite" } });
		const heading = message.createDiv({ cls: "tntp-message__heading" });
		const body = message.createDiv({ cls: "tntp-message__body" });
		const meta = message.createDiv({ cls: ["tntp-label", "tntp-message__meta"] });
		const retry = message.createEl("button", { cls: "tntp-message__retry", text: "Check for TaskNotes" });
		this.registerDomEvent(retry, "click", () => gateway.probe());

		this.els = { root, start, pauseAll, resumeAll, stopAll, pomodoroNote, cards, heading, body, meta, tabs: {
			staged: { button: stagedButton, count: stagedCount, panel: stagedPanel, heading: stagedHeading, body: stagedBody, meta: stagedMeta, stage, retry: stagedRetry },
			timers: { button: timersButton, count: timersCount, panel: timersPanel, heading, body, meta },
		} };
		for (const tab of ["staged", "timers"] as const) {
			const { button, panel } = this.els.tabs[tab];
			const tabId = `${this.paneId}-${tab}-tab`;
			const panelId = `${this.paneId}-${tab}-panel`;
			button.setAttribute("id", tabId);
			button.setAttribute("role", "tab");
			button.setAttribute("aria-controls", panelId);
			panel.setAttribute("id", panelId);
			panel.setAttribute("role", "tabpanel");
			panel.setAttribute("aria-labelledby", tabId);
			this.registerDomEvent(button, "keydown", event => this.tabKeydown(event));
		}
		this.updateTabs();

		this.register(store.subscribe(() => { this.render(); void this.refreshCompletion(); }));
		if (this.services.staging) this.register(this.services.staging.subscribe(() => this.render()));
		if (this.services.completions) this.register(this.services.completions.subscribe(() => this.render()));
		if (this.services.stagingController) this.register(this.services.stagingController.subscribeBusy(() => this.render()));
		this.register(gateway.onState(() => { this.render(); void this.refreshCompletion(); }));
		this.register(this.services.controller.subscribeBusy(() => this.render()));
		// Keeps two open panes in the same order.
		this.register(this.services.cardOrder.subscribe(() => this.render()));
		if (this.services.stagedOrder) this.register(this.services.stagedOrder.subscribe(() => this.render()));
		this.registerInterval(window.setInterval(() => this.tick(), 1000));
		// The pane's own document and window, so this also works in a pop-out window.
		// Electron may suspend timers in the background or during OS sleep: tick at once
		// from the wall clock and re-read TaskNotes when the pane can be seen again.
		this.registerDomEvent(this.containerEl.doc, "visibilitychange", () => {
			if (this.containerEl.doc.visibilityState !== "visible") return;
			this.tick();
			store.requestRefresh();
			this.services.staging?.requestRefresh();
		});
		this.registerDomEvent(this.containerEl.win, "focus", () => {
			this.tick();
			store.requestRefresh();
			this.services.staging?.requestRefresh();
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
		this.cards?.dispose();
		this.stagedCards?.dispose();
		for (const { title, row } of this.doneRows.values()) { title.dispose(); row.detach(); }
		this.doneRows.clear(); this.doneList = null; this.doneEmpty = null;
		this.stagedCards = null;
		this.els = null;
		this.cards = null;
		return Promise.resolve();
	}

	private selectTab(tab: PaneTab): void {
		const changed = this.tab !== tab;
		this.tab = tab;
		this.updateTabs();
		if (changed) this.app.workspace.requestSaveLayout();
	}

	private tabKeydown(event: KeyboardEvent): void {
		if (!this.els) return;
		let next: PaneTab;
		switch (event.key) {
			case "ArrowLeft":
			case "ArrowRight": next = this.tab === "staged" ? "timers" : "staged"; break;
			case "Home": next = "staged"; break;
			case "End": next = "timers"; break;
			case "Tab": {
				if (event.shiftKey) return;
				const panel = this.els.tabs[this.tab].panel;
				if (panel.getAttribute("tabindex") === "0") {
					event.preventDefault();
					panel.focus();
				}
				return;
			}
			default: return;
		}
		event.preventDefault();
		this.selectTab(next);
		this.els.tabs[next].button.focus();
	}

	private updateTabs(): void {
		if (!this.els) return;
		for (const tab of ["staged", "timers"] as const) {
			const { button, panel } = this.els.tabs[tab];
			button.toggleClass("tntp-tabs__tab--active", tab === this.tab);
			button.setAttribute("aria-selected", String(tab === this.tab));
			button.setAttribute("tabindex", tab === this.tab ? "0" : "-1");
			if (tab === this.tab) panel.removeAttribute("hidden");
			else panel.setAttribute("hidden", "");
		}
		this.updatePanelFocus();
	}

	private updatePanelFocus(): void {
		if (!this.els) return;
		for (const tab of ["staged", "timers"] as const) {
			const { panel } = this.els.tabs[tab];
			// Headers precede the body, so their enabled actions are the first Tab target.
			const enabled = Array.from(panel.querySelectorAll<HTMLButtonElement>("button"))
				.some(button => !button.disabled && (!button.classList.contains("tntp-message__retry") ||
					panel.classList.contains("tntp-panel--missing") || panel.classList.contains("tntp-panel--incompatible") || panel.classList.contains("tntp-panel--staging-retry")));
			panel.setAttribute("tabindex", tab === this.tab && !enabled ? "0" : "-1");
		}
	}

	private openPicker(): void {
  const { gateway, controller } = this.services;
  if (this.picker || this.isBusy() || !gateway.startAvailability().available) return;
  const modal = new TaskPickerModal(this.app, { mode: "start", gateway, controller, onClose: () => {
   if (this.picker === modal) this.picker = null;
  } });
  this.picker = modal;
  modal.open();
 }

	private isBusy(): boolean { return this.services.controller.isBusy() || !!this.services.stagingController?.isBusy(); }

	private openStagePicker(): void {
		const { gateway, staging, stagingController } = this.services;
		if (this.picker || !stagingController || !staging?.getSnapshot().canStage || stagingController.isBusy() || this.services.controller.isBusy()) return;
		const modal = new TaskPickerModal(this.app, { mode: "stage", gateway, controller: stagingController, onClose: () => { if (this.picker === modal) this.picker = null; } });
		this.picker = modal; modal.open();
	}

	/** Every open timer in display order (the saved order, new timers on top); none unless running. */
	private currentTimers(): { state: PaneState; timers: OpenTimer[] } {
		const snapshot = this.services.store.getSnapshot();
		const state = derivePaneState(this.services.gateway.getState(), snapshot);
		if (state !== "running" || !snapshot?.primary) return { state, timers: [] };
		return { state, timers: orderTimers([snapshot.primary, ...snapshot.others], this.services.cardOrder.get()) };
	}

	private render(): void {
		const els = this.els;
		if (!els) return;
		const { state, timers } = this.currentTimers();
		const connected = state === "running" || state === "idle";
		this.renderDoneToday(connected);
		const gate = this.services.gateway.startAvailability();
		els.start.disabled = !connected || !gate.available || this.isBusy();
		setTooltip(els.start, gate.reason);
		const header = this.services.store.getHeaderState();
		const busy = this.services.controller.isBusy() || !!this.services.stagingController?.isBusy();
		const busyTip = "A timer action is in progress";
		els.pauseAll.disabled = !connected || busy || !header.readable || header.eligibleCount === 0;
		setTooltip(els.pauseAll, busy ? busyTip : !header.readable ? "Cannot verify Pomodoro ownership" : header.eligibleCount === 0 ? "No running timers to pause" : "Pause all running timers");
		els.resumeAll.disabled = !connected || busy || header.pausedCount === 0;
		setTooltip(els.resumeAll, busy ? busyTip : header.pausedCount === 0 ? "No paused timers to resume" : "Resume all paused timers");
		const nothingToStop = header.eligibleCount === 0 && header.pausedCount === 0;
		els.stopAll.disabled = !connected || busy || !header.readable || nothingToStop;
		setTooltip(els.stopAll, busy ? "A timer action is in progress" : !header.readable ? "Cannot verify Pomodoro ownership" : nothingToStop ? "No timers to stop" : "Stop all timers and clear paused ones");
		for (const candidate of PANE_STATES) els.root.toggleClass(`tntp-pane--${candidate}`, candidate === state);
		els.root.toggleClass("tntp-pane--pomodoro-unknown", this.services.gateway.getState().kind === "ready" && !header.readable);
		const staging = this.services.staging?.getSnapshot();
		const stagedPaths = new Set(connected ? staging?.items.map(item => item.taskPath) : []);
		this.cards?.reconcile(timers.map(timer => ({ ...timer, stagedMarker: stagedPaths.has(normalizeTimerPath(timer.taskPath)) })));
		const runningCount = connected ? header.eligibleCount : 0;
		setTextIfChanged(els.tabs.staged.count, ` ${stagedPaths.size}`);
		setTextIfChanged(els.tabs.timers.count, ` ${runningCount}`);
		els.tabs.timers.count.toggleClass("tntp-tabs__count--running", runningCount > 0);
		if (els.tabs.staged.stage) {
			els.tabs.staged.stage.disabled = !connected || !staging?.canStage || !this.services.stagingController || busy;
			setTooltip(els.tabs.staged.stage, busy ? "A task action is in progress" : staging?.canStage ? "Stage tasks for today" : "Check the staged field setup below");
		}
		const stagedModels: TaskCardModel[] = connected ? orderStaged(staging?.items ?? [], this.services.stagedOrder?.get() ?? []).map(item => {
			const matches = timers.filter(timer => normalizeTimerPath(timer.taskPath) === item.taskPath);
			const timed = matches.find(timer => timer.state === "running") ?? matches[0];
			return { ...(timed ?? { state: "idle" as const, taskPath: item.taskPath, title: displayTitle(item.task.title, item.taskPath), displayKey: taskDisplayKey(item.task) }), stagedCard: true, stagedMetadata: item.metadata };
		}) : [];
		this.stagedCards?.reconcile(stagedModels);
		const staged = els.tabs.staged;
		if (connected) {
			setTextIfChanged(staged.heading, "Nothing staged for today");
			setTextIfChanged(staged.body, "Choose Stage above to pick today's tasks.");
			setTextIfChanged(staged.meta, "");
			if (staging) {
				let heading = staging.items.length ? "" : staging.loaded ? "Nothing staged for today" : "Loading staged tasks…";
				let body = staging.items.length ? "" : "Choose Stage above to pick today's tasks.";
				if (!staging.supported) { heading = "Staging needs a TaskNotes update"; body = "Staging requires TaskNotes 4.13.0 or newer and the staging APIs. Update TaskNotes to use this tab."; }
				else if (staging.field.kind === "missing" || staging.field.kind === "wrong-type") { heading = "Set up the staged field"; body = "In TaskNotes settings → Task Properties → Custom User Fields, register key staged with type Date and no default value."; }
				else if (staging.field.kind === "ok" && staging.field.hasDefault) { heading = "Remove the staged field default"; body = "In TaskNotes settings → Task Properties → Custom User Fields, remove the default value from the staged Date field. Existing tasks remain usable."; }
				if (staging.warning) { heading = "Couldn't refresh staging"; body = staging.warning; }
				setTextIfChanged(staged.heading, heading); setTextIfChanged(staged.body, body);
				staged.panel.toggleClass("tntp-panel--has-staged", staging.items.length > 0);
				staged.panel.toggleClass("tntp-panel--staging-retry", !!staging.warning || staging.field.kind === "unknown");
				staged.retry?.setText("Retry");
			}
		} else this.renderMessage(staged, state);
		for (const candidate of PANE_STATES) {
			els.tabs.timers.panel.toggleClass(`tntp-panel--${candidate}`, candidate === state);
			staged.panel.toggleClass(`tntp-panel--${candidate}`, !connected && candidate === state);
		}
		this.updatePanelFocus();
		if (timers.length > 0) {
			this.writeTimes(Date.now());
			return;
		}
		this.renderMessage(els, state);
	}

	private renderDoneToday(connected: boolean): void {
		if (!this.doneList || !this.doneEmpty) return;
		const day = this.services.staging?.currentDay ?? stagingDay(Date.now(), 4);
		const items = connected ? this.services.completions?.getDoneToday(day) ?? [] : [];
		const live = new Set(items.map(item => item.id));
		for (const [id, owner] of this.doneRows) if (!live.has(id)) {
			owner.title.dispose(); owner.row.detach(); this.doneRows.delete(id);
		}
		this.doneEmpty.toggleClass("tntp-hidden", items.length > 0);
		if (items.length) this.doneEmpty.setAttribute("hidden", "");
		else this.doneEmpty.removeAttribute("hidden");
		for (const item of items) {
			const model = { taskPath: item.completedPath, title: displayTitle(item.title, item.completedPath), displayKey: item.displayKey };
			let owner = this.doneRows.get(item.id);
			if (!owner) {
				const row = this.doneList.createDiv({ cls: "tntp-done-today__row" });
				owner = { row, title: new TaskTitle(row, model, { app: this.app, gateway: this.services.gateway }) };
				this.doneRows.set(item.id, owner);
			} else owner.title.update(model);
		}
		let cursor = this.doneList.firstElementChild;
		for (const item of items) {
			const row = this.doneRows.get(item.id)!.row;
			if (row !== cursor) this.doneList.insertBefore(row, cursor);
			cursor = row.nextElementSibling;
		}
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

	private renderMessage(els: Pick<TabElements, "heading" | "body" | "meta">, state: PaneState): void {
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
  for (const card of this.cards?.values() ?? []) card.writeTimes(nowMs);
  for (const card of this.stagedCards?.values() ?? []) card.writeTimes(nowMs);
 }

	/**
	 * Wall-clock tick: every duration is recomputed from startTime and Date.now(), never
	 * counted, so the first tick after sleep is already right. It never calls TaskNotes;
	 * after a wake gap or a reveal it asks the store for a (debounced) refresh.
	 */
	private tick(): void {
		const now = Date.now();
		this.services.staging?.checkDay(now);
		const { store } = this.services;
		// A wake or throttle gap: data may have changed while timers were suspended.
		if (detectWakeGap(this.lastTickMs, now)) { store.requestRefresh(); this.services.staging?.requestRefresh(); }
		this.lastTickMs = now;
		const shown = this.contentEl.isShown();
		// Revealed (sidebar tab switched back, pane expanded): re-read TaskNotes.
		if (shown && !this.wasShown) { store.requestRefresh(); this.services.staging?.requestRefresh(); }
		this.wasShown = shown;
		// Hidden: no DOM writes.
		if (!shown) return;
		this.writeTimes(now);
	}
}
