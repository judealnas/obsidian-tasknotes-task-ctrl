import type { TaskInfo } from "../tasknotes/runtime-api.types";
import { isCompletionAttempt, isCompletionRecord, type CompletionObservation, type CompletionRecord } from "./completionLedger";
import { parseStagedValue } from "./staging";
import { taskDisplayKey } from "./timeMath";

export interface DoneTodayItem { id: string; sourcePath: string; completedPath: string; resolvedDate?: string; title: string; displayKey: string; completedAt: number; }
export function occurrenceParent(task: TaskInfo, tasks: readonly TaskInfo[]): string | null {
 if (typeof task.recurrence_parent !== "string" || !task.recurrence_parent) return null;
 const ref = task.recurrence_parent.replace(/^\[\[|\]\]$/g, "").split("|")[0]!.split("#")[0]!;
 const found = tasks.filter(t => t.path === ref || t.path === ref + ".md");
 return found.length === 1 ? found[0]!.path : null;
}
export function completedIdentity(path: string, resolvedDate: string | undefined, tasks: readonly TaskInfo[], statuses: ReadonlySet<string>): TaskInfo | null {
 const task = tasks.find(t => t.path === path);
 if (!task || task.archived) return null;
 if (!task.recurrence) return statuses.has(task.status) ? task : null;
 if (!resolvedDate || !parseStagedValue(resolvedDate)) return null;
 const materialized = tasks.filter(t => t.occurrence_date === resolvedDate && occurrenceParent(t, tasks) === task.path);
 if (materialized.length) return materialized.length === 1 && !materialized[0]!.archived && statuses.has(materialized[0]!.status) ? materialized[0]! : null;
 return Array.isArray(task.complete_instances) && task.complete_instances.includes(resolvedDate) ? task : null;
}
export function completionFingerprint(path: string, date?: string): string { return JSON.stringify([path, date ?? ""]); }
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
/** Read-only projection; its callers own observation timestamps and storage. */
export function deriveDoneToday(tasks: readonly TaskInfo[] | null, statuses: ReadonlySet<string>, records: readonly CompletionRecord[] | null, day: string): DoneTodayItem[] {
 if (!Array.isArray(tasks) || !Array.isArray(records) || !(statuses instanceof Set) || !parseStagedValue(day)) return [];
 tasks = (tasks as readonly unknown[]).filter((t): t is TaskInfo => !!t && typeof t === "object" && "path" in t && typeof t.path === "string" && "title" in t && typeof t.title === "string" && "status" in t && typeof t.status === "string");
 records = records.filter(isCompletionRecord);
 const invalidated = new Set(records.filter(r => !isCompletionAttempt(r)).map(r => (r as CompletionObservation).invalidatedAttemptId).filter(Boolean));
 const rows = new Map<string, DoneTodayItem>();
 // Pane timestamps take precedence over duplicate external observations.
 const sorted = [...records].sort((a, b) => Number(isCompletionAttempt(b)) - Number(isCompletionAttempt(a)));
 for (const record of sorted) {
  if (!record || typeof record !== "object") continue;
  const pane = isCompletionAttempt(record);
  if (pane && !record.beforeEvidence.staged) continue;
  if (pane ? (record.requestDay !== day || !["confirmed", "cleanup-pending"].includes(record.phase) || invalidated.has(record.attemptId)) : (record.capturedDay !== day || !record.stillCompleted || record.hidden || !!record.invalidatedAttemptId)) continue;
  const actual = completedIdentity(record.completedPath ?? record.sourcePath, record.resolvedDate, tasks, statuses);
  if (!actual) continue;
  const date = actual.occurrence_date ?? record.resolvedDate;
  const id = completionFingerprint(actual.path, date);
  if (rows.has(id)) continue;
  const completedAt = pane ? record.completedAt ?? record.requestedAt : record.completedAt;
  if (!Number.isFinite(completedAt)) continue;
  rows.set(id, { id, sourcePath: record.sourcePath, completedPath: actual.path, ...(date ? { resolvedDate: date } : {}), title: actual.title, displayKey: taskDisplayKey(actual), completedAt });
 }
 return [...rows.values()].sort((a, b) => b.completedAt - a.completedAt || compare(a.completedPath, b.completedPath) || compare(a.sourcePath, b.sourcePath) || compare(a.resolvedDate ?? "", b.resolvedDate ?? "") || compare(a.id, b.id));
}
