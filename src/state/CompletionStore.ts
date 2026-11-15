import { COMPLETION_RECORDS_VERSION, isCompletionAttempt, loadCompletionRecords, type CompletionAttempt, type CompletionData, type CompletionObservation, type LoadedCompletions } from "../model/completionLedger";
import { completedIdentity, completionFingerprint, deriveDoneToday, occurrenceParent } from "../model/doneToday";
import { parseStagedValue, readStaged } from "../model/staging";
import type { TaskInfo } from "../tasknotes/runtime-api.types";

/** Owns durable completion history; persist is main.persistAll, never a second writer. */
export class CompletionStore {
 private state: LoadedCompletions = { records: [], initialized: false };
 private readonly listeners = new Set<() => void>();
 private tasks: TaskInfo[] = [];
 private statuses = new Set<string>();
 private day: string | null = null;
 private evidenceRevision = 0;
 get revision(): number { return this.evidenceRevision; }
 constructor(private readonly deps: { persist: () => Promise<void>; capacity?: number; log?: (message: string) => void }) {}
 load(data: unknown): void { this.state = loadCompletionRecords(data); this.evidenceRevision++; this.emit(); }
 records(): CompletionAttempt[] { return structuredClone(this.state.records.filter(isCompletionAttempt)); }
 private observations(): CompletionObservation[] { return this.state.records.filter((r): r is CompletionObservation => !isCompletionAttempt(r)); }
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
 getDoneToday(day: string) { return deriveDoneToday(this.tasks, this.statuses, this.state.records, day); }
 isCompletedSource(path: string, staged: string): boolean {
  return this.records().some(r => r.sourcePath === path && r.beforeEvidence.staged === staged && ["confirmed", "cleanup-pending"].includes(r.phase) && !!completedIdentity(r.completedPath ?? path, r.resolvedDate, this.tasks, this.statuses))
   || this.observations().some(r => r.sourcePath === path && r.membershipEvidence.staged === staged && r.capturedDay >= staged && r.stillCompleted && !!completedIdentity(r.completedPath, r.resolvedDate, this.tasks, this.statuses));
 }
 rollover(day: string, now = Date.now()): void {
  if (!parseStagedValue(day) || this.day === day || this.state.quarantine) return;
  const previousDay = this.day; this.day = day;
  this.evidenceRevision++;
  if (previousDay === null) return;
  for (const observation of this.observations()) if (observation.stillCompleted) observation.hidden = true;
  for (const record of this.records()) {
   if (!["confirmed", "cleanup-pending"].includes(record.phase) || this.observations().some(o => o.invalidatedAttemptId === record.attemptId)) continue;
   this.state.records.push({ kind: "observation", sourcePath: record.sourcePath, completedPath: record.completedPath ?? record.sourcePath,
    ...(record.resolvedDate ? { resolvedDate: record.resolvedDate } : {}), completionFingerprint: "rollover:" + record.attemptId,
    capturedDay: previousDay, firstObservedAt: now, completedAt: record.completedAt ?? record.requestedAt,
    membershipEvidence: { staged: record.beforeEvidence.staged ?? record.requestDay }, stillCompleted: false, hidden: true, invalidatedAttemptId: record.attemptId });
  }
  this.emit(); void this.deps.persist().catch(() => this.deps.log?.("Saving daily completion visibility failed."));
 }
 async observe(tasks: readonly TaskInfo[], statuses: ReadonlySet<string>, day: string, now: number): Promise<void> {
  if (this.state.quarantine || !parseStagedValue(day) || !Number.isFinite(now)) return;
  this.rollover(day, now);
  this.tasks = structuredClone([...tasks]); this.statuses = new Set(statuses);
  const before = JSON.stringify(this.state.records);
  const previous = structuredClone(this.observations());
  const observations = new Map(this.observations().map(o => [o.completionFingerprint, o]));
  for (const o of observations.values()) if (!o.completionFingerprint.startsWith("member:") && !o.invalidatedAttemptId) o.stillCompleted = !!completedIdentity(o.completedPath, o.resolvedDate, tasks, statuses);
  for (const record of this.records()) {
   if (!["confirmed", "cleanup-pending"].includes(record.phase) || completedIdentity(record.completedPath ?? record.sourcePath, record.resolvedDate, tasks, statuses)) continue;
   const key = "reopened:" + record.attemptId;
   if (!observations.has(key)) observations.set(key, { kind: "observation", sourcePath: record.sourcePath, completedPath: record.completedPath ?? record.sourcePath,
    completionFingerprint: key, capturedDay: day, firstObservedAt: now, completedAt: now, membershipEvidence: { staged: record.beforeEvidence.staged ?? record.requestDay }, stillCompleted: false, invalidatedAttemptId: record.attemptId });
  }
  for (const task of tasks) {
   const staged = parseStagedValue(readStaged(task));
   const remembered = previous.find(o => o.sourcePath === task.path)?.membershipEvidence.staged
    ?? this.records().find(r => r.sourcePath === task.path && r.beforeEvidence.staged)?.beforeEvidence.staged;
   const membership = staged && staged <= day ? staged : remembered;
   if (!membership || task.archived) continue;
   const memberKey = "member:" + task.path;
   if (!observations.has(memberKey)) observations.set(memberKey, { kind: "observation", sourcePath: task.path, completedPath: task.path,
    completionFingerprint: memberKey, capturedDay: day, firstObservedAt: now, completedAt: now, membershipEvidence: { staged: membership }, stillCompleted: false });
   const dates: Array<string | undefined> = task.recurrence ? [...new Set([
    ...task.complete_instances ?? [],
    ...tasks.filter(child => occurrenceParent(child, tasks) === task.path).map(child => child.occurrence_date),
   ].filter((date): date is string => !!parseStagedValue(date)))] : [task.occurrence_date];
   for (const date of dates) {
    const actual = completedIdentity(task.path, date, tasks, statuses);
    if (!actual) continue;
    const resolved = actual.occurrence_date ?? date;
    const fingerprint = "observed:" + completionFingerprint(actual.path, resolved);
    const old = previous.find(o => o.completionFingerprint === fingerprint);
    const pane = this.records().find(r => completedIdentity(r.completedPath ?? r.sourcePath, r.resolvedDate, tasks, statuses)?.path === actual.path && r.resolvedDate === resolved && ![...observations.values()].some(o => o.invalidatedAttemptId === r.attemptId));
    if (pane) continue;
    if (old?.stillCompleted) { observations.set(fingerprint, { ...old, stillCompleted: true }); continue; }
    const priorMembership = previous.some(o => o.sourcePath === task.path);
    const bootstrapDay = parseStagedValue(actual.completedDate) ?? parseStagedValue(resolved) ?? day;
    observations.set(fingerprint, { kind: "observation", sourcePath: task.path, completedPath: actual.path, ...(resolved ? { resolvedDate: resolved } : {}),
     completionFingerprint: fingerprint, capturedDay: priorMembership ? day : bootstrapDay, firstObservedAt: now, completedAt: now, membershipEvidence: { staged: membership }, stillCompleted: true });
   }
  }
  // Preserve seen fingerprints: evicting a live completion could rediscover it tomorrow.
  const activeAttempts = new Set(this.records().map(r => r.attemptId));
  const markers = [...new Map([...observations.values()].filter(o => o.invalidatedAttemptId && activeAttempts.has(o.invalidatedAttemptId)).map(o => [o.invalidatedAttemptId, o])).values()];
  const all = [...observations.values()].filter(o => !o.invalidatedAttemptId);
  if (all.length > 1000) {
   const retained = new Set(previous.map(o => o.completionFingerprint));
   for (let i = all.length - 1; i >= 0 && all.length > 1000; i--) {
    if (!retained.has(all[i]!.completionFingerprint)) all.splice(i, 1);
   }
   this.deps.log?.("Completion observation history is full; new observations were not retained.");
  }
  this.state.records = [...this.records(), ...markers, ...all];
  if (JSON.stringify(this.state.records) !== before) {
   this.evidenceRevision++;
   this.state.initialized = true;
   try { await this.deps.persist(); } finally { this.emit(); }
  } else this.emit();
 }
 subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
 private emit(): void { for (const listener of this.listeners) { try { listener(); } catch { /* A view cannot discard history. */ } } }
}
