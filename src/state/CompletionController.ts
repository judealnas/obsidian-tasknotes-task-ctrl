import { fieldStatus } from "../model/stagedField";
import { parseStagedValue, readStaged } from "../model/staging";
import { calendarDate } from "../model/calendarDate";
import { normalizeTimerPath, sameEntry, type EntryId } from "../model/pomodoroOwnership";
import { isNoActiveSessionError } from "../model/errors";
import { resolveCompletionStatus, type TimerPaneSettings } from "../settings";
import { MUTATION_SOURCE, type TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { CompleteOutcome, TimerController } from "./TimerController";
import type { WriteQueue } from "./WriteQueue";
import type { CompletionAttempt } from "../model/completionLedger";
import type { TaskInfo } from "../tasknotes/runtime-api.types";
export type { CompletionAttempt, CompletionPhase } from "../model/completionLedger";

export interface CompletionTarget { sourcePath: string; title: string; entry?: EntryId; }
class CompletionUnavailable extends Error {}
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
 resolveLink?: (reference: string, sourcePath: string) => string | null;
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
   const g = this.deps.gateway;
   if (!g.completionAvailable()) return { available: false, reason: "TaskNotes completion is unavailable." };
   if (!resolveCompletionStatus(await g.statuses(), this.deps.getSettings().completionStatus)) return { available: false, reason: "No completed status is available from TaskNotes." };
   const task = await g.getTask(target.sourcePath);
   if (!task || task.archived) return { available: false, reason: "This task is no longer available." };
   const day = calendarDate((this.deps.now ?? Date.now)());
   const record = this.record(normalizeTimerPath(target.sourcePath), day);
   if (record?.phase === "pending" || record?.phase === "uncertain") return { available: false, reason: "The previous completion could not be confirmed. Check this task in TaskNotes." };
   if (record?.phase === "confirmed") return { available: false, reason: "This task was already completed from the pane today." };
   if (!record && this.deps.storageAvailable?.() === false) return { available: false, reason: "Completion history needs attention before another task can be completed." };
   const classification = await this.classify(target.sourcePath, day);
   if (classification.parent && [...this.guards.values(), ...this.deps.getRecords()].some(r => r.beforeEvidence.parentPath === classification.parent!.path && r.sourcePath !== target.sourcePath && (r.requestDay === day || r.phase === "pending" || r.phase === "uncertain" || r.phase === "cleanup-pending"))) return { available: false, reason: "This recurring task already has a completion attempt. Check it in TaskNotes." };
   await this.protect(classification.family);
   if (classification.parent && !g.recurringAvailability().available) return { available: false, reason: g.recurringAvailability().reason };
   if (classification.materialize && !g.materializeOccurrence) return { available: false, reason: "TaskNotes occurrence materialization is unavailable." };
   if (classification.materialize && g.materializationAvailability && !g.materializationAvailability().available) return g.materializationAvailability();
   return { available: true, reason: record ? "Finish completion cleanup" : "Complete this task and stop its timer" };
  } catch (error) { return { available: false, reason: error instanceof CompletionUnavailable ? error.message : "Couldn't check completion. Retry when TaskNotes is ready." }; }
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
     const requestDay = calendarDate(requestedAt);
     const previous = this.record(sourcePath, requestDay);
     if (previous) {
      if (previous.phase !== "cleanup-pending") return "unavailable";
      record = structuredClone(previous); confirmed = true;
      await this.cleanup(record);
      return "completed";
     }
     const classification = await this.classify(sourcePath, requestDay);
     const task = classification.source;
     const statuses = await g.statuses();
     const status = resolveCompletionStatus(statuses, this.deps.getSettings().completionStatus);
     if (!task || task.archived || !status || statuses.some(s => s.isCompleted && s.value === task.status)) return "unavailable";
     const staged = parseStagedValue(readStaged(task));
     if (staged) {
      const field = fieldStatus(await g.userFields());
      if (!g.stagingAvailability().available || field.kind !== "ok" || field.hasDefault) return "unavailable";
     }
     const active = await this.protect(classification.family);
     // A stale timer card must not authorize stopping its replacement.
     if (target.entry && active.filter(item => normalizeTimerPath(item.taskPath) === sourcePath).some(item => !sameEntry({ taskPath: item.taskPath, startTime: item.entry.startTime }, target.entry!))) return "unavailable";
     record = { attemptId: this.deps.newCorrelationId(), sourcePath, requestDay, requestedAt,
      beforeEvidence: { status: task.status, staged, title: task.title, completedStatus: status.value,
       ...(classification.parent ? { parentPath: classification.parent.path, recurrence: classification.parent.recurrence, completedDates: [...classification.parent.complete_instances ?? []], existingPaths: [...classification.family] } : {}) },
      ...(classification.parent ? { replayProtected: true } : {}),
      cleanupEvidence: staged ? [{ path: sourcePath, staged }] : [],
      phase: "pending", pendingCleanupPaths: staged ? [sourcePath] : [] };
     await this.save(record);
     const context = { source: MUTATION_SOURCE, reason: "user complete", correlationId: record.attemptId };
     let chosen = classification.chosen;
     if (classification.materialize && classification.parent) {
      await this.protect(classification.family);
      attempted = true;
      chosen = await g.materializeOccurrence!(classification.parent.path, requestDay, context);
      if (chosen.recurrence || this.parentPath(chosen, classification.tasks) !== classification.parent.path || chosen.occurrence_date !== requestDay) throw new Error("Unexpected materialized identity");
      record.completedPath = chosen.path; record.resolvedDate = chosen.occurrence_date;
      await this.save(record);
      classification.family = [...new Set([...classification.family, chosen.path])];
     }
     const stopPaths = new Set([sourcePath, ...(chosen ? [chosen.path] : []), ...(classification.parent ? [classification.parent.path] : [])]);
     const captured = active;
     for (const item of captured.filter(item => stopPaths.has(normalizeTimerPath(item.taskPath)))) {
      const fresh = (await this.protect(classification.family)).filter(e => normalizeTimerPath(e.taskPath) === normalizeTimerPath(item.taskPath));
      if (!fresh.length) continue;
      if (fresh.length !== 1 || !sameEntry({ taskPath: fresh[0]!.taskPath, startTime: fresh[0]!.entry.startTime }, { taskPath: item.taskPath, startTime: item.entry.startTime })) throw new Error("Timer changed");
      try { await g.stop(item.taskPath, context); }
      catch (error) { if (!isNoActiveSessionError(g.normalizeError(error).message)) throw error; }
     }
     if ((await this.protect(classification.family)).some(e => stopPaths.has(normalizeTimerPath(e.taskPath)))) throw new Error("A new timer started");
     const latest = await g.getTask(sourcePath);
     if (!latest || latest.status !== task.status || readStaged(latest) !== readStaged(task) || latest.recurrence !== task.recurrence) throw new Error("Task changed");
     if (classification.parent && !chosen) {
      const parent = await g.getTask(classification.parent.path);
      if (!parent || JSON.stringify(parent.complete_instances ?? []) !== JSON.stringify(record.beforeEvidence.completedDates)) throw new Error("Recurring history changed");
      if (parent.complete_instances?.includes(requestDay)) { record.resolvedDate = requestDay; record.completedPath = parent.path; }
      else {
       attempted = true;
       const returned = await g.toggleCompleteInstance(parent.path, requestDay, context);
       record.completedPath = returned.path;
      }
     } else {
      const destination = chosen ?? task;
      const before = await g.getTask(destination.path);
      if (!before || before.archived || before.recurrence || (chosen && before.occurrence_date !== chosen.occurrence_date)) throw new Error("Occurrence changed");
      if (!statuses.some(s => s.isCompleted && s.value === before.status)) {
       attempted = true;
       const returned = await g.completeTask(destination.path, status.value, context);
       if (returned.path !== destination.path) throw new Error("Completion identity changed");
      }
      record.completedPath = destination.path;
      if (chosen?.occurrence_date) record.resolvedDate = chosen.occurrence_date;
     }
     await this.confirm(record);
     confirmed = true;
     record.completedAt = requestedAt;
     if (classification.parent) await this.captureInheritedCleanup(record, classification.parent);
     record.phase = record.pendingCleanupPaths.length ? "cleanup-pending" : "confirmed";
     await this.save(record);
     for (const path of stopPaths) this.deps.clearPause?.(path);
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
 private parentPath(task: TaskInfo, tasks: readonly TaskInfo[]): string | null {
  if (!task.recurrence_parent) return null;
  const resolved = this.deps.resolveLink?.(task.recurrence_parent, task.path);
  if (resolved) return resolved;
  const reference = task.recurrence_parent.replace(/^\[\[|\]\]$/g, "").split("|")[0]!.split("#")[0]!;
  const matches = tasks.filter(t => t.path === reference || t.path === reference + ".md");
  return matches.length === 1 ? matches[0]!.path : null;
 }
 private async classify(sourcePath: string, day: string) {
  const g = this.deps.gateway;
  const source = await g.getTask(sourcePath);
  if (!source || source.archived) throw new Error("Task unavailable");
  if (!source.recurrence && !source.recurrence_parent) return { source, parent: null as TaskInfo | null, chosen: null as TaskInfo | null, materialize: false, tasks: [source], family: [sourcePath] };
  const tasks = await g.listTasks();
  const parent = source.recurrence ? source : tasks.find(t => t.path === this.parentPath(source, tasks));
  if (!parent?.recurrence || parent.archived) throw new Error("Recurring parent unavailable");
  const occurrences = tasks.filter(t => this.parentPath(t, tasks) === parent.path);
  if (occurrences.some(t => !parseStagedValue(t.occurrence_date))) throw new Error("Occurrence identity unavailable");
  const matching = occurrences.filter(t => t.occurrence_date === (source.recurrence_parent ? source.occurrence_date : day));
  if (matching.length > 1 || (source.recurrence_parent && matching.length !== 1)) throw new CompletionUnavailable("More than one occurrence matches this task, or its occurrence is unavailable. Check it in TaskNotes.");
  const chosen = matching[0] ?? null;
  return { source, parent, chosen, tasks, family: [parent.path, ...occurrences.map(t => t.path)], materialize: !chosen && parent.occurrence_materialization === "on_completion" };
 }
 private async protect(paths: readonly string[]) {
  const g = this.deps.gateway;
  const active = (await g.active()).filter(item => !item.entry.endTime && paths.includes(normalizeTimerPath(item.taskPath)));
  const ownership = await g.pomodoroOwnership();
  if (active.length && !ownership.readable) throw new CompletionUnavailable("Couldn't verify Pomodoro ownership. Retry when TaskNotes is ready.");
  if (ownership.readable && ownership.owner && active.some(item => sameEntry({ taskPath: item.taskPath, startTime: item.entry.startTime }, ownership.owner!))) throw new CompletionUnavailable("This task or its occurrence is being timed by Pomodoro. Complete it in TaskNotes.");
  return active;
 }
 private async confirm(record: CompletionAttempt): Promise<void> {
  const g = this.deps.gateway;
  const task = await g.getTask(record.completedPath ?? record.sourcePath);
  if (!task) throw new Error("Completion evidence unavailable");
  if (task.recurrence) {
   const before = record.beforeEvidence.completedDates ?? [];
   const added = (task.complete_instances ?? []).filter(day => !before.includes(day) && parseStagedValue(day));
   const resolved = record.resolvedDate ?? (added.length === 1 ? added[0] : undefined);
   if (!resolved || !task.complete_instances?.includes(resolved) || task.status === record.beforeEvidence.completedStatus) throw new Error("Recurring completion not confirmed");
   record.resolvedDate = resolved; record.completedPath = task.path;
  } else {
   const statuses = await g.statuses();
   if (!statuses.some(s => s.isCompleted && s.value === task.status)) throw new Error("Completion not confirmed");
   if (record.replayProtected && (!task.occurrence_date || this.parentPath(task, await g.listTasks()) !== record.beforeEvidence.parentPath)) throw new Error("Occurrence evidence changed");
   record.completedPath = task.path;
   if (task.occurrence_date) record.resolvedDate = task.occurrence_date;
  }
 }
 private async captureInheritedCleanup(record: CompletionAttempt, parent: TaskInfo): Promise<void> {
  const staged = parseStagedValue(readStaged(parent));
  if (!staged) return;
  const tasks = await this.deps.gateway.listTasks();
  for (const task of tasks) {
   if (record.beforeEvidence.existingPaths?.includes(task.path) || this.parentPath(task, tasks) !== parent.path || readStaged(task) !== staged) continue;
   if (!record.pendingCleanupPaths.includes(task.path)) record.pendingCleanupPaths.push(task.path);
   record.cleanupEvidence ??= []; record.cleanupEvidence.push({ path: task.path, staged });
  }
 }
 private async cleanup(record: CompletionAttempt): Promise<void> {
  const g = this.deps.gateway;
  await this.confirm(record);
  for (const path of [...record.pendingCleanupPaths]) {
   if (!g.stagingAvailability().available || fieldStatus(await g.userFields()).kind !== "ok") throw new Error("Staging unavailable");
   const task = await g.getTask(path);
   if (!task) throw new Error("Task unavailable");
   if (path !== record.sourcePath && this.parentPath(task, await g.listTasks()) !== record.beforeEvidence.parentPath) throw new Error("Cleanup identity changed");
   const staged = record.cleanupEvidence?.find(e => e.path === path)?.staged ?? record.beforeEvidence.staged;
   // A later explicit restage is not this action's cleanup obligation.
   if (readStaged(task) === staged) {
    await g.updateTask(path, { staged: null }, { source: MUTATION_SOURCE, reason: "completion staged cleanup", correlationId: record.attemptId });
    const after = await g.getTask(path);
    if (!after || readStaged(after) === staged) throw new Error("Cleanup not confirmed");
   }
   record.pendingCleanupPaths = record.pendingCleanupPaths.filter(p => p !== path);
   await this.save(record);
  }
  record.phase = "confirmed";
  await this.save(record);
 }
}
