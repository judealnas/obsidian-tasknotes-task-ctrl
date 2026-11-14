import { expect, test } from "vitest";
import { daysStaged, deriveStaged, formatStagedDate, isStageReserved, parseStagedValue, readStaged } from "../src/model/staging";
import { stagingDay } from "../src/model/stagingDay";
import type { TaskInfo } from "../src/tasknotes/runtime-api.types";
declare const process: { env: Record<string, string | undefined> };
const task = (extra: object = {}): TaskInfo => ({ path: "A.md", title: "A", status: "open", archived: false, ...extra });

test.each([undefined, null, "", "2026-02-29", "1900-02-29", "2026-04-31", "2026-00-02", "2026-13-01", "2026-01-00", "2026-1-01", "2026-01-01junk", "2026-01-01T00:00:00Z", true, 1, [], {}])("invalid staged date %j is not reserved", value => {
	expect(parseStagedValue(value)).toBeNull(); expect(isStageReserved(task({ staged: value }))).toBe(false);
});
test.each(["2000-02-29", "2024-02-29", "0099-01-01", "2026-12-31"])("valid Gregorian date %s round trips", date => expect(parseStagedValue(date)).toBe(date));
test("top-level presence wins even for null, empty and invalid values", () => {
	for (const staged of [null, "", "invalid", undefined]) expect(readStaged(task({ staged, customProperties: { staged: "2026-11-13" } }))).toBe(staged);
	expect(readStaged(task({ customProperties: { staged: "2026-11-13" } }))).toBe("2026-11-13");
});
test("eligibility, reservation, existence and stable incoming ties are separate", () => {
	const tasks = [task({ path: "Z.md", staged: "2026-11-14" }), task({ path: "B.md", staged: "2026-11-14" }), task({ path: "future.md", staged: "2026-11-15" }), task({ path: "done.md", status: "finished", staged: "2026-11-13" }), task({ path: "old.md", archived: true, staged: "2026-11-13" })];
	expect(deriveStaged(tasks, new Set(["finished"]), "2026-11-14").map(item => item.taskPath)).toEqual(["Z.md", "B.md"]);
	expect(deriveStaged([], new Set(), "2026-11-14")).toEqual([]);
	expect(isStageReserved(tasks[2]!)).toBe(true);
	const ages = ["2026-11-14", "2026-11-13", "2026-11-12"].map(staged => deriveStaged([task({ staged })], new Set(), "2026-11-14")[0]!);
	expect(ages.map(item => item.age)).toEqual([0, 1, 2]);
	expect(ages.map(item => item.metadata.split(" · ")[1])).toEqual(["today", "1 day ago", "2 days ago"]);
});
test("calendar ages and date display survive DST and staging-day rollover", () => {
	const original = process.env.TZ;
	try {
		for (const zone of ["UTC", "America/New_York", "Europe/London", "Australia/Lord_Howe"]) {
			process.env.TZ = zone;
			expect(daysStaged("2026-03-07", "2026-03-09")).toBe(2);
			expect(daysStaged("2026-10-31", "2026-11-02")).toBe(2);
			expect(formatStagedDate("2026-11-14")).toContain("14");
			const before = stagingDay(new Date(2026, 10, 14, 3, 59).getTime(), 4);
			const at = stagingDay(new Date(2026, 10, 14, 4).getTime(), 4);
			expect(deriveStaged([task({ staged: "2026-11-14" })], new Set(), before)).toHaveLength(0);
			expect(deriveStaged([task({ staged: "2026-11-14" })], new Set(), at)[0]!.age).toBe(0);
		}
	} finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
