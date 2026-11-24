import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TaskCreationData, TaskInfo } from "../tasknotes/runtime-api.types";
import type { WriteQueue } from "./WriteQueue";

export interface PickerDestinationResult { ok: boolean; cancelled?: boolean; message?: string }
export interface PickerCreationOperation {
 state: "creating" | "created-awaiting-destination" | "routing" | "succeeded" | "retryable-destination-error" | "creation-error" | "cancelled";
 task?: TaskInfo;
 message?: string;
}
/** Plugin-wide guard; each modal owns an operation and retries only its known identity. */
export class PickerCreationController {
 private busy = false;
 private disposed = false;
 private generation = 0;
 private listeners = new Set<() => void>();
 private off: () => void;
 constructor(private readonly deps: { gateway: TaskNotesGateway; queue: WriteQueue; notify: (message: string) => void; newCorrelationId: () => string }) {
  this.off = deps.gateway.onState(() => { this.generation++; this.changed(); });
 }
 isBusy(): boolean { return this.busy; }
 availability(): { available: boolean; reason: string } {
  if (this.disposed || this.busy) return { available: false, reason: "Another creation is in progress" };
  return this.deps.gateway.inlineCreationAvailability?.() ?? { available: false, reason: "TaskNotes does not expose public inline creation" };
 }
 subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
 private changed(): void { for (const listener of this.listeners) listener(); }
 async create(data: TaskCreationData, alive: () => boolean, route: (task: TaskInfo, canWrite: () => boolean) => Promise<PickerDestinationResult>, changed: (operation: PickerCreationOperation) => void): Promise<PickerCreationOperation | null> {
  if (!this.availability().available) return null;
  this.busy = true; this.changed();
  const generation = this.generation;
  const valid = () => !this.disposed && generation === this.generation && alive();
  const operation: PickerCreationOperation = { state: "creating" };
  changed(operation);
  let submitted = false;
  try {
   operation.task = await this.deps.queue.run(async () => {
    if (!valid()) throw new Error("Creation cancelled before submission");
    submitted = true;
    return this.deps.gateway.createTask!(data, { source: "tasknotes-timer-pane", correlationId: this.deps.newCorrelationId(), reason: "picker-create" });
   });
   operation.state = "created-awaiting-destination";
   if (!valid()) {
    this.deps.notify(`Created “${operation.task.title}”. The picker closed or TaskNotes reconnected; the note remains available and was not automatically added.`);
    return operation;
   }
   // The creation queue has released before staging enters the same queue.
   await this.route(operation, valid, route);
  } catch (error) {
   operation.state = "creation-error";
   operation.message = submitted ? `Failed to create task: ${error instanceof Error ? error.message : String(error)}` : "Creation cancelled before submission.";
   if (submitted) {
    void this.deps.gateway.listTasks().catch(() => undefined);
    if (!valid()) this.deps.notify(operation.message);
   }
   if (valid()) changed(operation);
  } finally {
   this.busy = false;
   if (valid()) changed(operation);
   this.changed();
  }
  return operation;
 }
 async route(operation: PickerCreationOperation, alive: () => boolean, route: (task: TaskInfo, canWrite: () => boolean) => Promise<PickerDestinationResult>): Promise<void> {
  if (!operation.task || operation.state === "routing" || operation.state === "succeeded" || operation.state === "cancelled") return;
  const generation = this.generation;
  const valid = () => !this.disposed && generation === this.generation && alive();
  if (!valid()) { this.cancelDestination(operation); return; }
  operation.state = "routing";
  try {
   const outcome = await route(operation.task, valid);
   if (outcome.cancelled) { this.cancelDestination(operation); return; }
   // Once a destination has dispatched its write it reports the real result, even if the UI closed.
   operation.state = outcome.ok ? "succeeded" : "retryable-destination-error";
   operation.message = outcome.message;
  } catch {
   operation.state = "retryable-destination-error";
   operation.message = "The note exists, but adding it failed. Retry uses this same note.";
  }
 }
 private cancelDestination(operation: PickerCreationOperation): void {
  operation.state = "cancelled";
  operation.message = `Created “${operation.task!.title}”. Adding was cancelled before its write; the note remains available.`;
  try { this.deps.notify(operation.message); } catch { /* Notification cannot change a known creation outcome. */ }
 }
 dispose(): void { this.disposed = true; this.generation++; this.off(); this.listeners.clear(); }
}
