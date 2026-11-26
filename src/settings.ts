import type { TaskStatus } from "./tasknotes/runtime-api.types";
import { validCountdownMs } from "./model/countdown";

/** Null is separate from every possible TaskNotes status string. */
export interface TimerPaneSettings { completionStatus: string | null; defaultCountdownMs?: number; }
export const DEFAULT_SETTINGS: TimerPaneSettings = { completionStatus: null };

export function loadSettings(data: unknown): TimerPaneSettings {
	if (!data || typeof data !== "object" || Array.isArray(data)) return { ...DEFAULT_SETTINGS };
	const record = data as Record<string, unknown>;
	const value = record.completionStatus;
	return {
		completionStatus: typeof value === "string" ? value : null,
		...(validCountdownMs(record.defaultCountdownMs) ? { defaultCountdownMs: record.defaultCountdownMs } : {}),
	};
}

export function resolveCompletionStatus(statuses: readonly TaskStatus[], preference: string | null): TaskStatus | null {
	const completed = statuses.filter(status => status.isCompleted === true && typeof status.value === "string");
	return completed.find(status => status.value === preference) ?? completed[0] ?? null;
}
