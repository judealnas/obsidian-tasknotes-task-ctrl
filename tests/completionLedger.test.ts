import { expect, test } from "vitest";
import { loadCompletionRecords, type CompletionAttempt } from "../src/model/completionLedger";
export const attempt: CompletionAttempt = { attemptId: "one", sourcePath: "Tasks/a.md", requestDay: "2026-11-14", requestedAt: 123,
 beforeEvidence: { status: "open", staged: "2026-11-14", title: "A", completedStatus: "done" }, phase: "pending", pendingCleanupPaths: ["Tasks/a.md"] };
test("legacy data is empty; pending and uncertain histories survive reload", () => {
 expect(loadCompletionRecords({ unrelated: 1 })).toEqual({ records: [], initialized: false });
 expect(loadCompletionRecords({ completionRecordsVersion: 1, completionRecords: [attempt] })).toMatchObject({ records: [attempt], initialized: true });
});
test.each([{ ...attempt, requestDay: "2026-02-30" }, { ...attempt, sourcePath: "../bad.md" }, { ...attempt, requestedAt: Infinity }, { ...attempt, phase: "made-up" }, { ...attempt, pendingCleanupPaths: ["other.md"] }, { ...attempt, phase: "confirmed" }])("invalid safety evidence is quarantined instead of becoming replayable", record => {
 expect(loadCompletionRecords({ completionRecordsVersion: 1, completionRecords: [record] }).quarantine).toBeDefined();
});
test("unknown versions, duplicate identities and nonarray records are quarantined intact", () => {
 for (const data of [{ completionRecordsVersion: 99, completionRecords: [attempt] }, { completionRecordsVersion: 1, completionRecords: [attempt, attempt] }, { completionRecordsVersion: 1, completionRecords: {} }]) {
  expect(loadCompletionRecords(data).quarantine).toEqual(data);
 }
});
