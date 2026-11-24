import { expect, test } from "vitest";
import { calendarDate } from "../src/model/calendarDate";
declare const process: { env: Record<string, string | undefined> };

test("local dates follow midnight, including early mornings and DST in multiple zones", () => {
	const original = process.env.TZ;
	try {
		for (const zone of ["UTC", "America/New_York", "Europe/London", "Australia/Lord_Howe"]) {
			process.env.TZ = zone;
			for (const [month, day] of [[2, 8], [10, 1], [0, 1]] as const) {
				expect(calendarDate(new Date(2026, month, day, 0, 1).getTime())).toBe(`2026-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
				expect(calendarDate(new Date(2026, month, day, 23, 59).getTime())).toBe(calendarDate(new Date(2026, month, day, 0, 1).getTime()));
			}
		}
	} finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test.each([NaN, Infinity, -Infinity])("nonfinite dates %s are rejected", value => expect(() => calendarDate(value)).toThrow(RangeError));
