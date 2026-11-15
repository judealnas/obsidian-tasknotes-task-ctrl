import { fieldStatus } from "../model/stagedField";
import { parseStagedValue, readStaged } from "../model/staging";
import { stagingDay } from "../model/stagingDay";
import { normalizeTimerPath, sameEntry, type EntryId } from "../model/pomodoroOwnership";
import { isNoActiveSessionError } from "../model/errors";
import { resolveCompletionStatus, type TimerPaneSettings } from "../settings";
import { MUTATION_SOURCE, type TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { CompleteOutcome, TimerController } from "./TimerController";
import type { WriteQueue } from "./WriteQueue";
import type { CompletionAttempt } from "../model/completionLedger";
export type { CompletionAttempt, CompletionPhase } from "../model/completionLedger";

export interface CompletionTarget { sourcePath: string; title: string; entry?: EntryId; }
export interface CompletionControllerDeps {
 gateway: TaskNotesGateway;
 queue: WriteQueue;
 timer: TimerController;
 settingsReady: () => Promise<void>;
 getSettings: () => TimerPaneSettings;
 getRecords: () => readonly CompletionAttempt[];
 saveRecord: (record: CompletionAttempt) => Promise<void>;
 storageAvailable?: () => boolean;
 refresh: () => Promise<void>;
 clearPause?: (path: string) => void;
 otherBusy?: () => boolean;
 newCorrelationId: () => string;
 now?: () => number;
 notify: (message: string) => void;
 log: (message: string) => void;
}

/** One completion owner for both tabs. All upstream writes are inside the original queue. */
export class CompletionController {
 private readonly guards = new Map<string, CompletionAttempt>();
 constructor(private readonly deps: CompletionControllerDeps) {}
 isBusy(): boolean { return this.deps.timer.isBusy(); }
 subscribe(listener: () => void): () => void { return this.deps.timer.subscribeBusy(listener); }
 private record(path: string, day: string): CompletionAttempt | undefined {
  return [...this.guards.values(), ...this.deps.getRecords()].find(r => r.sourcePath === path && (r.requestDay === day || r.phase === "pending" || r.phase === "uncertain" || r.phase === "cleanup-pending"));
 }
 private async save(record: CompletionAttempt): Promise<void> {
  // Keep the in-memory guard even when durability fails after an upstream write.
  this.guards.set(`${record.sourcePath}\0${record.requestDay}`, structuredClone(record));
  await this.deps.saveRecord(structuredClone(record));
  this.guards.delete(`${record.sourcePath}\0${record.requestDay}`);
 }
 async availability(target: CompletionTarget): Promise<{ available: boolean; reason: string }> {
  try {
   await this.deps.settingsReady();
   if (this.deps.storageAvailable?.() === false) return { available: false, reason: "Completion history needs attention before another task can be completed." };
   const g = this.deps.gateway;
   if (!g.completionAvailable()) return { available: false, reason: "TaskNotes completion is unavailable." };
   if (!resolveCompletionStatus(await g.statuses(), this.deps.getSettings().completionStatus)) return { available: false, reason: "No completed status is available from TaskNotes." };
   const task = await g.getTask(target.sourcePath);
   if (!task || task.archived) return { available: false, reason: "This task is no longer available." };
   const recurrence = task as { recurrence?: unknown; recurrence_parent?: unknown };
   if (recurrence.recurrence || recurrence.recurrence_parent) return { available: false, reason: "Recurring completion is being checked. Complete this task in TaskNotes." };
   await this.safeEntries(normalizeTimerPath(target.sourcePath));
   const day = stagingDay((this.deps.now ?? Date.now)(), this.deps.getSettings().rolloverHour);
   const record = this.record(normalizeTimerPath(target.sourcePath), day);
   if (record?.phase === "pending" || record?.phase === "uncertain") return { available: false, reason: "The previous completion could not be confirmed. Check this task in TaskNotes." };
   if (record?.phase === "confirmed") return { available: false, reason: "This task was already completed from the pane today." };
   return { available: true, reason: record ? "Finish completion cleanup" : "Complete this task and stop its timer" };
  } catch { return { available: false, reason: "Couldn't check completion. Retry when TaskNotes is ready." }; }
 }
 async complete(target: CompletionTarget): Promise<CompleteOutcome> {
  if (this.deps.otherBusy?.()) return "busy";
  const requestedAt = (this.deps.now ?? Date.now)();
  return this.deps.timer.runCompletion(async () => {
   let outcome: CompleteOutcome = "failed";
   let attempted = false;
   let confirmed = false;
   let record: CompletionAttempt | undefined;
   const g = this.deps.gateway;
   try {
    outcome = await this.deps.queue.run(async (): Promise<CompleteOutcome> => {
     await this.deps.settingsReady();
     const sourcePath = normalizeTimerPath(target.sourcePath);
     if (!sourcePath || sourcePath !== target.sourcePath || !(await this.availability(target)).available) return "unavailable";
     const requestDay = stagingDay(requestedAt, this.deps.getSettings().rolloverHour);
     const previous = this.record(sourcePath, requestDay);
     if (previous) {
      if (previous.phase !== "cleanup-pending") return "unavailable";
      record = structuredClone(previous); confirmed = true;
      await this.cleanup(record);
      return "completed";
     }
     const task = await g.getTask(sourcePath);
     const statuses = await g.statuses();
     const status = resolveCompletionStatus(statuses, this.deps.getSettings().completionStatus);
     if (!task || task.archived || !status || statuses.some(s => s.isCompleted && s.value === task.status)) return "unavailable";
     const staged = parseStagedValue(readStaged(task));
     if (staged) {
      const field = fieldStatus(await g.userFields());
      if (!g.stagingAvailability().available || field.kind !== "ok" || field.hasDefault) return "unavailable";
     }
     let active: Awaited<ReturnType<CompletionController["safeEntries"]>>;
     try { active = await this.safeEntries(sourcePath); } catch { return "unavailable"; }
     // A stale timer card must not authorize stopping its replacement.
     if (target.entry && active.some(item => !sameEntry({ taskPath: item.taskPath, startTime: item.entry.startTime }, target.entry!))) return "unavailable";
     record = { attemptId: this.deps.newCorrelationId(), sourcePath, requestDay, requestedAt,
      beforeEvidence: { status: task.status, staged, title: task.title, completedStatus: status.value },
      phase: "pending", pendingCleanupPaths: staged ? [sourcePath] : [] };
     await this.save(record);
     const context = { source: MUTATION_SOURCE, reason: "user complete", correlationId: record.attemptId };
     for (const item of active) {
      const fresh = await this.safeEntries(sourcePath);
      if (!fresh.length) continue;
      if (fresh.length !== 1 || !sameEntry({ taskPath: fresh[0]!.taskPath, startTime: fresh[0]!.entry.startTime }, { taskPath: item.taskPath, startTime: item.entry.startTime })) throw new Error("Timer changed");
      try { await g.stop(sourcePath, context); }
      catch (error) { if (!isNoActiveSessionError(g.normalizeError(error).message)) throw error; }
     }
     // Also protects against TaskNotes' completion-side automatic stop.
     if ((await this.safeEntries(sourcePath)).length) throw new Error("A new timer started");
     const latest = await g.getTask(sourcePath);
     if (!latest || latest.status !== task.status || readStaged(latest) !== readStaged(task) || (latest as { recurrence?: unknown }).recurrence) throw new Error("Task changed");
     attempted = true;
     await g.completeTask(sourcePath, status.value, context);
     const after = await g.getTask(sourcePath);
     if (!after || after.status !== status.value) throw new Error("Completion not confirmed");
     confirmed = true;
     record.phase = record.pendingCleanupPaths.length ? "cleanup-pending" : "confirmed";
     record.completedPath = sourcePath; record.completedAt = requestedAt;
     await this.save(record);
     this.deps.clearPause?.(sourcePath);
     await this.cleanup(record);
     return "completed";
    });
   } catch {
    outcome = confirmed ? "partial" : "failed";
    if (record && attempted && !confirmed) {
     record.phase = "uncertain";
     try { await this.save(record); } catch { /* The pending intent remains the durable replay guard. */ }
    }
    this.deps.log("Completion could not finish safely.");
   } finally {
    try { await this.deps.refresh(); }
    catch { if (outcome === "completed") outcome = "partial"; this.deps.log("Refreshing after completion failed."); }
   }
   const message = outcome === "partial" ? "Task completed, but saving completion or refreshing its staged cleanup failed. Check the task in TaskNotes."
    : outcome === "failed" ? "Couldn't confirm completion. Check this task in TaskNotes before trying again."
    : outcome === "unavailable" ? "Complete is unavailable for this task. Check TaskNotes and its completion settings." : null;
   if (message) { try { this.deps.notify(message); } catch { this.deps.log("Showing the completion result failed."); } }
   return outcome;
  });
 }
 private async safeEntries(path: string) {
  const g = this.deps.gateway;
  const active = (await g.active()).filter(item => !item.entry.endTime && normalizeTimerPath(item.taskPath) === path);
  const ownership = await g.pomodoroOwnership();
  if (active.length && (!ownership.readable || (ownership.owner && active.some(item => sameEntry({ taskPath: item.taskPath, startTime: item.entry.startTime }, ownership.owner!))))) throw new Error("Pomodoro timing is protected");
  return active;
 }
 private async cleanup(record: CompletionAttempt): Promise<void> {
  const g = this.deps.gateway;
  const completed = await g.getTask(record.completedPath ?? record.sourcePath);
  if (!completed || completed.status !== record.beforeEvidence.completedStatus) throw new Error("Completion changed before cleanup");
  for (const path of [...record.pendingCleanupPaths]) {
   if (!g.stagingAvailability().available || fieldStatus(await g.userFields()).kind !== "ok") throw new Error("Staging unavailable");
   const task = await g.getTask(path);
   if (!task) throw new Error("Task unavailable");
   // A later explicit restage is not this action's cleanup obligation.
   if (readStaged(task) === record.beforeEvidence.staged) {
    await g.updateTask(path, { staged: null }, { source: MUTATION_SOURCE, reason: "completion staged cleanup", correlationId: record.attemptId });
    const after = await g.getTask(path);
    if (!after || readStaged(after) === record.beforeEvidence.staged) throw new Error("Cleanup not confirmed");
   }
   record.pendingCleanupPaths = record.pendingCleanupPaths.filter(p => p !== path);
   await this.save(record);
  }
  record.phase = "confirmed";
  await this.save(record);
 }
}
