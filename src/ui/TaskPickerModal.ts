import { Component, MarkdownRenderer, Notice, SuggestModal, type App } from "obsidian";
import { filterAndSortTasks } from "../model/taskPicker";
import { taskWikilink } from "../model/taskLink";
import { normalizeTimerPath, type Ownership } from "../model/pomodoroOwnership";
import type { TimerController } from "../state/TimerController";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TaskInfo } from "../tasknotes/runtime-api.types";
import { isStageReserved } from "../model/staging";
import type { StagingController } from "../state/StagingController";

/** Each opening reads once; keystrokes rank the local snapshot through public SuggestModal. */
interface PickerBase {
 gateway: TaskNotesGateway;
 onClose: () => void;
}
export type TaskPickerOptions = PickerBase & (
 { mode: "start"; controller: Pick<TimerController, "start" | "isBusy"> } |
 { mode: "stage"; controller: Pick<StagingController, "stage" | "isBusy"> }
);

export class TaskPickerModal extends SuggestModal<TaskInfo> {
 private readonly gateway: TaskNotesGateway;
 private readonly options: TaskPickerOptions;
 private readonly didClose: () => void;
 private tasks: TaskInfo[] = [];
 private completed = new Set<string>();
 /** D-17: the normalized path the active Pomodoro is timing, read at open; informational only. */
 private pomodoroPath: string | null = null;
 private generation = 0;
 private opening = 0;
 private opened = false;
 private chosen = false;
 private components = new Set<Component>();
 private offState: (() => void) | null = null;
 private pending = false;
 private inlineError: HTMLElement | null = null;

 constructor(app: App, options: TaskPickerOptions) {
  super(app);
  this.gateway = options.gateway;
  this.options = options;
  this.didClose = options.onClose;
  this.setPlaceholder(options.mode === "stage" ? "Choose tasks to stage" : "Choose a task to start");
  this.emptyStateText = "Loading tasks…";
 }

 onOpen(): void {
  void super.onOpen();
  this.opened = true;
  this.chosen = false;
  this.pending = false;
  if (this.options.mode === "stage") this.inlineError = this.contentEl.createDiv({ cls: "tntp-picker-error", attr: { role: "status", "aria-live": "polite" } });
  const generation = ++this.opening;
  this.offState = this.gateway.onState(() => {
   if (!this.available()) this.close();
  });
  void this.loadTasks(generation);
 }

 private async loadTasks(generation: number): Promise<void> {
  try {
   // An ownership failure never closes the picker: it only means no row is tagged.
   const ownershipRead: Promise<Ownership> = this.gateway.pomodoroOwnership().catch((): Ownership => ({ readable: false }));
   const [tasks, statuses, ownership] = await Promise.all([this.gateway.listTasks(), this.gateway.statuses(), ownershipRead]);
   if (!this.opened || generation !== this.opening || !this.available()) return;
   this.tasks = tasks;
   this.completed = new Set(statuses.filter(status => status.isCompleted).map(status => status.value));
   this.pomodoroPath = ownership.readable && ownership.owner ? normalizeTimerPath(ownership.owner.taskPath) : null;
   this.emptyStateText = "No matching tasks";
   // Public input event asks SuggestModal to refresh its list and selection.
   const host = this.inputEl.win as unknown as { Event: typeof Event };
   this.inputEl.dispatchEvent(new host.Event("input"));
  } catch (error) {
   if (!this.opened || generation !== this.opening) return;
   if (this.options.mode === "stage") {
    if (this.inlineError) this.inlineError.setText("Couldn't load tasks. Close this picker and try Stage again.");
    return;
   }
   try {
    new Notice("Couldn't load tasks: " + (this.gateway.normalizeError(error).message || "TaskNotes reported an error"));
   } catch (noticeError) {
    console.error("[tasknotes-timer-pane] Showing the task picker error failed", noticeError);
   } finally { this.close(); }
  }
 }

 getSuggestions(query: string): TaskInfo[] {
  this.clearRows();
  const tasks = this.options.mode === "stage" ? this.tasks.filter(task => !task.archived && !this.completed.has(task.status) && !isStageReserved(task)) : this.tasks;
  return filterAndSortTasks(tasks, this.completed, query);
 }

 renderSuggestion(task: TaskInfo, el: HTMLElement): void {
  el.addClass("tntp-picker-row");
  const chip = el.createDiv({ cls: "tntp-picker-chip", text: task.title });
  if (task.due) el.createSpan({ cls: "tntp-picker-due", text: task.due });
  if (this.pomodoroPath !== null && typeof task.path === "string" && normalizeTimerPath(task.path) === this.pomodoroPath) el.createSpan({ cls: "tntp-picker-pomodoro", text: "Pomodoro" });
  // Capture before TaskNotes' nested controls can open/edit/complete the task.
  chip.addEventListener("click", event => {
   if (event.button !== 0) return;
   event.preventDefault(); event.stopImmediatePropagation();
   this.selectSuggestion(task, event);
  }, true);
  for (const name of ["pointerdown", "mousedown", "contextmenu", "auxclick"] as const) {
   chip.addEventListener(name, event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  }
  const markdown = taskWikilink(task.path);
  if (markdown === null) return;
  const generation = this.generation;
  const component = new Component();
  this.components.add(component);
  component.load();
  const wrapper = createDiv({ cls: "tntp-picker-chip__md" });
  void MarkdownRenderer.render(this.app, markdown, wrapper, "", component).then(() => {
   if (!this.opened || generation !== this.generation || !this.components.has(component)) {
    this.release(component); return;
   }
   if (!wrapper.querySelector("a.internal-link, .task-card")) { this.release(component); return; }
   // The row, rather than any nested chip control, owns keyboard selection.
   for (const control of Array.from(wrapper.querySelectorAll<HTMLElement>("a, button, input, [tabindex]"))) control.setAttribute("tabindex", "-1");
   chip.empty(); chip.appendChild(wrapper);
  }).catch((error: unknown) => {
   this.release(component);
   console.error("[tasknotes-timer-pane] Rendering a picker task link failed", error);
  });
 }

 selectSuggestion(task: TaskInfo, event: MouseEvent | KeyboardEvent): void {
  if (!this.opened || this.chosen || this.pending || this.options.controller.isBusy() || !this.available()) return;
  if (this.options.mode === "stage") { void this.stageSelection(task); return; }
  super.selectSuggestion(task, event);
 }

 onChooseSuggestion(task: TaskInfo): void {
  // SuggestModal may close before invoking this callback, so closed is not a veto.
  if (this.options.mode !== "start" || this.chosen || this.options.controller.isBusy() || !this.gateway.startAvailability().available) return;
  this.chosen = true;
  void this.options.controller.start({ taskPath: task.path, title: task.title });
 }

 private available(): boolean { return (this.options.mode === "stage" ? this.gateway.stagingAvailability() : this.gateway.startAvailability()).available; }
 private async stageSelection(task: TaskInfo): Promise<void> {
  if (this.options.mode !== "stage") return;
  this.pending = true;
  const opening = this.opening;
  this.inlineError?.setText("");
  try {
   const outcome = await this.options.controller.stage({ taskPath: task.path, title: task.title });
   if (!this.opened || opening !== this.opening) return;
   if (outcome.kind === "staged" || outcome.kind === "already-staged") {
    this.tasks = this.tasks.filter(candidate => normalizeTimerPath(candidate.path) !== normalizeTimerPath(task.path));
    const host = this.inputEl.win as unknown as { Event: typeof Event };
    this.inputEl.dispatchEvent(new host.Event("input"));
    this.inputEl.focus();
    this.inlineError?.setText(outcome.warning ?? "");
   } else this.inlineError?.setText(outcome.message ?? "Couldn't stage this task. Try again.");
  } catch {
   if (this.opened && opening === this.opening) this.inlineError?.setText("Couldn't stage this task. Try again.");
  } finally { if (opening === this.opening) this.pending = false; }
 }

 onClose(): void {
  this.opened = false;
  ++this.opening;
  this.clearRows();
  this.tasks = [];
  this.inlineError = null;
  this.pomodoroPath = null;
  this.offState?.(); this.offState = null;
  this.didClose();
  super.onClose();
 }

 private release(component: Component): void {
  if (this.components.delete(component)) component.unload();
 }

 private clearRows(): void {
  ++this.generation;
  for (const component of this.components) component.unload();
  this.components.clear();
 }
}
