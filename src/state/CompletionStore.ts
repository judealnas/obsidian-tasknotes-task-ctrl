import { COMPLETION_RECORDS_VERSION, isCompletionAttempt, loadCompletionRecords, type CompletionAttempt, type CompletionData, type LoadedCompletions } from "../model/completionLedger";
import { completedIdentity, occurrenceParent } from "../model/completionIdentity";
import type { TaskInfo } from "../tasknotes/runtime-api.types";

/** Owns durable completion safety records; persist is main.persistAll, never a second writer. */
export class CompletionStore {
 private state: LoadedCompletions = { records: [], initialized: false };
 private readonly listeners = new Set<() => void>();
 private tasks: TaskInfo[] = [];
 private statuses = new Set<string>();
 private evidenceRevision = 0;
 get revision(): number { return this.evidenceRevision; }
 constructor(private readonly deps: { persist: () => Promise<void>; capacity?: number; log?: (message: string) => void }) {}
 load(data: unknown): void { this.state = loadCompletionRecords(data); this.evidenceRevision++; this.emit(); }
 records(): CompletionAttempt[] { return structuredClone(this.state.records.filter(isCompletionAttempt)); }
 available(): boolean { return !this.state.quarantine && (this.records().length < (this.deps.capacity ?? 1000) || this.records().some(r => r.phase === "confirmed" && !r.replayProtected)); }
 async saveRecord(record: CompletionAttempt): Promise<void> {
  if (this.state.quarantine) throw new Error("Completion history needs attention");
  const records = this.state.records.filter(r => !isCompletionAttempt(r) || r.attemptId !== record.attemptId);
  const capacity = this.deps.capacity ?? 1000;
  while (records.filter(isCompletionAttempt).length >= capacity) {
   const index = records.findIndex(r => isCompletionAttempt(r) && r.phase === "confirmed" && !r.replayProtected);
   if (index < 0) throw new Error("Completion safety history is full");
   records.splice(index, 1);
  }
  records.push(structuredClone(record));
  const next = loadCompletionRecords({ completionRecordsVersion: COMPLETION_RECORDS_VERSION, completionRecords: records });
  if (next.quarantine) throw new Error("Invalid completion record");
  this.state = next;
  this.evidenceRevision++;
  try { await this.deps.persist(); } finally { this.emit(); }
 }
 serialize(): CompletionData {
  if (this.state.quarantine) return structuredClone(this.state.quarantine);
  return this.state.initialized ? { completionRecordsVersion: COMPLETION_RECORDS_VERSION, completionRecords: structuredClone(this.state.records) } : {};
 }
 isCompletedSource(path: string, staged: string, today = staged): boolean {
  const source = this.tasks.find(task => task.path === path);
  const dates = source?.recurrence ? [...source.complete_instances ?? [], ...this.tasks.filter(task => occurrenceParent(task, this.tasks) === path).map(task => task.occurrence_date)] : [staged];
  return this.records().some(r => r.sourcePath === path && r.beforeEvidence.staged === staged && ["confirmed", "cleanup-pending"].includes(r.phase) && !!completedIdentity(r.completedPath ?? path, r.resolvedDate, this.tasks, this.statuses))
   || dates.some(date => typeof date === "string" && date >= staged && date <= today && !!completedIdentity(path, date, this.tasks, this.statuses));
 }
 /** Read-only completion snapshot; refreshing never creates history or saves data. */
 observe(tasks: readonly TaskInfo[], statuses: ReadonlySet<string>): Promise<void> {
  this.tasks = structuredClone([...tasks]); this.statuses = new Set(statuses);
  this.emit();
  return Promise.resolve();
 }
 subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
 private emit(): void { for (const listener of this.listeners) { try { listener(); } catch { /* A view cannot discard safety records. */ } } }
}
