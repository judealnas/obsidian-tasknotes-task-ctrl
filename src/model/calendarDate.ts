/** Local calendar date, without a configurable day boundary or UTC conversion. */
export function calendarDate(nowMs: number): string {
	if (!Number.isFinite(nowMs)) throw new RangeError("nowMs must be finite");
	const date = new Date(nowMs);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
