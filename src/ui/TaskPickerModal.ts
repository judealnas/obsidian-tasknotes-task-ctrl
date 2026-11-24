import { SuggestModal, type App } from "obsidian";
import { filterAndSortTasks } from "../model/taskPicker";
import { ambiguousTitle, buildTaskCreation } from "../model/taskCreation";
import { normalizeTimerPath } from "../model/pomodoroOwnership";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { ParsedTaskData, TaskInfo, TaskNotesUserField, TaskPriority, TaskStatus } from "../tasknotes/runtime-api.types";
import { isStageReserved } from "../model/staging";
import type { StagingController } from "../state/StagingController";
import type { IdleAddOutcome } from "../state/IdleCardStore";
import type { TimerController } from "../state/TimerController";
import type { PickerCreationController, PickerCreationOperation, PickerDestinationResult } from "../state/PickerCreationController";
import { TaskPickerRelationships } from "../state/TaskPickerRelationships";
import { renderTaskPickerRow } from "./TaskPickerRow";

interface TaskCreationAction {
 coordinator: PickerCreationController;
 destinationAvailability: () => { available: boolean; reason: string };
 subscribeDestination: (listener: () => void) => () => void;
}
interface PickerBase {
 gateway: TaskNotesGateway;
 onClose: () => void;
 creation?: TaskCreationAction;
}
export type TaskPickerOptions = PickerBase & (
 { mode: "start"; controller: Pick<TimerController, "start" | "isBusy"> } |
 { mode: "add"; controller: { add(task: TaskInfo, canWrite?: () => boolean): Promise<IdleAddOutcome>; isBusy(): boolean; availability(): { available: boolean; reason: string } } } |
 { mode: "stage"; controller: Pick<StagingController, "stage" | "isBusy">; beforePath?: string | null }
);

/** Local ranking, display-only rows and an explicit public-API creation preview. */
export class TaskPickerModal extends SuggestModal<TaskInfo> {
 private tasks: TaskInfo[] = [];
 private statuses: TaskStatus[] = [];
 private priorities: TaskPriority[] = [];
 private fields: TaskNotesUserField[] | null = null;
 private completed = new Set<string>();
 private hidden = new Set<string>();
 private pomodoroPath: string | null = null;
 private opening = 0;
 private opened = false;
 private pending = false;
 private offs: Array<() => void> = [];
 private relationships: TaskPickerRelationships;
 private parseTimer: number | null = null;
 private refreshTimer: number | null = null;
 private parseGeneration = 0;
 private parsePending: Promise<void> | null = null;
 private shortcutPending = false;
 private query = "";
 private previewQuery: string | null = null;
 private parsed: ParsedTaskData | null = null;
 private operation: PickerCreationOperation | null = null;
 private operationQuery: string | null = null;
 private retryTask: TaskInfo | null = null;
 private inlineError: HTMLElement | null = null;
 private inputHandler = () => this.queryChanged();
 private keyHandler = (event: KeyboardEvent) => {
  if (event.key === "Enter" && event.isComposing) { event.stopImmediatePropagation(); return; }
 };
 constructor(app: App, private readonly options: TaskPickerOptions) {
  super(app);
  this.relationships = new TaskPickerRelationships(options.gateway.subtasks?.bind(options.gateway));
  this.setPlaceholder(options.mode === "stage" ? "Choose tasks to stage" : "Choose a task to add");
  this.emptyStateText = "Loading tasks…";
  this.setInstructions([{ command: "↑↓", purpose: "select" }, { command: "↵", purpose: "add selected task" }, { command: "shift ↵", purpose: "create new task" }, { command: "esc", purpose: "close" }]);
  this.scope.register(["Shift"], "Enter", event => {
   if (!event.isComposing && !event.repeat) void this.createFromShortcut();
   return false;
  });
 }
 private get gateway(): TaskNotesGateway { return this.options.gateway; }
 onOpen(): void {
  void super.onOpen(); this.opened = true; this.pending = false;
  this.hidden.clear(); this.operation = null; this.operationQuery = null; this.retryTask = null;
  this.inlineError = this.modalEl.createDiv({ cls: "tntp-picker-error", attr: { role: "status", "aria-live": "polite" } });
  this.inputEl.addEventListener("input", this.inputHandler);
  this.inputEl.addEventListener("keydown", this.keyHandler, true);
  const opening = ++this.opening;
  this.offs.push(this.gateway.onState(() => { if (this.opened) this.close(); }));
  this.offs.push(this.gateway.onData(() => {
   this.relationships.reset(true);
   if (this.refreshTimer) return;
   this.refreshTimer = this.inputEl.win.setTimeout(() => { this.refreshTimer = null; void this.loadTasks(opening, false); }, 100);
  }));
  void this.loadTasks(opening, true);
  this.queryChanged(true);
 }
 private alive(opening: number): boolean { return this.opened && opening === this.opening; }
 private refreshRows(): void {
  const host = this.inputEl.win as unknown as { Event: typeof Event };
  this.inputEl.dispatchEvent(new host.Event("input"));
 }
 private async loadTasks(opening: number, initial: boolean): Promise<void> {
  try {
   const tasksPromise = this.gateway.listTasks();
   void tasksPromise.catch(() => undefined);
   if (initial) {
    const [statuses, priorities, fields, ownership] = await Promise.all([
     this.gateway.statuses(), this.gateway.priorities?.().catch(() => []) ?? [],
     this.gateway.userFields().catch(() => null), this.gateway.pomodoroOwnership().catch(() => ({ readable: false } as const)),
    ]);
    if (!this.alive(opening)) return;
    this.statuses = statuses; this.priorities = priorities; this.fields = fields;
    this.completed = new Set(statuses.filter(status => status.isCompleted).map(status => status.value));
    this.pomodoroPath = ownership.readable && ownership.owner ? normalizeTimerPath(ownership.owner.taskPath) : null;
   }
   const tasks = await tasksPromise;
   if (!this.alive(opening)) return;
   this.tasks = tasks; this.emptyStateText = "No matching tasks"; this.refreshRows();
  } catch {
   if (this.alive(opening)) { this.emptyStateText = "Couldn't load tasks"; this.inlineError?.setText("Couldn't load tasks. Close the picker and try again."); }
  }
 }
 getSuggestions(query: string): TaskInfo[] {
  this.relationships.reset();
  const tasks = this.tasks.filter(task => !this.hidden.has(normalizeTimerPath(task.path)) && (this.options.mode !== "stage" || !task.archived && !this.completed.has(task.status) && !isStageReserved(task)));
  return filterAndSortTasks(tasks, this.completed, query);
 }
 renderSuggestion(task: TaskInfo, el: HTMLElement): void {
  const metadata = renderTaskPickerRow(task, el, this.statuses, this.priorities);
  if (this.pomodoroPath === normalizeTimerPath(task.path)) el.createSpan({ cls: "tntp-picker-pomodoro", text: "Pomodoro" });
  this.relationships.request(task.path, children => {
   if (!children.length) return;
   metadata.createSpan({ cls: "tntp-picker-meta", text: `${children.filter(child => this.completed.has(child.status)).length}/${children.length} subtasks` });
  });
 }
 selectSuggestion(task: TaskInfo, event: MouseEvent | KeyboardEvent): void {
  if ("isComposing" in event && event.isComposing || "shiftKey" in event && event.shiftKey) return;
  if (!this.opened || this.pending || this.actionBusy() || !this.available()) return;
  void this.selectTask(task);
 }
 onChooseSuggestion(task: TaskInfo): void { this.selectSuggestion(task, {} as KeyboardEvent); }
 private async selectTask(task: TaskInfo): Promise<void> {
  this.pending = true;
  const opening = this.opening;
  const result = await this.routeTask(task, opening).catch(() => ({ ok: false, message: "Couldn't add this task. Try again." }));
  if (!this.alive(opening)) return;
  this.pending = false;
  if (result.ok) this.destinationSucceeded(task, result.message);
  else { this.retryTask = task; this.inlineError?.setText(result.message ?? "Couldn't add this task."); }

 }
 private async routeTask(task: TaskInfo, opening: number, ownerAlive: () => boolean = () => true): Promise<PickerDestinationResult> {
  const canWrite = () => this.alive(opening) && ownerAlive();
  if (!canWrite()) return { ok: false, cancelled: true };
  if (!this.available()) return { ok: false, message: "Destination unavailable. The note remains available." };
  if (this.options.mode === "stage") {
   // StagingController re-reads the task, completion statuses and reserved fields immediately before its write.
   const result = await this.options.controller.stage({ taskPath: task.path, title: task.title, beforePath: this.options.beforePath }, canWrite);
   return { ok: result.kind === "staged" || result.kind === "already-staged", cancelled: result.kind === "cancelled", message: result.warning ?? result.message };
  }
  if (this.options.mode !== "add") return { ok: false };
  const current = await this.gateway.getTask(task.path);
  if (!canWrite()) return { ok: false, cancelled: true };
  if (!this.available()) return { ok: false, message: "TaskNotes changed. Retry add." };
  if (!current || current.archived || (await this.gateway.statuses()).some(status => status.isCompleted && status.value === current.status)) return { ok: false, message: "This note is missing, archived or completed and cannot be added." };
  if (!canWrite()) return { ok: false, cancelled: true };
  const result = await this.options.controller.add(current, canWrite);
  return { ok: result.kind === "added-and-saved" || result.kind === "already-represented", cancelled: result.kind === "cancelled", message: result.message };
 }
 private destinationSucceeded(task: TaskInfo, message?: string): void {
  this.retryTask = null;
  if (this.options.mode === "add") { this.close(); return; }
  this.hidden.add(normalizeTimerPath(task.path)); this.refreshRows(); this.inputEl.focus();
  this.inlineError?.setText(message || `Staged “${task.title}”.`);
 }
 private available(): boolean {
  return this.options.mode !== "start" && (this.options.mode === "stage" ? this.gateway.stagingAvailability() : this.options.controller.availability()).available;
 }
 private actionBusy(): boolean { return this.options.controller.isBusy() || !!this.options.creation?.coordinator.isBusy(); }
 private queryChanged(force = false): void {
  const query = this.inputEl.value;
  if (!force && query === this.query) return;
  this.query = query; this.previewQuery = null; this.parsed = null;
  if (this.parseTimer) this.inputEl.win.clearTimeout(this.parseTimer);
  const generation = ++this.parseGeneration; const opening = this.opening;

  if (!query.trim() || !this.options.creation?.coordinator.availability().available) return;
  this.parseTimer = this.inputEl.win.setTimeout(() => {
   this.parseTimer = null;
   void this.parseQuery(query, generation, opening);
  }, 150);
 }
 private parseQuery(query: string, generation: number, opening: number): Promise<void> {
  this.parsePending = Promise.resolve().then(() => this.gateway.parseTask!(query)).then(parsed => {
    if (!this.alive(opening) || generation !== this.parseGeneration || query !== this.inputEl.value) return;
    this.parsed = parsed; this.previewQuery = query;

   }).catch(() => { if (this.alive(opening) && generation === this.parseGeneration) this.inlineError?.setText("Couldn't parse this task. Edit the query to try again."); });
  return this.parsePending;
 }
 private async createFromShortcut(): Promise<void> {
  if (this.shortcutPending || !this.opened || !this.options.creation || this.pending || this.actionBusy()) return;
  this.shortcutPending = true;
  const opening = this.opening; const query = this.inputEl.value;
  try {
   // Retry known identities immediately; never parse a new creation instead of retrying.
   if (!this.retryTask && this.operation?.state !== "retryable-destination-error" && this.previewQuery !== query) {
    if (!query.trim() || !this.options.creation.coordinator.availability().available) return;
    if (this.parseTimer !== null) {
     this.inputEl.win.clearTimeout(this.parseTimer); this.parseTimer = null;
     await this.parseQuery(query, this.parseGeneration, opening);
    } else await this.parsePending;
   }
   if (this.alive(opening) && query === this.inputEl.value) await this.createTask();
  } finally { this.shortcutPending = false; }
 }
 private creationBlockedReason(): string {
  const action = this.options.creation;
  if (!action) return "Task creation is unavailable.";
  const destination = action.destinationAvailability();
  if (!destination.available) return destination.reason;
  if (this.retryTask || this.operation?.state === "retryable-destination-error") return "";
  const gate = action.coordinator.availability();
  if (!gate.available) return gate.reason;
  if (!this.query.trim()) return "Enter a task title.";
  if (!this.parsed || this.previewQuery !== this.inputEl.value) return "Wait for the query to finish parsing.";
  if (ambiguousTitle(this.parsed)) return "Add a task title to the search query before creating.";
  if (this.operationQuery === this.query && this.operation?.state === "succeeded") return "Already created. Edit the query to create another task.";
  return "";
 }
 private async createTask(): Promise<void> {
  const action = this.options.creation;
  if (!this.opened || !action || this.pending || this.actionBusy()) return;
  const reason = this.creationBlockedReason();
  if (reason) { this.inlineError?.setText(reason); return; }
  const opening = this.opening;
  if (this.retryTask) { await this.selectTask(this.retryTask); return; }
  if (this.operation?.state === "retryable-destination-error") {
   this.pending = true;
   await action.coordinator.route(this.operation, () => this.alive(opening), (task, canWrite) => this.routeTask(task, opening, canWrite));
   if (!this.alive(opening)) return;
   this.pending = false; this.showOperation(this.operation); return;
  }
  if (!this.parsed || this.previewQuery !== this.inputEl.value) return;
  let payload;
  try { payload = buildTaskCreation(this.parsed, this.parsed.title, this.fields); }
  catch (error) { this.inlineError?.setText(error instanceof Error ? error.message : "Could not prepare task."); return; }
  this.operationQuery = this.query;
  await action.coordinator.create(payload, () => this.alive(opening), (task, canWrite) => this.routeTask(task, opening, canWrite), operation => {
   if (!this.alive(opening)) return;
   this.operation = operation; this.showOperation(operation);
  });
  if (this.alive(opening) && this.previewQuery !== this.inputEl.value) this.queryChanged(true);
 }
 private showOperation(operation: PickerCreationOperation): void {
  if (operation.state === "succeeded" && operation.task) this.destinationSucceeded(operation.task, operation.message);
  else this.inlineError?.setText(operation.message || (operation.state === "creating" ? "Creating task…" : operation.state === "routing" ? "Adding task…" : ""));
 }
 onClose(): void {
  this.opened = false; this.opening++; this.parseGeneration++;
  if (this.parseTimer) this.inputEl.win.clearTimeout(this.parseTimer); if (this.refreshTimer) this.inputEl.win.clearTimeout(this.refreshTimer);
  this.parseTimer = null; this.refreshTimer = null;
  this.parsePending = null;
  this.inputEl.removeEventListener("input", this.inputHandler); this.inputEl.removeEventListener("keydown", this.keyHandler, true);
  this.relationships.reset(true); for (const off of this.offs.splice(0)) off();
  this.tasks = []; this.statuses = []; this.priorities = []; this.fields = null; this.pomodoroPath = null;
  this.inlineError = null;
  this.options.onClose(); super.onClose();
 }
}
