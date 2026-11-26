import { formatHms } from "./timeMath";

export const DEFAULT_COUNTDOWN_MS = 45 * 60_000;

export function validCountdownMs(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 1000;
}

/** Minutes and seconds, optionally preceded by hours. */
export function parseCountdown(text: string): number | null {
	const match = /^(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)$/.exec(text.trim());
	if (!match) return null;
	const hours = Number(match[1] ?? 0);
	const minutes = Number(match[2]);
	if (minutes >= 60) return null;
	const ms = ((hours * 60 + minutes) * 60 + Number(match[3])) * 1000;
	return validCountdownMs(ms) ? ms : null;
}

export function formatCountdown(ms: number): string {
	const formatted = formatHms(Math.ceil(Math.max(0, ms) / 1000) * 1000);
	return formatted.startsWith("0:") ? formatted.slice(2) : formatted;
}
