import { normalizeTimerPath } from "./pomodoroOwnership";
import { STAGED_FIELD_KEY } from "./stagedField";
import type { TaskInfo } from "../tasknotes/runtime-api.types";

export interface StagedItem { task: TaskInfo; taskPath: string; date: string; age: number; metadata: string; }

/** Explicit null/empty/invalid top-level values override a stale nested value. */
export function readStaged(task: TaskInfo): unknown {
	const fields = task as TaskInfo & { staged?: unknown; customProperties?: Record<string, unknown> };
	return Object.prototype.hasOwnProperty.call(fields, STAGED_FIELD_KEY) ? fields.staged : fields.customProperties?.[STAGED_FIELD_KEY];
}
export function parseStagedValue(value: unknown): string | null {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split("-").map(Number) as [number, number, number];
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const limit = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
	return month >= 1 && month <= 12 && day >= 1 && day <= limit ? value : null;
}
export function isStageReserved(task: TaskInfo): boolean { return parseStagedValue(readStaged(task)) !== null; }
function ordinal(date: string): number {
	const [year, month, day] = date.split("-").map(Number) as [number, number, number];
	const d = new Date(0); d.setUTCFullYear(year, month - 1, day); d.setUTCHours(0, 0, 0, 0);
	return d.getTime() / 86400000;
}
export function daysStaged(date: string, today: string): number { return Math.max(0, ordinal(today) - ordinal(date)); }
export function formatStagedDate(date: string): string {
	const [year, month, day] = date.split("-").map(Number) as [number, number, number];
	const display = new Date(0); display.setFullYear(year, month - 1, day); display.setHours(12, 0, 0, 0);
	return display.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function deriveStaged(tasks: readonly TaskInfo[], completed: ReadonlySet<string>, today: string): StagedItem[] {
	const result = new Map<string, StagedItem>();
	for (const task of tasks) {
		if (typeof task?.path !== "string") continue;
		const taskPath = normalizeTimerPath(task.path);
		const date = parseStagedValue(readStaged(task));
		if (!taskPath || !date || date > today || task.archived || completed.has(task.status) || result.has(taskPath)) continue;
		const age = daysStaged(date, today);
		result.set(taskPath, { task, taskPath, date, age, metadata: `${formatStagedDate(date)} · ${age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`}` });
	}
	return [...result.values()];
}
