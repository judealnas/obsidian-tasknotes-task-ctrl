import type { TaskInfo } from "../tasknotes/runtime-api.types";
import { parseStagedValue } from "./staging";

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
