import { expect, test } from "vitest";
import { deriveDoneToday } from "../src/model/doneToday";
import type { CompletionAttempt } from "../src/model/completionLedger";
const task = { path: "a.md", title: "A", status: "done", archived: false };
const record: CompletionAttempt = { attemptId: "one", sourcePath: "a.md", completedPath: "a.md", requestDay: "2026-11-14", requestedAt: 10, completedAt: 10, beforeEvidence: { status: "open", staged: "2026-11-14", title: "A", completedStatus: "done" }, phase: "confirmed", pendingCleanupPaths: [] };
test("empty and null inputs yield no Done today rows", () => {
 expect(deriveDoneToday(null, new Set(["done"]), null, "2026-11-14")).toEqual([]);
 expect(deriveDoneToday([], new Set(["done"]), [], "2026-11-14")).toEqual([]);
});
test("ordinary pane completion uses captured time/day and disappears on reopen", () => {
 expect(deriveDoneToday([task], new Set(["done"]), [record], "2026-11-14")).toMatchObject([{ completedPath: "a.md", title: "A", completedAt: 10 }]);
 expect(deriveDoneToday([{ ...task, status: "open" }], new Set(["done"]), [record], "2026-11-14")).toEqual([]);
 expect(deriveDoneToday([task], new Set(["done"]), [record], "2026-11-15")).toEqual([]);
});
test("authoritative materialized status overrides stale parent history", () => {
 const parent = { ...task, path: "parent.md", status: "open", recurrence: "FREQ=DAILY", complete_instances: ["2026-11-14"] };
 const occurrence = { ...task, path: "occurrence.md", recurrence_parent: "[[parent]]", occurrence_date: "2026-11-14" };
 const r = { ...record, sourcePath: parent.path, completedPath: parent.path, resolvedDate: "2026-11-14", replayProtected: true };
 expect(deriveDoneToday([parent, occurrence], new Set(["done"]), [r], "2026-11-14")[0]?.completedPath).toBe(occurrence.path);
 expect(deriveDoneToday([parent, { ...occurrence, status: "open" }], new Set(["done"]), [r], "2026-11-14")).toEqual([]);
});
test("duplicate evidence deduplicates and equal-time rows use deterministic path order", () => {
 const b = { ...task, path: "b.md", title: "B" };
 const rb = { ...record, attemptId: "two", sourcePath: b.path, completedPath: b.path };
 const rows = deriveDoneToday([b, task], new Set(["done"]), [rb, record, { ...record, attemptId: "duplicate" }], "2026-11-14");
 expect(rows.map(r => r.completedPath)).toEqual(["a.md", "b.md"]);
});
test("unstaged timer completion does not enter staged Done today", () => {
 expect(deriveDoneToday([task], new Set(["done"]), [{ ...record, beforeEvidence: { ...record.beforeEvidence, staged: null } }], "2026-11-14")).toEqual([]);
});
test("malformed rows are ignored rather than interpreted as confirmed evidence", () => {
 const rows = [null, {}, { attemptId: "bad" }, { ...record, requestedAt: Number.NaN }] as unknown as Parameters<typeof deriveDoneToday>[2];
 expect(deriveDoneToday([task], new Set(["done"]), rows, "2026-11-14")).toEqual([]);
});
test("distinct virtual occurrences stay distinct even when they share the same source", () => {
 const parent = { ...task, recurrence: "FREQ=DAILY", status: "open", complete_instances: ["2026-11-13", "2026-11-14"] };
 const records = ["2026-11-13", "2026-11-14"].map((resolvedDate, index) => ({ ...record, attemptId: String(index), resolvedDate }));
 const rows = deriveDoneToday([parent], new Set(["done"]), records, "2026-11-14");
 expect(rows.map(row => row.resolvedDate)).toEqual(["2026-11-13", "2026-11-14"]);
});
