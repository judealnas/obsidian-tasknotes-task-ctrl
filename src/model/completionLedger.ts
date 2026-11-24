import { normalizeTimerPath } from "./pomodoroOwnership";
import { parseStagedValue } from "./staging";

export const COMPLETION_RECORDS_VERSION = 1;
export type CompletionPhase = "pending" | "uncertain" | "confirmed" | "cleanup-pending";
export interface CompletionAttempt {
 attemptId: string;
 sourcePath: string;
 requestDay: string;
 requestedAt: number;
 resolvedDate?: string;
 completedPath?: string;
 completedAt?: number;
 beforeEvidence: { status: string; staged: string | null; title: string; completedStatus: string; recurrence?: string; completedDates?: string[]; parentPath?: string; existingPaths?: string[] };
 cleanupEvidence?: Array<{ path: string; staged: string }>;
 replayProtected?: boolean;
 phase: CompletionPhase;
 pendingCleanupPaths: string[];
}
export interface CompletionData { completionRecordsVersion?: unknown; completionRecords?: unknown; }
export interface CompletionObservation {
 kind: "observation";
 sourcePath: string;
 completedPath: string;
 resolvedDate?: string;
 completionFingerprint: string;
 capturedDay: string;
 firstObservedAt: number;
 completedAt: number;
 membershipEvidence: { staged: string };
 stillCompleted: boolean;
 hidden?: boolean;
 invalidatedAttemptId?: string;
}
export type CompletionRecord = CompletionAttempt | CompletionObservation;
export function isCompletionAttempt(record: CompletionRecord): record is CompletionAttempt { return !!record && typeof record === "object" && !("kind" in record) && "attemptId" in record; }
export interface LoadedCompletions { records: CompletionRecord[]; initialized: boolean; quarantine?: CompletionData; }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function path(value: unknown): value is string {
 return typeof value === "string" && !!value && normalizeTimerPath(value) === value && !value.split("/").some(p => p === "." || p === "..") && ![...value].some(c => c.charCodeAt(0) < 32);
}
function valid(value: unknown): value is CompletionAttempt {
 if (!object(value)) return false;
 const b = value.beforeEvidence;
 if (typeof value.attemptId !== "string" || !value.attemptId.trim() || !path(value.sourcePath) || !parseStagedValue(value.requestDay) || typeof value.requestedAt !== "number" || !Number.isFinite(value.requestedAt)) return false;
 if (!["pending", "uncertain", "confirmed", "cleanup-pending"].includes(String(value.phase))) return false;
 if (!object(b) || typeof b.status !== "string" || typeof b.title !== "string" || typeof b.completedStatus !== "string" || !b.completedStatus || (b.staged !== null && !parseStagedValue(b.staged))) return false;
 if (value.resolvedDate !== undefined && !parseStagedValue(value.resolvedDate)) return false;
 if (value.completedPath !== undefined && !path(value.completedPath)) return false;
 if (value.completedAt !== undefined && (typeof value.completedAt !== "number" || !Number.isFinite(value.completedAt))) return false;
 if (value.replayProtected !== undefined && typeof value.replayProtected !== "boolean") return false;
 if (b.recurrence !== undefined && typeof b.recurrence !== "string") return false;
 if (b.parentPath !== undefined && !path(b.parentPath)) return false;
 if (b.completedDates !== undefined && (!Array.isArray(b.completedDates) || !b.completedDates.every(date => parseStagedValue(date)))) return false;
 if (b.existingPaths !== undefined && (!Array.isArray(b.existingPaths) || !b.existingPaths.every(path))) return false;
 const cleanup = value.cleanupEvidence;
 if (cleanup !== undefined && (!Array.isArray(cleanup) || !cleanup.every(e => object(e) && path(e.path) && parseStagedValue(e.staged)))) return false;
 if ((value.phase === "confirmed" || value.phase === "cleanup-pending") && (!value.completedPath || value.completedAt === undefined)) return false;
 return Array.isArray(value.pendingCleanupPaths) && value.pendingCleanupPaths.every(p => path(p) && (p === value.sourcePath || p === value.completedPath || (Array.isArray(cleanup) && cleanup.some(e => object(e) && e.path === p)))) && new Set(value.pendingCleanupPaths).size === value.pendingCleanupPaths.length;
}
function validObservation(value: unknown): value is CompletionObservation {
 if (!object(value) || value.kind !== "observation" || !path(value.sourcePath) || !path(value.completedPath)) return false;
 return typeof value.completionFingerprint === "string" && !!value.completionFingerprint && !!parseStagedValue(value.capturedDay)
  && typeof value.firstObservedAt === "number" && Number.isFinite(value.firstObservedAt) && typeof value.completedAt === "number" && Number.isFinite(value.completedAt)
  && object(value.membershipEvidence) && !!parseStagedValue(value.membershipEvidence.staged) && typeof value.stillCompleted === "boolean"
  && (value.resolvedDate === undefined || !!parseStagedValue(value.resolvedDate)) && (value.hidden === undefined || typeof value.hidden === "boolean")
  && (value.invalidatedAttemptId === undefined || typeof value.invalidatedAttemptId === "string");
}
export function isCompletionRecord(value: unknown): value is CompletionRecord { return valid(value) || validObservation(value); }
/** Unreadable safety state is retained byte-for-value for the single persistence owner. */
export function loadCompletionRecords(data: unknown): LoadedCompletions {
 if (!object(data) || (!Object.prototype.hasOwnProperty.call(data, "completionRecordsVersion") && !Object.prototype.hasOwnProperty.call(data, "completionRecords"))) return { records: [], initialized: false };
 const raw = { completionRecordsVersion: data.completionRecordsVersion, completionRecords: structuredClone(data.completionRecords) };
 const records = data.completionRecords;
 if (data.completionRecordsVersion !== COMPLETION_RECORDS_VERSION || !Array.isArray(records) || !records.every(r => valid(r) || validObservation(r))) return { records: [], initialized: true, quarantine: raw };
 const attempts = records.filter(valid); const observations = records.filter(validObservation);
 if (new Set(attempts.map(r => r.attemptId)).size !== attempts.length || new Set(attempts.map(r => `${r.sourcePath}\0${r.requestDay}`)).size !== attempts.length || new Set(observations.map(r => r.completionFingerprint)).size !== observations.length) return { records: [], initialized: true, quarantine: raw };
 return { records: structuredClone(records), initialized: true };
}
